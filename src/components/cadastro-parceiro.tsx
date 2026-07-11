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
import { useEmpresas, nomeById } from "@/lib/lookups";
import { EmpresaFilter } from "@/components/empresa-filter";

export type ParceiroRow = {
  id: string;
  nome: string;
  empresa_id: string | null;
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
}

export function CadastroParceiro({ table, title, pageTitle, description, filename }: Props) {
  const { data: contas } = useContasBancariasComEmpresa({ ativas: true });
  const { data: empresas } = useEmpresas();
  const [empresaFilter, setEmpresaFilter] = useState("");

  const { data: allRows = [] } = useQuery({
    queryKey: [`${table}-export`],
    queryFn: async () =>
      ((await (supabase as any).from(table).select("*").order("nome")).data ?? []) as ParceiroRow[],
    staleTime: 30_000,
  });
  const exportRows = allRows.filter((r) => !empresaFilter || r.empresa_id === empresaFilter);

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
            columns={[
              { header: "Nome", accessor: "nome" },
              { header: "Empresa", accessor: (r) => nomeById(empresas, r.empresa_id) },
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

      <DataTable<ParceiroRow>
        table={table}
        title={title}
        searchFields={["nome", "cnpj", "email"]}
        orderBy="nome"
        ascending
        defaultValues={{ ativo: true, valor_contratado: 0 }}
        filter={(row) => !empresaFilter || row.empresa_id === empresaFilter}
        toolbar={<EmpresaFilter value={empresaFilter} onChange={setEmpresaFilter} />}
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
