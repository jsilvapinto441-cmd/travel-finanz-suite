export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return BRL.format(Number.isFinite(n) ? n : 0);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatMonth(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  atrasado: "Vencido",
  vencido: "Vencido",
  parcial: "Pago parcial",
  pago_parcial: "Pago parcial",
  cancelado: "Cancelado",
  ativo: "Ativo",
  inativo: "Inativo",
  rascunho: "Rascunho",
  em_analise: "Em análise",
  aguardando_pagamento: "Aguardando pagamento",
  concluido: "Concluído",
};

/** Formata o status de um registro para exibição em português. */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Retorna a descrição do período de apuração no formato "Período: dd/MM/yyyy a dd/MM/yyyy". */
export function formatPeriodoLabel(
  from?: string | Date | null,
  to?: string | Date | null,
): string {
  const fromFmt = from ? formatDate(from) : null;
  const toFmt = to ? formatDate(to) : null;
  if (fromFmt && toFmt) return `Período: ${fromFmt} a ${toFmt}`;
  if (fromFmt) return `Período: a partir de ${fromFmt}`;
  if (toFmt) return `Período: até ${toFmt}`;
  return "Período: completo";
}
