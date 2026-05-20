import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "login" | "logout" | "login_failed"
  | "create" | "update" | "delete"
  | "upload" | "download" | "delete_file"
  | "password_reset_request" | "password_reset_complete"
  | "access_denied";

export async function audit(
  acao: AuditAction,
  entidade?: string,
  entidade_id?: string | null,
  detalhes?: Record<string, unknown>,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      acao,
      entidade: entidade ?? null,
      entidade_id: entidade_id ?? null,
      detalhes: detalhes ? (detalhes as never) : null,
    });
  } catch {
    // Auditoria nunca deve quebrar a UX
  }
}
