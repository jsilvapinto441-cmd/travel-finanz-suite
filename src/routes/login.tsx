import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Zap } from "lucide-react";
import { z } from "zod";
import { audit } from "@/lib/audit";
import {
  checkLoginAllowed, registerLoginFailure, registerLoginSuccess,
  checkResetAllowed, registerResetSent, formatSeconds,
} from "@/lib/rate-limit";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "login" | "signup" | "forgot";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres");
const nomeSchema = z.string().trim().min(2, "Nome muito curto").max(100);

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const safeEmail = emailSchema.parse(email);

      if (mode === "login") {
        passwordSchema.parse(password);
        const gate = checkLoginAllowed(safeEmail);
        if (!gate.allowed) {
          toast.error(`Muitas tentativas. Tente novamente em ${formatSeconds(gate.secondsLeft)}.`);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: safeEmail, password });
        if (error) {
          const r = registerLoginFailure(safeEmail);
          await supabase.from("activity_logs").insert({
            acao: "login_failed", entidade: "auth",
            detalhes: { email: safeEmail, motivo: error.message, restantes: r.remaining },
          }).then(() => {}, () => {});
          if (r.lockUntil) {
            toast.error("Conta bloqueada temporariamente por 15 min após múltiplas tentativas.");
          } else {
            toast.error(`${error.message} — ${r.remaining} tentativa(s) restante(s).`);
          }
          return;
        }
        registerLoginSuccess(safeEmail);
        await audit("login", "auth");
        toast.success("Bem-vindo de volta");
        navigate({ to: "/" });
      } else if (mode === "signup") {
        nomeSchema.parse(nome);
        passwordSchema.parse(password);
        const { error } = await supabase.auth.signUp({
          email: safeEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nome },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu email para confirmar.");
        setMode("login");
      } else {
        // forgot
        const gate = checkResetAllowed(safeEmail);
        if (!gate.allowed) {
          const msg = gate.reason === "cooldown"
            ? `Aguarde ${formatSeconds(gate.secondsLeft)} antes de solicitar novamente.`
            : `Limite diário atingido. Tente novamente em ${formatSeconds(gate.secondsLeft)}.`;
          toast.error(msg);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        registerResetSent(safeEmail);
        await audit("password_reset_request", "auth", null, { email: safeEmail });
        toast.success("Se o email existir, enviaremos as instruções.");
        setMode("login");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0]?.message ?? "Dados inválidos");
      } else {
        toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
      }
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha";
  const description =
    mode === "login" ? "Acesso restrito à equipe administrativa."
      : mode === "signup" ? "Cadastre um novo usuário interno."
      : "Informe seu email para receber o link de redefinição.";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 size-[600px] rounded-full bg-primary/10 blur-3xl -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 size-[500px] rounded-full bg-gold/10 blur-3xl translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center justify-center mb-8 gap-2">
          <img src={logo} alt="PRODUZ" className="h-14 w-auto" />
          <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
            Gestão Premium
          </div>
        </div>

        <Card className="shadow-prestige border-border/60">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={100} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={72}
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
                  {mode === "signup" && (
                    <p className="text-[11px] text-muted-foreground">
                      Mínimo 8 caracteres. Senhas comprometidas (HIBP) são bloqueadas.
                    </p>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full gradient-emerald text-primary-foreground" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
              </Button>
            </form>

            <div className="text-sm text-center mt-4 text-muted-foreground space-y-1">
              {mode === "login" && (
                <>
                  <div>
                    <button onClick={() => setMode("forgot")} className="text-primary font-medium hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>
                  <div>
                    Primeiro acesso?{" "}
                    <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                      Criar conta
                    </button>
                  </div>
                </>
              )}
              {mode !== "login" && (
                <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                  Voltar ao login
                </button>
              )}
            </div>
            <div className="text-center mt-2">
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
                Voltar ao site
              </Link>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
