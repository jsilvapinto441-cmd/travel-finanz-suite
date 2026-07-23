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
