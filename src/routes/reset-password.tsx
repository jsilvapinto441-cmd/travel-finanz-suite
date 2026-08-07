import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { friendlyAuthError } from "@/lib/auth-errors";


export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres");

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const query = new URLSearchParams(window.location.search);

        const errDesc = hash.get("error_description") ?? query.get("error_description");
        if (errDesc) {
          toast.error(friendlyAuthError(errDesc));
        }

        // Fluxo PKCE: ?code=...
        const code = query.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (active) { setReady(true); setChecking(false); }
          return;
        }

        // Fluxo implícito: #access_token=...&type=recovery
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          if (active) { setReady(true); setChecking(false); }
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (active) { setReady(Boolean(data.session)); setChecking(false); }
      } catch (e) {
        toast.error(friendlyAuthError(e));
        if (active) { setReady(false); setChecking(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      passwordSchema.parse(password);
      if (password !== confirm) throw new Error("As senhas não coincidem");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await audit("password_reset_complete", "auth").catch(() => {});
      toast.success("Senha atualizada com sucesso. Faça login novamente.");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0]?.message ?? "Senha inválida");
      else if (err instanceof Error && err.message === "As senhas não coincidem") toast.error(err.message);
      else toast.error(friendlyAuthError(err));
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
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
