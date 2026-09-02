export type Abatimento = {
  id: string;
  recebivel_id?: string | null;
  tipo: string;
  valor: number;
  descricao: string | null;
  data_abatimento: string | null;
};

export const TIPOS_ABATIMENTO = [
  { value: "reembolso", label: "Reembolso" },
  { value: "comissao", label: "Comissão" },
  { value: "desconto", label: "Desconto" },
  { value: "outros", label: "Outros" },
];

export function tipoAbatimentoLabel(tipo: string | null | undefined) {
  return TIPOS_ABATIMENTO.find((t) => t.value === tipo)?.label ?? (tipo ?? "—");
}

type ValorSource = {
  valor_parcela?: number | null;
  valor_total?: number | null;
  total_abatimentos?: number | null;
};

/** Valor original da fatura/parcela, sem descontar abatimentos. */
export function valorOriginal(r: ValorSource): number {
  return Number(r.valor_parcela ?? r.valor_total ?? 0);
}

export function totalAbatimentos(r: ValorSource): number {
  return Number(r.total_abatimentos ?? 0);
}

/** valor_liquido = valor_original - total_abatimentos (nunca negativo). */
export function valorLiquido(r: ValorSource): number {
  return Math.max(valorOriginal(r) - totalAbatimentos(r), 0);
}

/** Saldo ainda devido considerando abatimentos e pagamentos já registrados. */
export function saldoLiquido(r: ValorSource & { valor_pago?: number | null }): number {
  return Math.max(valorLiquido(r) - Number(r.valor_pago ?? 0), 0);
}
