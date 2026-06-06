import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, NumberField, CurrencyField, SelectField, TextAreaField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { useEmpresas, useMissoes, useContratos, useFornecedores, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";
import { PagamentoDialog } from "@/components/pagamento-dialog";
import { CircleDollarSign } from "lucide-react";
import { EmpresaFilter } from "@/components/empresa-filter";
import { ExportButton } from "@/components/export-button";

export const Route = createFileRoute("/_app/despesas")({ component: Page });

type T = {
  id: string; empresa_id: string | null; missao_id: string | null; contrato_id: string | null;
  fornecedor_id: string | null; descricao: string; categoria: string; valor: number;
  valor_pago: number;
  data_vencimento: string | null; data_pagamento: string | null; banco: string | null;
  status: string; observacoes: string | null;
  parent_id: string | null; numero_parcela: number; parcelas: number; frequencia: string;
};

const CATEGORIAS = [
  { value: "impostos", label: "Impostos" }, { value: "funcionarios", label: "Funcionários" },
  { value: "aluguel", label: "Aluguel" }, { value: "luz", label: "Luz" },
  { value: "condominio", label: "Condomínio" }, { value: "telefone", label: "Telefone" },
  { value: "parcelamento_simples", label: "Parcelamento Simples" }, { value: "avulso", label: "Avulso" },
  { value: "fornecedor", label: "Fornecedor" }, { value: "outros", label: "Outros" },
];

function Page() {
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  const { data: contratos } = useContratos();
  const { data: fornecedores } = useFornecedores();
  const [empresaFilter, setEmpresaFilter] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<T | null>(null);

  const { data: allDespesas = [] } = useQuery({
    queryKey: ["despesas-export"],
    queryFn: async () => (await supabase.from("despesas").select("*").order("data_vencimento", { ascending: false })).data ?? [],
    staleTime: 30_000,
  });
  const exportRows = (allDespesas as T[]).filter((r) => !empresaFilter || r.empresa_id === empresaFilter);

  return (
    <PageContainer>
      <PageHeader
        title="Despesas"
        description="Contas a pagar. O status é calculado automaticamente a partir dos pagamentos registrados."
        actions={
          <ExportButton<T>
            title="Despesas"
            filename="despesas"
            rows={exportRows}
            columns={[
              { header: "Descrição", accessor: "descricao" },
              { header: "Categoria", accessor: (r) => r.categoria.replace(/_/g, " ") },
              { header: "Empresa", accessor: (r) => nomeById(empresas, r.empresa_id) },
              { header: "Fornecedor", accessor: (r) => nomeById(fornecedores, r.fornecedor_id) },
              { header: "Valor", accessor: (r) => formatCurrency(Number(r.valor)) },
              { header: "Valor pago", accessor: (r) => formatCurrency(Number(r.valor_pago ?? 0)) },
              { header: "Vencimento", accessor: (r) => formatDate(r.data_vencimento) },
              { header: "Pagamento", accessor: (r) => formatDate(r.data_pagamento) },
              { header: "Parcela", accessor: (r) => r.parcelas > 1 ? `${r.numero_parcela}/${r.parcelas}` : "Única" },
              { header: "Status", accessor: "status" },
            ]}
          />
        }
      />
      <DataTable<T>
        table="despesas" title="Despesa" searchFields={["descricao"]}
        defaultValues={{ status: "em_aberto", categoria: "outros", parcelas: 1, frequencia: "mensal" }}
        filter={(row) => !empresaFilter || row.empresa_id === empresaFilter}
        toolbar={
          <EmpresaFilter value={empresaFilter} onChange={(v) => setEmpresaFilter(v)} />
        }
        extraRowActions={(row) => (
          <Button size="sm" variant="ghost"
            className="text-primary hover:bg-primary/10 h-8 px-2"
            onClick={(e) => { e.stopPropagation(); setPayTarget(row); setPayOpen(true); }}>
            <CircleDollarSign className="size-3.5 mr-1" />
            Pagamento
          </Button>
        )}
        columns={[
          { key: "descricao", label: "Descrição", render: (r) => (
            <div>
              <div className="font-medium">{r.descricao}</div>
              {r.parcelas > 1 && <div className="text-xs text-muted-foreground">Parcela {r.numero_parcela}/{r.parcelas}</div>}
            </div>
          ) },
          { key: "categoria", label: "Categoria", render: (r) => <span className="capitalize">{r.categoria.replace(/_/g, " ")}</span> },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          {
            key: "valor", label: "Valor",
            render: (r) => {
              const v = Number(r.valor);
              const pago = Number(r.valor_pago ?? 0);
              return (
                <div className="tabular-nums">
                  <div className="font-medium">{formatCurrency(v)}</div>
                  {pago > 0 && pago < v && (
                    <div className="text-[10px] text-success">Pago {formatCurrency(pago)}</div>
                  )}
                </div>
              );
            },
          },
          { key: "data_vencimento", label: "Vencimento", render: (r) => formatDate(r.data_vencimento) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "anexos", label: "Anexos", render: (r) => <AnexosCell entidade="despesas" entidade_id={r.id} /> },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Categoria" value={values.categoria} onChange={(v) => setValues({ ...values, categoria: v })} options={CATEGORIAS} />

            <CurrencyField label="Valor (total)" value={values.valor} onChange={(v) => setValues({ ...values, valor: v })} />
            <NumberField label="Parcelas" value={values.parcelas} onChange={(v) => setValues({ ...values, parcelas: v })} step="1" />
            <SelectField label="Frequência" value={values.frequencia ?? "mensal"} onChange={(v) => setValues({ ...values, frequencia: v })}
              options={[
                { value: "mensal", label: "Mensal" }, { value: "quinzenal", label: "Quinzenal" },
                { value: "semanal", label: "Semanal" }, { value: "anual", label: "Anual" },
              ]} />
            <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
              options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v })}
              options={(missoes ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            <SelectField label="Contrato" value={values.contrato_id ?? ""} onChange={(v) => setValues({ ...values, contrato_id: v })}
              options={(contratos ?? []).map((c) => ({ value: c.id, label: `${c.numero ?? ""} ${c.cliente}` }))} />
            <SelectField label="Fornecedor" value={values.fornecedor_id ?? ""} onChange={(v) => setValues({ ...values, fornecedor_id: v })}
              options={(fornecedores ?? []).map((f) => ({ value: f.id, label: f.nome }))} />
            <TextField label="Vencimento" value={values.data_vencimento} onChange={(v) => setValues({ ...values, data_vencimento: v })} type="date" />
            <TextField label="Banco" value={values.banco} onChange={(v) => setValues({ ...values, banco: v })} />
            <div className="col-span-2">
              <TextField label="Descrição" value={values.descricao} onChange={(v) => setValues({ ...values, descricao: v })} required />
            </div>
            <div className="col-span-2">
              <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground">
              O <strong>status</strong> é calculado automaticamente. Para marcar como pago, use o botão <strong>Pagamento</strong> na lista.
            </p>
          </div>
        )}
      />

      <PagamentoDialog
        despesa={payTarget ? {
          id: payTarget.id,
          descricao: payTarget.descricao,
          valor: Number(payTarget.valor),
          valor_pago: Number(payTarget.valor_pago ?? 0),
          numero_parcela: payTarget.numero_parcela,
          parcelas: payTarget.parcelas,
        } : null}
        open={payOpen}
        onOpenChange={(v) => { setPayOpen(v); if (!v) setPayTarget(null); }}
      />
    </PageContainer>
  );
}
