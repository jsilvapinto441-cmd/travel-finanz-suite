import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { CircleDollarSign, CalendarClock, Target } from "lucide-react";
import { EmpresaFilter } from "@/components/empresa-filter";
import { ExportButton } from "@/components/export-button";
import { KpiCard } from "@/components/kpi-card";
import { useContasBancarias, contaLabel } from "@/lib/bancos";

export const Route = createFileRoute("/_app/despesas")({ component: Page });

type T = {
  id: string; empresa_id: string | null; missao_id: string | null; contrato_id: string | null;
  fornecedor_id: string | null; descricao: string; categoria: string; categoria_personalizada: string | null;
  valor: number;
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
  const [missaoFilter, setMissaoFilter] = useState("");
  const { data: contas } = useContasBancarias({ ativas: true });

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<T | null>(null);

  const { data: allDespesas = [] } = useQuery({
    queryKey: ["despesas-export"],
    queryFn: async () => (await supabase.from("despesas").select("*").order("data_vencimento", { ascending: false })).data ?? [],
    staleTime: 30_000,
  });

  const { data: anexosMap = new Map<string, { nome: string; path: string }[]>() } = useQuery({
    queryKey: ["despesas-anexos-export"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anexos")
        .select("entidade_id, nome, path")
        .eq("entidade", "despesas");
      const m = new Map<string, { nome: string; path: string }[]>();
      for (const a of (data ?? []) as any[]) {
        const arr = m.get(a.entidade_id) ?? [];
        arr.push({ nome: a.nome, path: a.path });
        m.set(a.entidade_id, arr);
      }
      return m;
    },
    staleTime: 30_000,
  });

  const { data: pagamentosMap = new Map<string, { forma: string; data: string | null; valor: number }[]>() } = useQuery({
    queryKey: ["despesas-pagamentos-export"],
    queryFn: async () => {
      const { data } = await supabase
        .from("registros_pagamento")
        .select("despesa_id, forma_pagamento, data_pagamento, valor")
        .not("despesa_id", "is", null);
      const m = new Map<string, { forma: string; data: string | null; valor: number }[]>();
      for (const p of (data ?? []) as any[]) {
        const arr = m.get(p.despesa_id) ?? [];
        arr.push({ forma: p.forma_pagamento, data: p.data_pagamento, valor: Number(p.valor) });
        m.set(p.despesa_id, arr);
      }
      return m;
    },
    staleTime: 30_000,
  });

  const exportRows = (allDespesas as unknown as T[])
    .filter((r) => !empresaFilter || r.empresa_id === empresaFilter)
    .filter((r) => !missaoFilter || r.missao_id === missaoFilter);

  const totalHoje = useMemo(() => {
    const hoje = new Date().toLocaleDateString("sv-SE");
    return exportRows
      .filter((r) => r.data_vencimento === hoje && r.status !== "pago" && r.status !== "cancelado")
      .reduce((acc, r) => acc + Math.max(0, Number(r.valor) - Number(r.valor_pago ?? 0)), 0);
  }, [exportRows]);

  const contratoLabel = (id: string | null) => {
    if (!id) return "—";
    const c = contratos?.find((x) => x.id === id);
    return c ? `${c.numero ?? ""} ${c.cliente}`.trim() : "—";
  };

  return (
    <PageContainer>
      <PageHeader
        title="Despesas"
        description="Contas a pagar. O status é calculado automaticamente a partir dos pagamentos registrados."
        actions={
          <ExportButton<any>
            title="Despesas"
            filename="despesas"
            rows={exportRows as any}
            columns={[
              { header: "ID", accessor: (r: T) => r.id },
              { header: "Descrição", accessor: (r: T) => r.descricao },
              { header: "Categoria", accessor: (r: T) => r.categoria_personalizada ?? r.categoria.replace(/_/g, " ") },
              { header: "Empresa", accessor: (r: T) => nomeById(empresas, r.empresa_id) },
              { header: "Missão", accessor: (r: T) => nomeById(missoes, r.missao_id) },
              { header: "Contrato", accessor: (r: T) => contratoLabel(r.contrato_id) },
              { header: "Fornecedor", accessor: (r: T) => nomeById(fornecedores, r.fornecedor_id) },
              { header: "Banco", accessor: (r: T) => r.banco ?? "—" },
              { header: "Valor", accessor: (r: T) => formatCurrency(Number(r.valor)) },
              { header: "Valor pago", accessor: (r: T) => formatCurrency(Number(r.valor_pago ?? 0)) },
              { header: "Valor em aberto", accessor: (r: T) => formatCurrency(Math.max(0, Number(r.valor) - Number(r.valor_pago ?? 0))) },
              { header: "Parcela", accessor: (r: T) => r.parcelas > 1 ? `${r.numero_parcela}/${r.parcelas}` : "Única" },
              { header: "Total de parcelas", accessor: (r: T) => r.parcelas },
              { header: "Número da parcela", accessor: (r: T) => r.numero_parcela },
              { header: "Frequência", accessor: (r: T) => r.frequencia },
              { header: "Data de vencimento", accessor: (r: T) => formatDate(r.data_vencimento) },
              { header: "Data de pagamento", accessor: (r: T) => formatDate(r.data_pagamento) },
              { header: "Status", accessor: (r: T) => r.status },
              { header: "Forma(s) de pagamento", accessor: (r: T) => {
                const ps = pagamentosMap.get(r.id) ?? [];
                if (ps.length === 0) return "—";
                return Array.from(new Set(ps.map((p) => p.forma))).join(", ");
              } },
              { header: "Pagamentos registrados", accessor: (r: T) => {
                const ps = pagamentosMap.get(r.id) ?? [];
                if (ps.length === 0) return "—";
                return ps.map((p) => `${formatDate(p.data)} ${formatCurrency(p.valor)} (${p.forma})`).join(" | ");
              } },
              { header: "Anexos", accessor: (r: T) => {
                const ax = anexosMap.get(r.id) ?? [];
                if (ax.length === 0) return "—";
                return ax.map((a) => `${a.nome} [${a.path}]`).join(" | ");
              } },
              { header: "Observações", accessor: (r: T) => r.observacoes ?? "—" },
              { header: "ID pai (parcela)", accessor: (r: T) => r.parent_id ?? "—" },
              { header: "Criado em", accessor: (r: T) => formatDate((r as any).created_at) },
              { header: "Atualizado em", accessor: (r: T) => formatDate((r as any).updated_at) },
            ]}
          />
        }
      />

      <KpiCard
        label="Total a pagar hoje"
        value={formatCurrency(totalHoje)}
        hint={empresaFilter ? "Filtrado pela empresa selecionada" : "Todas as empresas"}
        icon={<CalendarClock className="size-5" />}
        tone="warning"
      />
      <DataTable<T>
        table="despesas" title="Despesa" searchFields={["descricao"]}
        defaultValues={{ status: "em_aberto", descricao: "", categoria: "outros", categoria_personalizada: null, parcelas: 1, frequencia: "mensal" }}
        filter={(row) => (!empresaFilter || row.empresa_id === empresaFilter) && (!missaoFilter || row.missao_id === missaoFilter)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <EmpresaFilter value={empresaFilter} onChange={(v) => setEmpresaFilter(v)} />
            <div className="flex items-center gap-2 min-w-[200px]">
              <Target className="size-4 text-muted-foreground shrink-0" />
              <SelectField
                label=""
                value={missaoFilter === "" ? "__all__" : missaoFilter}
                onChange={(v) => setMissaoFilter(v === "__all__" ? "" : v)}
                options={[
                  { value: "__all__", label: "Todas as missões" },
                  ...(missoes ?? []).map((m) => ({ value: m.id, label: m.nome })),
                ]}
              />
            </div>
          </div>
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
          { key: "categoria", label: "Categoria", render: (r) => <span className="capitalize">{r.categoria_personalizada ?? r.categoria.replace(/_/g, " ")}</span> },
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
            <SelectField label="Categoria" value={values.categoria} onChange={(v) => setValues({ ...values, categoria: v, categoria_personalizada: v === "outros" ? values.categoria_personalizada : null })} options={CATEGORIAS} />
            {values.categoria === "outros" && (
              <TextField label="Categoria personalizada" value={values.categoria_personalizada ?? ""} onChange={(v) => setValues({ ...values, categoria_personalizada: v })} />
            )}

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
            <SelectField label="Banco" value={values.banco ?? ""} onChange={(v) => setValues({ ...values, banco: v })}
              options={(contas ?? []).map((c) => ({ value: contaLabel(c), label: contaLabel(c) }))} />
            <div className="col-span-2">
              <TextField label="Descrição" value={values.descricao} onChange={(v) => setValues({ ...values, descricao: v })} />
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
