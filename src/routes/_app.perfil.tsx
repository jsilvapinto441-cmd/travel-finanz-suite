import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, User, Mail } from "lucide-react";
import { setBrandName, setBrandLogo } from "@/lib/brand";
import { z } from "zod";
import { friendlyAuthError } from "@/lib/auth-errors";
import { audit } from "@/lib/audit";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);

function PerfilPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nome, setNome] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Alteração de e-mail de login
  const [novoEmail, setNovoEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [trocandoEmail, setTrocandoEmail] = useState(false);
  const [emailPendente, setEmailPendente] = useState<string | null>(null);

  // Mantém profiles.email sincronizado com o e-mail de autenticação
  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle();
      if (data && data.email !== user.email) {
        await supabase.from("profiles").update({ email: user.email! }).eq("id", user.id);
      }
    })();
  }, [user?.id, user?.email]);

  async function handleTrocarEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setTrocandoEmail(true);
    try {
      const alvo = emailSchema.parse(novoEmail).toLowerCase();
      if (alvo === user.email.toLowerCase()) {
        toast.error("O novo e-mail é igual ao atual.");
        return;
      }
      if (!senhaAtual) {
        toast.error("Informe sua senha atual para confirmar.");
        return;
      }

      // 1) Reautentica com a senha atual (não cria usuário novo, não altera a sessão)
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: senhaAtual,
      });
      if (authErr) {
        toast.error("Senha atual incorreta.");
        return;
      }

      // 2) Solicita a alteração pelo mecanismo oficial de autenticação
      const { error } = await supabase.auth.updateUser(
        { email: alvo },
        { emailRedirectTo: `${window.location.origin}/perfil` },
      );
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
          toast.error("Este e-mail já está cadastrado em outra conta.");
        } else {
          toast.error(friendlyAuthError(error));
        }
        return;
      }

      setEmailPendente(alvo);
      setNovoEmail("");
      setSenhaAtual("");
      await audit("email_change_request", "auth", null, { novo_email: alvo }).catch(() => {});
      toast.success("Confirmação enviada. Verifique a caixa de entrada do novo e-mail (e o spam).");
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0]?.message ?? "Dados inválidos");
      else toast.error(friendlyAuthError(err));
    } finally {
      setTrocandoEmail(false);
    }
  }




  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome, telefone, empresa_nome, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar perfil");
      if (data) {
        setNome(data.nome ?? "");
        setEmpresaNome((data as any).empresa_nome ?? "");
        setTelefone((data as any).telefone ?? "");
        const av = (data as any).avatar_url ?? null;
        setAvatarUrl(av);
        setBrandName((data as any).empresa_nome);
        setBrandLogo(av);
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? null;
      setAvatarUrl(url);
      setBrandLogo(url);
      toast.success("Imagem enviada — clique em Salvar para persistir.");
    } catch (err: any) {
      toast.error("Falha no upload: " + (err?.message ?? "erro"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: nome.trim() || null,
          telefone: telefone.trim() || null,
          empresa_nome: empresaNome.trim() || null,
          avatar_url: avatarUrl,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      setBrandName(empresaNome);
      setBrandLogo(avatarUrl);
      toast.success("Perfil atualizado");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message ?? "erro"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Login / Perfil" description="Gerencie seus dados de acesso e da empresa." />
      <Card className="p-6 max-w-2xl space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="size-20 rounded-full bg-muted border overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Logo/Foto" className="size-full object-cover" />
                ) : (
                  <User className="size-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
                  Enviar foto/logo
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WEBP até 5 MB.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>E-mail (login)</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} maxLength={120} placeholder="Nome da empresa" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </>
        )}
      </Card>
    </PageContainer>
  );
}
