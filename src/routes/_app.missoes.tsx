import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, TextAreaField, SelectField } from "@/components/form-fields";
import { StatusBadge } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_app/missoes")({ component: Page });

type T = { id: string; nome: string; descricao: string | null; status: string; observacoes: string | null };

type Totais = { vendido: number; recebido: number; aReceber: number; emAtraso: number };

function useMissaoTotais() {
  return useQuery({
    queryKey: ["missoes-totais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebiveis")
        .select("missao_id, valor_parcela, valor_pago, data_vencimento, status");
      if (error) throw error;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const map = new Map<string, Totais>();
      for (const r of (data ?? []) as any[]) {
        if (!r.missao_id) continue;
        const t = map.get(r.missao_id) ?? { vendido: 0, recebido: 0, aReceber: 0, emAtraso: 0 };
        const parcela = Number(r.valor_parcela ?? 0);
        const pago = Number(r.valor_pago ?? 0);
        const saldo = Math.max(0, parcela - pago);
        t.vendido += parcela;
        t.recebido += pago;
        if (saldo > 0.005) {
          const venc = r.data_vencimento ? new Date(r.data_vencimento) : null;
          if (venc && venc < hoje && r.status !== "recebido") t.emAtraso += saldo;
          else t.aReceber += saldo;
        }
        map.set(r.missao_id, t);
      }
      return map;
    },
  });
}

function Page() {
  const { data: totais } = useMissaoTotais();
  const get = (id: string): Totais =>
    totais?.get(id) ?? { vendido: 0, recebido: 0, aReceber: 0, emAtraso: 0 };

  return (
    <PageContainer>
      <PageHeader title="Missões" description="Categorias operacionais e comerciais." />
      <DataTable<T>
        table="missoes" title="Missão" searchFields={["nome"]} orderBy="nome" ascending
        defaultValues={{ status: "ativo" }}
        columns={[
          { key: "nome", label: "Nome", render: (r) => <span className="font-medium">{r.nome}</span> },
          {
            key: "vendido", label: "Vendido", className: "text-right tabular-nums",
            render: (r) => <span className="font-medium">{formatCurrency(get(r.id).vendido)}</span>,
          },
          {
            key: "recebido", label: "Recebido", className: "text-right tabular-nums",
            render: (r) => <span className="text-success">{formatCurrency(get(r.id).recebido)}</span>,
          },
          {
            key: "aReceber", label: "A receber", className: "text-right tabular-nums",
            render: (r) => <span className="text-muted-foreground">{formatCurrency(get(r.id).aReceber)}</span>,
          },
          {
            key: "emAtraso", label: "Em atraso", className: "text-right tabular-nums",
            render: (r) => {
              const v = get(r.id).emAtraso;
              return <span className={v > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{formatCurrency(v)}</span>;
            },
          },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="space-y-4">
            <TextField label="Nome" value={values.nome} onChange={(v) => setValues({ ...values, nome: v })} required />
            <TextAreaField label="Descrição" value={values.descricao} onChange={(v) => setValues({ ...values, descricao: v })} />
            <SelectField label="Status" value={values.status} onChange={(v) => setValues({ ...values, status: v })}
              options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }]} />
            <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
          </div>
        )}
      />
    </PageContainer>
  );
}

