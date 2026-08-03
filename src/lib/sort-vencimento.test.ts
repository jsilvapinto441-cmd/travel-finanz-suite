import { describe, expect, it } from "vitest";
import {
  compareVencimento,
  sortByVencimento,
  sortRowsByVencimento,
} from "@/lib/sort-vencimento";

type Row = { id: string; data_vencimento: string | null; status?: string; empresa_id?: string };

const base: Row[] = [
  { id: "c", data_vencimento: "2026-03-10", status: "pago", empresa_id: "e1" },
  { id: "a", data_vencimento: "2026-01-05", status: "em_aberto", empresa_id: "e2" },
  { id: "e", data_vencimento: null, status: "em_aberto", empresa_id: "e1" },
  { id: "b", data_vencimento: "2026-02-01", status: "em_aberto", empresa_id: "e1" },
  { id: "d", data_vencimento: "2026-12-31", status: "cancelado", empresa_id: "e2" },
];

const ids = (rows: Row[]) => rows.map((r) => r.id);
const isAscending = (rows: Row[]) =>
  rows.every(
    (r, i) => i === 0 || compareVencimento(rows[i - 1].data_vencimento, r.data_vencimento) <= 0,
  );

describe("compareVencimento", () => {
  it("ordena datas ISO em ordem crescente", () => {
    expect(compareVencimento("2026-01-05", "2026-02-01")).toBeLessThan(0);
    expect(compareVencimento("2026-02-01", "2026-01-05")).toBeGreaterThan(0);
    expect(compareVencimento("2026-01-05", "2026-01-05")).toBe(0);
  });

  it("joga registros sem vencimento para o fim", () => {
    expect(compareVencimento(null, "2099-12-30")).toBeGreaterThan(0);
    expect(compareVencimento(undefined, "2026-01-01")).toBeGreaterThan(0);
    expect(compareVencimento(null, null)).toBe(0);
  });
});

describe("sortByVencimento (Recebíveis e Despesas)", () => {
  it("ordena crescente por vencimento, com nulos no fim", () => {
    expect(ids(sortByVencimento(base))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("não muta a lista original", () => {
    const original = [...base];
    sortByVencimento(base);
    expect(base).toEqual(original);
  });

  it("mantém ordem crescente após qualquer filtro (empresa/status/período)", () => {
    const filtros: ((r: Row) => boolean)[] = [
      () => true,
      (r) => r.empresa_id === "e1",
      (r) => r.status === "em_aberto",
      (r) => r.status === "pago",
      (r) => (r.data_vencimento ?? "") >= "2026-02-01",
      (r) => (r.data_vencimento ?? "") <= "2026-03-10",
    ];
    for (const f of filtros) {
      expect(isAscending(sortByVencimento(base.filter(f)))).toBe(true);
    }
  });

  it("mantém ordem crescente ao paginar a lista já ordenada", () => {
    const ordenado = sortByVencimento(base);
    const pageSize = 2;
    const paginas = [
      ordenado.slice(0, pageSize),
      ordenado.slice(pageSize, pageSize * 2),
      ordenado.slice(pageSize * 2),
    ];
    expect(ids(paginas.flat())).toEqual(ids(ordenado));
    for (const p of paginas) expect(isAscending(p)).toBe(true);
  });

  it("é determinística independente da ordem de entrada", () => {
    const embaralhado = [...base].reverse();
    expect(ids(sortByVencimento(embaralhado))).toEqual(ids(sortByVencimento(base)));
  });

  it("lida com lista vazia", () => {
    expect(sortByVencimento([])).toEqual([]);
  });
});

describe("sortRowsByVencimento (linhas de exportação)", () => {
  type ExportRow = { rec: Row; pagamento: { data_pagamento: string } | null };

  it("ordena linhas expandidas por pagamento pelo vencimento do registro", () => {
    const rows: ExportRow[] = [
      { rec: base[0], pagamento: { data_pagamento: "2026-03-11" } },
      { rec: base[2], pagamento: null },
      { rec: base[1], pagamento: { data_pagamento: "2026-01-06" } },
      { rec: base[3], pagamento: null },
    ];
    const sorted = sortRowsByVencimento(rows, (r) => r.rec.data_vencimento);
    expect(sorted.map((r) => r.rec.id)).toEqual(["a", "b", "c", "e"]);
  });

  it("mantém juntas as múltiplas linhas de um mesmo registro", () => {
    const rec = base[1];
    const rows: ExportRow[] = [
      { rec: base[0], pagamento: { data_pagamento: "2026-03-11" } },
      { rec, pagamento: { data_pagamento: "2026-01-06" } },
      { rec, pagamento: { data_pagamento: "2026-01-20" } },
    ];
    const sorted = sortRowsByVencimento(rows, (r) => r.rec.data_vencimento);
    expect(sorted.map((r) => r.rec.id)).toEqual(["a", "a", "c"]);
    expect(sorted[0].pagamento?.data_pagamento).toBe("2026-01-06");
    expect(sorted[1].pagamento?.data_pagamento).toBe("2026-01-20");
  });
});
