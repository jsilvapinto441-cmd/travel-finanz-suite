const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export type FcmResult = { ok: true } | { ok: false; invalidToken: boolean; status: number; error: string };

/** Envia um push para um token pela API FCM HTTP v1 (via conector). */
export async function sendFcm(token: string, titulo: string, corpo: string, link: string, data: Record<string, string> = {}): Promise<FcmResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("Envio de notificações não configurado.");
  const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { token, notification: { title: titulo, body: corpo }, data: { link, ...data }, webpush: { fcm_options: { link } } },
    }),
  });
  if (res.ok) return { ok: true };
  const error = await res.text();
  console.error(`FCM send failed [${res.status}]: ${error}`);
  const invalidToken = res.status === 404 || (res.status === 400 && /INVALID_ARGUMENT|UNREGISTERED/.test(error));
  return { ok: false, invalidToken, status: res.status, error };
}
