import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/audit";

export const CONFIRM_DELETE_MESSAGE =
  "Tem certeza que deseja excluir este registro? Esta ação não poderá ser desfeita.";

/**
 * Exclui um registro respeitando vínculos (chaves estrangeiras) e registra
 * a ação no histórico. Lança erro com mensagem amigável em pt-BR quando
 * a exclusão é impedida por dependências em outros módulos.
 */
export async function deleteRecord(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table as never).delete().eq("id", id);
  if (error) {
    // Postgres: 23503 = foreign_key_violation
    const code = (error as { code?: string }).code;
    if (code === "23503") {
      throw new Error(
        "Não é possível excluir: existem registros vinculados a este item em outros módulos. Remova ou desvincule antes de tentar novamente.",
      );
    }
    // 42501 = insufficient_privilege (RLS)
    if (code === "42501") {
      throw new Error("Você não tem permissão para excluir este registro.");
    }
    throw new Error(error.message || "Falha ao excluir o registro.");
  }
  await audit("delete", table, id);
}
