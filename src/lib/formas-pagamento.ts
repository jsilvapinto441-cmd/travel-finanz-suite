// Formas de pagamento/recebimento suportadas no sistema.
// Cobre os valores do enum `forma_pagamento` (registros_pagamento) e os
// rótulos usados em contratos.metodo_pagamento.
export const FORMAS_PAGAMENTO: { value: string; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "link_pagamento", label: "Link de pagamento" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência bancária" },
  { value: "transferencia_bancaria", label: "Transferência bancária" },
  { value: "ted", label: "TED" },
  { value: "deposito", label: "Depósito" },
  { value: "boleto", label: "Boleto" },
  { value: "cheque", label: "Cheque" },
  { value: "outros", label: "Outros" },
];

// Opções únicas por rótulo — usadas no seletor.
export const FORMAS_PAGAMENTO_OPTIONS = (() => {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const f of FORMAS_PAGAMENTO) {
    if (seen.has(f.label)) continue;
    seen.add(f.label);
    out.push(f);
  }
  return out;
})();

export function formaPagamentoLabel(v: string | null | undefined): string {
  if (!v) return "—";
  const hit = FORMAS_PAGAMENTO.find((f) => f.value === v);
  if (hit) return hit.label;
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Retorna true se o valor bruto do banco (`forma`) casa com algum dos filtros
// selecionados. Comparação por valor OU por rótulo, para tolerar variações
// entre `pix`/`PIX`, `transferencia`/`transferencia_bancaria`, etc.
export function formaMatches(
  forma: string | null | undefined,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  if (!forma) return false;
  const label = formaPagamentoLabel(forma).toLowerCase();
  return selected.some((s) => {
    if (s === forma) return true;
    return formaPagamentoLabel(s).toLowerCase() === label;
  });
}
