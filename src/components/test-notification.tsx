import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sendNotification } from "@/lib/notifications.functions";

const MESSAGES = {
  unsupported: "Este navegador não suporta notificações push.",
  "open-in-new-tab": "Abra o aplicativo em uma aba própria (ou o site publicado) para permitir notificações.",
  denied: "Permissão negada. Libere as notificações nas configurações do site no navegador.",
} as const;

export function TestNotification() {
  const send = useServerFn(sendNotification);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const { enablePush } = await import("@/lib/firebase-client");
      const result = await enablePush();
      if (result.status !== "registered") {
        toast.error(MESSAGES[result.status]);
        return;
      }
      await send({ data: { token: result.token, title: "Rotas", body: "Teste ✅" } });
      toast.success("Notificação enviada. Ela deve aparecer em instantes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao testar notificação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-display font-semibold">Notificações push</h3>
        <p className="text-sm text-muted-foreground">Teste temporário: envia "Teste ✅" para este dispositivo.</p>
      </div>
      <Button onClick={handleClick} disabled={loading}>
        <Bell className="h-4 w-4" /> {loading ? "Enviando..." : "Testar notificação"}
      </Button>
    </Card>
  );
}
