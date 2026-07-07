// Remove campos que não devem ser enviados em UPDATEs (id, timestamps,
// owner_id e colunas GENERATED por tabela). Enviar colunas geradas
// (ex: contratos.valor_saldo) causa erro "column can only be updated to DEFAULT".

const GLOBAL_STRIP = ["id", "created_at", "updated_at", "owner_id"] as const;

const PER_TABLE_STRIP: Record<string, string[]> = {
  contratos: ["valor_saldo"],
};

export function sanitizeUpdatePayload<T extends Record<string, unknown>>(
  table: string,
  payload: Partial<T>,
): Partial<T> {
  const strip = new Set<string>([...GLOBAL_STRIP, ...(PER_TABLE_STRIP[table] ?? [])]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (strip.has(k)) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
