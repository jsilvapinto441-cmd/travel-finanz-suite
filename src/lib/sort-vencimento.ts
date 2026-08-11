/**
 * Ordenação canônica de relatórios por data (crescente).
 *
 * Regras:
 * - A comparação usa o valor real da data (timestamp), nunca comparação textual.
 * - Aceita datas ISO (YYYY-MM-DD), ISO com hora e objetos Date.
 * - Registros sem data vão para o fim da lista.
 * - Empates são desempatados por número da parcela e depois por ID,
 *   garantindo ordem estável e independente da ordem vinda do banco.
 */

export const SEM_VENCIMENTO = "9999-12-31";

type DateLike = string | number | Date | null | undefined;

/** Converte um valor de data em timestamp comparável (NaN-safe). */
export function toTime(value: DateLike): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  const s = String(value).trim();
  // YYYY-MM-DD (ou com hora) -> interpreta como data local, sem fuso
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const t = d.getTime();
    return Number.isNaN(t) ? null : t;
  }
  // DD/MM/YYYY
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    const t = d.getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Compara duas datas em ordem crescente; valores ausentes/ inválidos vão para o fim. */
export function compareDateAsc(a: DateLike, b: DateLike): number {
  const ta = toTime(a);
  const tb = toTime(b);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return ta - tb;
}

/** Alias histórico usado pelos módulos financeiros. */
export function compareVencimento(a: DateLike, b: DateLike): number {
  return compareDateAsc(a, b);
}

function tiebreak(a: unknown, b: unknown): number {
  const ra = a as { numero_parcela?: number | null; id?: string | null } | null;
  const rb = b as { numero_parcela?: number | null; id?: string | null } | null;
  const pa = Number(ra?.numero_parcela ?? Number.POSITIVE_INFINITY);
  const pb = Number(rb?.numero_parcela ?? Number.POSITIVE_INFINITY);
  if (Number.isFinite(pa) || Number.isFinite(pb)) {
    if (pa !== pb) return pa - pb;
  }
  return String(ra?.id ?? "").localeCompare(String(rb?.id ?? ""));
}

/** Ordena (cópia) uma lista de registros que possuem `data_vencimento`. */
export function sortByVencimento<T extends { data_vencimento?: DateLike }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => compareDateAsc(a.data_vencimento, b.data_vencimento) || tiebreak(a, b),
  );
}

/** Ordena (cópia) linhas de exportação, extraindo a data via getter. */
export function sortRowsByVencimento<T>(
  rows: readonly T[],
  getVencimento: (row: T) => DateLike,
): T[] {
  return [...rows].sort((a, b) => compareDateAsc(getVencimento(a), getVencimento(b)));
}

/** Ordena (cópia) qualquer lista por uma data crescente, com desempate estável. */
export function sortByDateAsc<T>(
  rows: readonly T[],
  getDate: (row: T) => DateLike,
): T[] {
  return [...rows].sort((a, b) => compareDateAsc(getDate(a), getDate(b)) || tiebreak(a, b));
}
