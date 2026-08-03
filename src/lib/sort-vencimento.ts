/**
 * Ordenação canônica por data de vencimento (crescente).
 *
 * Regras:
 * - Datas são strings ISO (YYYY-MM-DD) e comparadas lexicograficamente.
 * - Registros sem vencimento vão para o fim da lista.
 * - A ordenação é estável e independente de filtros/paginação.
 */

export const SEM_VENCIMENTO = "9999-12-31";

export function compareVencimento(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return (a ?? SEM_VENCIMENTO).localeCompare(b ?? SEM_VENCIMENTO);
}

/** Ordena (cópia) uma lista de registros que possuem `data_vencimento`. */
export function sortByVencimento<T extends { data_vencimento?: string | null }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => compareVencimento(a.data_vencimento, b.data_vencimento));
}

/** Ordena (cópia) linhas de exportação, extraindo o vencimento via getter. */
export function sortRowsByVencimento<T>(
  rows: readonly T[],
  getVencimento: (row: T) => string | null | undefined,
): T[] {
  return [...rows].sort((a, b) => compareVencimento(getVencimento(a), getVencimento(b)));
}
