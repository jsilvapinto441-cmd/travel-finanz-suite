import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, CurrencyField, SelectField, TextAreaField, Field } from "@/components/form-fields";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ExportButton } from "@/components/export-button";
import { useContasBancariasComEmpresa } from "@/lib/bancos";
import { useEmpresas, useMissoes, nomeById } from "@/lib/lookups";
import { EmpresaFilter } from "@/components/empresa-filter";

export type ParceiroRow = {
  id: string;
  nome: string;
  empresa_id: string | null;
  missao_id?: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  banco: string | null;
  valor_contratado: number;
  observacoes: string | null;
  ativo: boolean;
};

interface Props {
  table: "fornecedores" | "prestadores_mei" | "consolidadoras";
  title: string;
  pageTitle: string;
  description: string;
  filename: string;
  /** Exibe campo e filtro de Missão (usado em Fornecedores). */
  showMissao?: boolean;
}

export function CadastroParceiro({ table, title, pageTitle, description, filename, showMissao }: Props) {
  const { data: contas } = useContasBancariasComEmpresa({ ativas: true });
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [missaoFilter, setMissaoFilter] = useState("");

  const { data: allRows = [] } = useQuery({
    queryKey: [`${table}-export`],
    queryFn: async () =>
      ((await (supabase as any).from(table).select("*").order("nome")).data ?? []) as ParceiroRow[],
    staleTime: 30_000,
  });
  const exportRows = allRows.filter(
    (r) =>
      (!empresaFilter || r.empresa_id === empresaFilter) &&
      (!showMissao || !missaoFilter || r.missao_id === missaoFilter),
  );

  const totalContratado = exportRows.reduce((sum, r) => sum + Number(r.valor_contratado ?? 0), 0);
  const totalAtivos = exportRows.filter((r) => r.ativo).reduce((sum, r) => sum + Number(r.valor_contratado ?? 0), 0);

  const empresaNome = empresaFilter ? nomeById(empresas, empresaFilter) : "Todas";
  const missaoNome = missaoFilter ? nomeById(missoes, missaoFilter) : "Todas";

  const summary = [
    { label: "Registros", value: String(exportRows.length) },
    { label: "Somatório geral", value: formatCurrency(totalContratado) },
    { label: "Somatório (ativos)", value: formatCurrency(totalAtivos) },
  ];
  const exportFilters = [
    { label: "Empresa", value: empresaNome },
    ...(showMissao ? [{ label: "Missão", value: missaoNome }] : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        title={pageTitle}
        description={description}
        actions={
          <ExportButton<ParceiroRow>
            title={pageTitle}
            filename={filename}
            rows={exportRows}
            summary={summary}
            filters={exportFilters}
            columns={[
              { header: "Nome", accessor: "nome" },
              { header: "Empresa", accessor: (r) => nomeById(empresas, r.empresa_id) },
              ...(showMissao
                ? [{ header: "Missão", accessor: (r: ParceiroRow) => nomeById(missoes, r.missao_id ?? null) }]
                : []),
              { header: "CNPJ", accessor: (r) => r.cnpj ?? "—" },
              { header: "Telefone", accessor: (r) => r.telefone ?? "—" },
              { header: "E-mail", accessor: (r) => r.email ?? "—" },
              { header: "Banco", accessor: (r) => r.banco ?? "—" },
              { header: "Valor contratado", accessor: (r) => formatCurrency(Number(r.valor_contratado)) },
              { header: "Status", accessor: (r) => (r.ativo ? "Ativo" : "Inativo") },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Registros filtrados</div>
          <div className="text-lg font-semibold tabular-nums">{exportRows.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Somatório geral</div>
          <div className="text-lg font-semibold tabular-nums text-primary">{formatCurrency(totalContratado)}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Somatório (ativos)</div>
          <div className="text-lg font-semibold tabular-nums">{formatCurrency(totalAtivos)}</div>
        </div>
      </div>

      <DataTable<ParceiroRow>
        table={table}
        title={title}
        searchFields={["nome", "cnpj", "email"]}
        orderBy="nome"
        ascending
        defaultValues={{ ativo: true, valor_contratado: 0 }}
        filter={(row) =>
          (!empresaFilter || row.empresa_id === empresaFilter) &&
          (!showMissao || !missaoFilter || row.missao_id === missaoFilter)
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <EmpresaFilter value={empresaFilter} onChange={setEmpresaFilter} />
            {showMissao && (
              <select
                value={missaoFilter}
                onChange={(e) => setMissaoFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todas as missões</option>
                {(missoes ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            )}
          </div>
        }
        columns={[
          {
            key: "nome", label: "Nome",
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.nome}</span>
                {!r.ativo && <Badge variant="outline" className="text-xs">Inativo</Badge>}
              </div>
            ),
          },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          ...(showMissao
            ? [{ key: "missao", label: "Missão", render: (r: ParceiroRow) => nomeById(missoes, r.missao_id ?? null) }]
            : []),
          { key: "cnpj", label: "CNPJ", render: (r) => r.cnpj ?? "—" },
          { key: "telefone", label: "Telefone", render: (r) => r.telefone ?? "—" },
          { key: "email", label: "E-mail", render: (r) => r.email ?? "—" },
          { key: "banco", label: "Banco", render: (r) => r.banco ?? "—" },
          { key: "valor_contratado", label: "Valor contratado", render: (r) => formatCurrency(Number(r.valor_contratado)) },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <TextField label="Nome" value={values.nome} required
                onChange={(v) => setValues({ ...values, nome: v })} />
            </div>
            <SelectField label="Empresa" value={values.empresa_id ?? ""}
              onChange={(v) => setValues({ ...values, empresa_id: v })}
              options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            {showMissao && (
              <SelectField label="Missão" value={values.missao_id ?? ""}
                onChange={(v) => setValues({ ...values, missao_id: v || null })}
                options={(missoes ?? []).map((m) => ({ value: m.id, label: m.nome }))} />
            )}
            <TextField label="CNPJ" value={values.cnpj}
              onChange={(v) => setValues({ ...values, cnpj: v })} />
            <TextField label="Telefone" value={values.telefone}
              onChange={(v) => setValues({ ...values, telefone: v })} />
            <TextField label="E-mail" value={values.email} type="email"
              onChange={(v) => setValues({ ...values, email: v })} />
            <SelectField label="Banco" value={values.banco ?? ""}
              onChange={(v) => setValues({ ...values, banco: v })}
              options={(contas ?? []).map((c) => ({ value: c.label, label: c.label }))} />
            <CurrencyField label="Valor contratado" value={values.valor_contratado}
              onChange={(v) => setValues({ ...values, valor_contratado: v })} />
            <Field label="Status">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={values.ativo ?? true}
                  onCheckedChange={(checked) => setValues({ ...values, ativo: !!checked })} />
                <span>{values.ativo ?? true ? "Ativo" : "Inativo"}</span>
              </label>
            </Field>
            <div className="col-span-2">
              <TextAreaField label="Observações" value={values.observacoes}
                onChange={(v) => setValues({ ...values, observacoes: v })} />
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground">
              Cadastro apenas informativo. O valor contratado não gera lançamentos financeiros automáticos.
              Para lançar um pagamento, acesse <strong>Despesas → Nova Despesa</strong>.
            </p>
          </div>
        )}
      />
    </PageContainer>
  );
}
