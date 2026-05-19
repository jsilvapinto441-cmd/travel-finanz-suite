import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nome },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu email para confirmar.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 size-[600px] rounded-full bg-primary/10 blur-3xl -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 size-[500px] rounded-full bg-gold/10 blur-3xl translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8 gap-3">
          <div className="size-12 rounded-xl gradient-gold flex items-center justify-center font-display font-bold text-xl text-gold-foreground shadow-prestige">
            P
          </div>
          <div>
            <div className="font-display font-bold text-2xl">PRODUZ</div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
              Gestão Premium
            </div>
          </div>
        </div>

        <Card className="shadow-prestige border-border/60">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Entrar" : "Criar conta"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Acesso restrito à equipe administrativa."
                : "Cadastre um novo usuário interno."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full gradient-emerald text-primary-foreground" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
            <div className="text-sm text-center mt-4 text-muted-foreground">
              {mode === "login" ? (
                <>
                  Primeiro acesso?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{" "}
                  <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                    Entrar
                  </button>
                </>
              )}
            </div>
            <div className="text-center mt-2">
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
                Voltar
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center mt-6 text-muted-foreground">
          O primeiro usuário cadastrado se torna administrador automaticamente.
        </p>
      </div>
    </div>
  );
}
