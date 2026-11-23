import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { sendDueTestNow } from "@/lib/notifications.functions";

type Settings = { push_ativo: boolean; recebiveis_ativo: boolean; despesas_ativo: boolean };
const NEGADA = "Permissão negada. Ative as notificações nas configurações do navegador.";

export function NotificationSettings() {
  const { user } = useAuth();
  const testNow = useServerFn(sendDueTestNow);
  const [s, setS] = useState<Settings>({ push_ativo: false, recebiveis_ativo: false, despesas_ativo: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("notification_settings").select("push_ativo, recebiveis_ativo, despesas_ativo").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setS(data); });
  }, [user]);

  async function save(next: Settings) {
    if (!user) return false;
    const { error } = await supabase.from("notification_settings").upsert({ user_id: user.id, ...next });
    if (error) { toast.error(error.message); return false; }
    setS(next);
    return true;
  }

  async function togglePrincipal(on: boolean) {
    if (!user) return;
    if (!on) { await save({ ...s, push_ativo: false }); return; }
    setBusy(true);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") { toast.error(NEGADA); return; }
      const { enablePush } = await import("@/lib/firebase-client");
      const r = await enablePush();
      if (r.status === "denied") { toast.error(NEGADA); return; }
      if (r.status === "unsupported") { toast.error("Este navegador não suporta notificações push."); return; }
      if (r.status === "open-in-new-tab") { toast.error("Abra o aplicativo em uma aba própria (ou o site publicado) para ativar."); return; }
      if (r.status !== "registered") return;
      const ua = navigator.userAgent;
      const dispositivo = /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "web";
      const { error } = await supabase.from("user_push_tokens").upsert({ user_id: user.id, token: r.token, dispositivo }, { onConflict: "token" });
      if (error) { toast.error(error.message); return; }
      if (await save({ push_ativo: true, recebiveis_ativo: true, despesas_ativo: true })) toast.success("Notificações ativadas ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações.");
    } finally { setBusy(false); }
  }

  async function testar() {
    setBusy(true);
    try {
      const r = await testNow();
      toast.success(r.pushes ? `Teste enviado (${r.pushes} aviso${r.pushes > 1 ? "s" : ""}).` : "Nenhum aviso foi entregue.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar teste.");
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold">Notificações</h3>
      </div>
      <div className="space-y-3">
        <Row id="push" label="Ativar notificações push" checked={s.push_ativo} disabled={busy} onChange={togglePrincipal} />
        <Row id="rec" label="Avisos de recebíveis" checked={s.recebiveis_ativo} disabled={busy || !s.push_ativo} onChange={(v) => save({ ...s, recebiveis_ativo: v })} />
        <Row id="desp" label="Avisos de despesas" checked={s.despesas_ativo} disabled={busy || !s.push_ativo} onChange={(v) => save({ ...s, despesas_ativo: v })} />
      </div>
      <p className="text-sm text-muted-foreground">Você receberá um resumo diário às 08:00.</p>
      <Button variant="outline" onClick={testar} disabled={busy || !s.push_ativo}>
        <Send className="h-4 w-4" /> Enviar teste agora
      </Button>
    </Card>
  );
}

function Row({ id, label, checked, disabled, onChange }: { id: string; label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <Label htmlFor={id} className={disabled ? "text-muted-foreground" : ""}>{label}</Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
