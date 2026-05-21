import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, NumberField, CurrencyField, SelectField, TextAreaField } from "@/components/form-fields";
import { useEmpresas, useMissoes, useContratos, useFornecedores, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";

export const Route = createFileRoute("/_app/despesas")({ component: Page });

type T = {
  id: string; empresa_id: string | null; missao_id: string | null; contrato_id: string | null;
  fornecedor_id: string | null; descricao: string; categoria: string; valor: number;
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
  return (
    <PageContainer>
      <PageHeader title="Despesas" description="Contas a pagar. Despesas parceladas geram as próximas automaticamente." />
      <DataTable<T>
        table="despesas" title="Despesa" searchFields={["descricao"]}
        defaultValues={{ status: "em_aberto", categoria: "outros", parcelas: 1, frequencia: "mensal" }}
        columns={[
          { key: "descricao", label: "Descrição", render: (r) => (
            <div>
              <div className="font-medium">{r.descricao}</div>
              {r.parcelas > 1 && <div className="text-xs text-muted-foreground">Parcela {r.numero_parcela}/{r.parcelas}</div>}
            </div>
          ) },
          { key: "categoria", label: "Categoria", render: (r) => <span className="capitalize">{r.categoria.replace(/_/g, " ")}</span> },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          { key: "valor", label: "Valor", render: (r) => formatCurrency(r.valor) },
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
            <TextField label="Pagamento" value={values.data_pagamento} onChange={(v) => setValues({ ...values, data_pagamento: v })} type="date" />
            <TextField label="Banco" value={values.banco} onChange={(v) => setValues({ ...values, banco: v })} />
            <SelectField label="Status" value={values.status} onChange={(v) => setValues({ ...values, status: v })}
              options={[
                { value: "em_aberto", label: "Em aberto" }, { value: "pago", label: "Pago" },
                { value: "atrasado", label: "Atrasado" }, { value: "cancelado", label: "Cancelado" },
              ]} />
            <div className="col-span-2">
              <TextField label="Descrição" value={values.descricao} onChange={(v) => setValues({ ...values, descricao: v })} required />
            </div>
            <div className="col-span-2">
              <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
            </div>

          </div>
        )}
      />
    </PageContainer>
  );
}
