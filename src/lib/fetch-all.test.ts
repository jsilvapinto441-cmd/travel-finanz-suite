import { describe, expect, it } from "vitest";
import { fetchAllRows } from "@/lib/fetch-all";

/** Simula a API de dados: devolve no máximo 1000 linhas por requisição. */
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  let calls = 0;
  const query = async (from: number, to: number) => {
    calls++;
    const end = Math.min(to + 1, from + 1000);
    return { data: rows.slice(from, end), error: null };
  };
  return { query, calls: () => calls };
}

describe("fetchAllRows", () => {
  it("recupera todas as 1042 despesas, não apenas as primeiras 1000", async () => {
    const t = fakeTable(1042);
    const all = await fetchAllRows(t.query);
    expect(all).toHaveLength(1042);
    expect(all[1041]).toEqual({ id: 1041 });
  });

  it("recupera exatamente 1000 linhas sem perder nem duplicar", async () => {
    const t = fakeTable(1000);
    const all = await fetchAllRows(t.query);
    expect(all).toHaveLength(1000);
    expect(new Set(all.map((r) => r.id)).size).toBe(1000);
  });

  it("recupera volumes grandes (2500 linhas) em 3 páginas", async () => {
    const t = fakeTable(2500);
    const all = await fetchAllRows(t.query);
    expect(all).toHaveLength(2500);
    expect(t.calls()).toBe(3);
  });

  it("propaga erro da consulta", async () => {
    await expect(
      fetchAllRows(async () => ({ data: null, error: new Error("falhou") })),
    ).rejects.toThrow("falhou");
  });
});
