// Remove campos que não devem ser enviados em UPDATEs (id, timestamps,
// owner_id e colunas GENERATED por tabela). Enviar colunas geradas
// (ex: contratos.valor_saldo) causa erro "column can only be updated to DEFAULT".

const GLOBAL_STRIP = ["id", "created_at", "updated_at", "owner_id"] as const;

const PER_TABLE_STRIP: Record<string, string[]> = {
  contratos: ["valor_saldo"],
  despesas: ["registros_pagamento"],
  recebiveis: ["registros_pagamento"],
};

function isEmbeddedRelation(v: unknown): boolean {
  // PostgREST embedded relations: array of objects OR a joined object
  // (aliased like `empresa:empresas(nome)`). These are not real columns
  // and must never be sent back in UPDATE payloads.
  if (v === null || v === undefined) return false;
  if (v instanceof Date) return false;
  if (Array.isArray(v)) {
    return v.length === 0 || (typeof v[0] === "object" && v[0] !== null && !(v[0] instanceof Date));
  }
  if (typeof v === "object") {
    // Plain object → treat as embedded relation. JSONB columns are rare in
    // this project's UPDATE flows; if needed, callers can stringify first.
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
  }
  return false;
}

export function sanitizeUpdatePayload<T extends Record<string, unknown>>(
  table: string,
  payload: Partial<T>,
): Partial<T> {
  const strip = new Set<string>([...GLOBAL_STRIP, ...(PER_TABLE_STRIP[table] ?? [])]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (strip.has(k)) continue;
    // Descartar campos internos do cliente (marcadores começados por "_")
    if (k.startsWith("_")) continue;
    // Descartar relações embutidas do PostgREST (arrays/objetos aninhados)
    if (isEmbeddedRelation(v)) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
