// Cálculos de folha de pagamento (FGTS + INSS progressivo 2025)

export const FGTS_RATE = 0.08;

// Tabela INSS 2025 (progressiva, valores em BRL)
const INSS_BRACKETS: { limit: number; rate: number }[] = [
  { limit: 1518.0, rate: 0.075 },
  { limit: 2793.88, rate: 0.09 },
  { limit: 4190.83, rate: 0.12 },
  { limit: 8157.41, rate: 0.14 },
];
const INSS_TETO = 8157.41;
const INSS_MAX = (() => {
  let acc = 0;
  let prev = 0;
  for (const b of INSS_BRACKETS) {
    acc += (b.limit - prev) * b.rate;
    prev = b.limit;
  }
  return Math.round(acc * 100) / 100;
})();

export function calcINSS(salario: number): number {
  const s = Math.max(Number(salario) || 0, 0);
  if (s <= 0) return 0;
  if (s >= INSS_TETO) return INSS_MAX;
  let acc = 0;
  let prev = 0;
  for (const b of INSS_BRACKETS) {
    const upper = Math.min(s, b.limit);
    if (upper > prev) acc += (upper - prev) * b.rate;
    prev = b.limit;
    if (s <= b.limit) break;
  }
  return Math.round(acc * 100) / 100;
}

export function calcFGTS(salario: number): number {
  return Math.round(Math.max(Number(salario) || 0, 0) * FGTS_RATE * 100) / 100;
}

export interface CustoFuncionarioInput {
  salario?: number | null;
  alimentacao?: number | null;
  vale_transporte?: number | null;
  fgts?: number | null;
  inss?: number | null;
  custos_adicionais?: number | null;
  ativo?: boolean | null;
}

export function custoTotalFuncionario(f: CustoFuncionarioInput): number {
  return (
    Number(f.salario ?? 0) +
    Number(f.alimentacao ?? 0) +
    Number(f.vale_transporte ?? 0) +
    Number(f.fgts ?? 0) +
    Number(f.inss ?? 0) +
    Number(f.custos_adicionais ?? 0)
  );
}

export function folhaTotal(funcionarios: CustoFuncionarioInput[] | null | undefined): number {
  return (funcionarios ?? [])
    .filter((f) => f.ativo !== false)
    .reduce((s, f) => s + custoTotalFuncionario(f), 0);
}
