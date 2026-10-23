import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";

export const BANCOS_PRE_CADASTRADOS = [
  "Itaú",
  "Bradesco",
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "Santander",
  "Nubank",
  "Inter",
  "Sicoob",
  "Sicredi",
  "C6 Bank",
  "BTG Pactual",
] as const;

export const TIPOS_CONTA = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "pagamento", label: "Conta Pagamento" },
];

export type ContaBancaria = {
  id: string;
  banco: string;
  agencia: string | null;
  conta: string | null;
  digito: string | null;
  tipo: string;
  chave_pix: string | null;
  titular: string | null;
  documento: string | null;
  saldo_inicial: number;
  ativo: boolean;
  observacoes: string | null;
};

export function useContasBancarias(opts: { ativas?: boolean } = {}) {
  return useQuery({
    queryKey: ["contas-bancarias", opts.ativas ?? "all"],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias" as any).select("*").order("banco");
      if (opts.ativas) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ContaBancaria[];
    },
  });
}

export function contaLabel(c: ContaBancaria): string {
  const parts = [c.banco];
  if (c.agencia) parts.push(`Ag. ${c.agencia}`);
  if (c.conta) parts.push(`CC ${c.conta}${c.digito ? "-" + c.digito : ""}`);
  return parts.join(" · ");
}

export function contaLabelComEmpresa(c: ContaBancaria, empresaNome?: string | null): string {
  const base = contaLabel(c);
  return empresaNome ? `${base}  |  Empresa: ${empresaNome}` : base;
}

export type ContaBancariaComEmpresa = ContaBancaria & {
  empresaNome: string | null;
  label: string;
};

/**
 * Hook que retorna contas bancárias já enriquecidas com o nome da empresa
 * vinculada (via empresas.conta_bancaria_id) e um `label` pronto para exibição.
 */
export function useContasBancariasComEmpresa(opts: { ativas?: boolean } = {}) {
  return useQuery({
    queryKey: ["contas-bancarias-empresa", opts.ativas ?? "all"],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias" as any).select("*").order("banco");
      if (opts.ativas) q = q.eq("ativo", true);
      const { data: contas, error } = await q;
      if (error) throw error;
      const { data: vinculos } = await supabase
        .from("empresa_contas_bancarias" as any)
        .select("conta_bancaria_id, empresas(nome)");
      const empresaPorConta = new Map<string, string>();
      for (const v of (vinculos ?? []) as any[]) {
        const nome = v.empresas?.nome as string | undefined;
        if (!nome) continue;
        // preserva a primeira empresa vinculada (mais antiga)
        if (!empresaPorConta.has(v.conta_bancaria_id)) {
          empresaPorConta.set(v.conta_bancaria_id, nome);
        }
      }
      return ((contas ?? []) as unknown as ContaBancaria[]).map((c) => {
        const empresaNome = empresaPorConta.get(c.id) ?? null;
        return {
          ...c,
          empresaNome,
          label: contaLabelComEmpresa(c, empresaNome),
        } as ContaBancariaComEmpresa;
      });
    },
  });
}

export function useSaldosBancarios() {
  return useQuery({
    queryKey: ["saldos-bancarios"],
    queryFn: async () => {
      const { data: contas, error: e1 } = await supabase
        .from("contas_bancarias" as any).select("id, saldo_inicial");
      if (e1) throw e1;
      // Paginado: com mais de 1000 movimentações o saldo ficava incompleto.
      const movs = await fetchAllRows((from, to) =>
        supabase
          .from("movimentacoes_financeiras" as any)
          .select("id, conta_bancaria_id, tipo, valor")
          .order("id", { ascending: true })
          .range(from, to),
      );
      const map = new Map<string, number>();
      for (const c of (contas ?? []) as any[]) {
        map.set(c.id, Number(c.saldo_inicial ?? 0));
      }
      for (const m of (movs ?? []) as any[]) {
        const cur = map.get(m.conta_bancaria_id) ?? 0;
        const v = Number(m.valor);
        map.set(m.conta_bancaria_id, cur + (m.tipo === "entrada" ? v : -v));
      }
      return map;
    },
  });
}
