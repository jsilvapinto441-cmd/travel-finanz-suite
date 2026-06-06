import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useSaldosBancarios() {
  return useQuery({
    queryKey: ["saldos-bancarios"],
    queryFn: async () => {
      const { data: contas, error: e1 } = await supabase
        .from("contas_bancarias" as any).select("id, saldo_inicial");
      if (e1) throw e1;
      const { data: movs, error: e2 } = await supabase
        .from("movimentacoes_financeiras" as any).select("conta_bancaria_id, tipo, valor");
      if (e2) throw e2;
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
