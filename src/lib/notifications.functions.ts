import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** send-notification: envia um push (FCM HTTP v1) para um dispositivo do próprio usuário. */
export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ token: z.string().min(20).max(4096), title: z.string().min(1).max(100), body: z.string().max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { sendFcm } = await import("./fcm.server");
    const r = await sendFcm(data.token, data.title, data.body, "/configuracoes");
    if (!r.ok) throw new Error(`Falha ao enviar notificação [${r.status}]`);
    return { ok: true };
  });

/** "Enviar teste agora": roda a verificação de vencimentos só para o usuário logado. */
export const sendDueTestNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checkDueItems } = await import("./due-items.server");
    return checkDueItems({ userId: context.userId, teste: true });
  });
