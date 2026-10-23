import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SelectField, TextField } from "@/components/form-fields";
import { formatCurrency, formatDate, formatPeriodoLabel } from "@/lib/format";
import { useContasBancarias } from "@/lib/bancos";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { sortByDateAsc } from "@/lib/sort-vencimento";

export const Route = createFileRoute("/_app/fluxo-caixa")({ component: Page });

type Mov = {
  id: string;
  conta_bancaria_id: string;
  tipo: "entrada" | "saida";
  valor: number;
  data_movimentacao: string;
  descricao: string | null;
  origem: string;
  forma_pagamento: string | null;
  observacao: string | null;
};

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Page() {
  const { data: contas } = useContasBancarias();
  const [contaId, setContaId] = useState<string>("__all__");
  const [from, setFrom] = useState<string>(firstDayOfMonth());
  const [to, setTo] = useState<string>(todayISO());

  const { data, isLoading } = useQuery({
    queryKey: ["fluxo-caixa", contaId, from, to],
    queryFn: async () => {
      const data = await fetchAllRows((pFrom, pTo) => {
        let q = supabase
          .from("movimentacoes_financeiras" as any)
          .select("*")
          .gte("data_movimentacao", from)
          .lte("data_movimentacao", to);
        if (contaId !== "__all__") q = q.eq("conta_bancaria_id", contaId);
        return q
          .order("data_movimentacao", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(pFrom, pTo);
      });
      return sortByDateAsc(data as unknown as Mov[], (m) => m.data_movimentacao);
    },
  });

  const totais = useMemo(() => {
    const rows = data ?? [];
    let entradas = 0, saidas = 0;
    for (const r of rows) {
      if (r.tipo === "entrada") entradas += Number(r.valor);
      else saidas += Number(r.valor);
    }
    return { entradas, saidas, saldo: entradas - saidas, count: rows.length };
  }, [data]);

  const contaNome = (id: string) => contas?.find((c) => c.id === id)?.banco ?? "—";

  const origemLabel: Record<string, string> = {
    pagamento_recebivel: "Recebimento",
    pagamento_despesa: "Pagamento",
    manual: "Manual",
    transferencia: "Transferência",
    ajuste: "Ajuste",
  };

  return (
    <PageContainer>
      <PageHeader
        title="Fluxo de Caixa"
        description="Todas as entradas e saídas dos seus bancos, atualizadas automaticamente a cada baixa."
        actions={
          <ExportButton<Mov>
            title="Fluxo de Caixa"
            subtitle={formatPeriodoLabel(from, to)}
            filters={[
              { label: "Conta", value: contaId === "__all__" ? "Todas as contas" : contaNome(contaId) },
              { label: "Período", value: formatPeriodoLabel(from, to).replace(/^Período:\s*/i, "") },
            ]}
            filename="fluxo_caixa"
            rows={data ?? []}
            columns={[
              { header: "Data", accessor: (r) => formatDate(r.data_movimentacao) },
              { header: "Descrição", accessor: "descricao" },
              { header: "Conta", accessor: (r) => contaNome(r.conta_bancaria_id) },
              { header: "Origem", accessor: (r) => origemLabel[r.origem] ?? r.origem },
              { header: "Tipo", accessor: (r) => (r.tipo === "entrada" ? "Entrada" : "Saída") },
              { header: "Valor", accessor: (r) => `${r.tipo === "entrada" ? "+" : "-"} ${formatCurrency(Number(r.valor))}` },
              { header: "Observação", accessor: "observacao" },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-success/10 flex items-center justify-center">
              <ArrowDownLeft className="size-5 text-success" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Entradas</div>
              <div className="text-xl font-semibold tabular-nums text-success">{formatCurrency(totais.entradas)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ArrowUpRight className="size-5 text-destructive" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Saídas</div>
              <div className="text-xl font-semibold tabular-nums text-destructive">{formatCurrency(totais.saidas)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo do período</div>
              <div className={"text-xl font-semibold tabular-nums " + (totais.saldo < 0 ? "text-destructive" : "text-primary")}>
                {formatCurrency(totais.saldo)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <SelectField label="Conta" value={contaId} onChange={setContaId}
          options={[{ value: "__all__", label: "Todas as contas" }, ...(contas ?? []).map((c) => ({ value: c.id, label: c.banco }))]} />
        <TextField label="De" type="date" value={from} onChange={setFrom} />
        <TextField label="Até" type="date" value={to} onChange={setTo} />
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !data?.length ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhuma movimentação no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-left px-4 py-2 font-medium">Descrição</th>
                  <th className="text-left px-4 py-2 font-medium">Conta</th>
                  <th className="text-left px-4 py-2 font-medium">Origem</th>
                  <th className="text-right px-4 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-2 tabular-nums">{formatDate(m.data_movimentacao)}</td>
                    <td className="px-4 py-2">
                      <div className="truncate max-w-[400px]">{m.descricao ?? "—"}</div>
                      {m.observacao && <div className="text-[11px] text-muted-foreground truncate">{m.observacao}</div>}
                    </td>
                    <td className="px-4 py-2">{contaNome(m.conta_bancaria_id)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-[10px]">{origemLabel[m.origem] ?? m.origem}</Badge>
                    </td>
                    <td className={"px-4 py-2 text-right font-semibold tabular-nums " + (m.tipo === "entrada" ? "text-success" : "text-destructive")}>
                      {m.tipo === "entrada" ? "+" : "−"} {formatCurrency(Number(m.valor))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
