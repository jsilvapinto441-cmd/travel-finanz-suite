import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { audit } from "@/lib/audit";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres");

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Detecta link de recovery vindo do email
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      supabase.auth.getSession().then(({ data }) => {
        setReady(Boolean(data.session));
      });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      passwordSchema.parse(password);
      if (password !== confirm) throw new Error("As senhas não coincidem");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await audit("password_reset_complete", "auth");
      toast.success("Senha atualizada. Faça login novamente.");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0]?.message ?? "Senha inválida");
      else toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-prestige border-border/60">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>
            {ready ? "Escolha uma nova senha forte." : "Link inválido ou expirado."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input id="password" type="password" autoComplete="new-password" required
                  minLength={8} maxLength={72}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input id="confirm" type="password" autoComplete="new-password" required
                  minLength={8} maxLength={72}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full gradient-emerald text-primary-foreground">
                {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                Salvar nova senha
              </Button>
            </form>
          ) : (
            <Button onClick={() => navigate({ to: "/login" })} className="w-full">Voltar ao login</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
