/**
 * Leitura paginada completa.
 *
 * A API de dados devolve no máximo 1000 linhas por requisição. Qualquer
 * listagem sem paginação perde silenciosamente os registros excedentes
 * (ex.: despesas com vencimento mais distante quando a lista é ordenada por
 * vencimento). Use este helper para ler TODOS os registros de uma consulta.
 *
 * A consulta passada deve ter ordenação determinística (inclua `.order("id")`
 * como desempate) para que as páginas não se sobreponham.
 */
export const PAGE_SIZE = 1000;
const MAX_PAGES = 500; // trava de segurança (500 mil linhas)

type PageResult<T> = { data: T[] | null; error: unknown };

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * pageSize;
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
