import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/** send-notification: envia um push (FCM HTTP v1) para o dispositivo do próprio usuário logado. */
export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      token: z.string().min(20).max(4096),
      title: z.string().min(1).max(100),
      body: z.string().max(500),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
    if (!lovableKey || !connectionKey) throw new Error("Envio de notificações não configurado.");

    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: data.token,
          notification: { title: data.title, body: data.body },
          webpush: { fcm_options: { link: "/configuracoes" } },
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`FCM send failed [${res.status}]: ${text}`);
      throw new Error(`Falha ao enviar notificação [${res.status}]: ${text}`);
    }
    return { ok: true };
  });
