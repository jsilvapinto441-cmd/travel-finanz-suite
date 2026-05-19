import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, NumberField, SelectField, TextAreaField } from "@/components/form-fields";
import { useEmpresas, useMissoes, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/contratos")({ component: Page });

type T = {
  id: string; empresa_id: string | null; missao_id: string | null; cliente: string;
  numero: string | null; valor: number; data_inicio: string | null; data_fim: string | null;
  status: string; observacoes: string | null;
};

function Page() {
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  return (
    <PageContainer>
      <PageHeader title="Contratos" description="Contratos firmados com clientes." />
      <DataTable<T>
        table="contratos" title="Contrato" searchFields={["cliente", "numero"]}
        defaultValues={{ status: "ativo" }}
        columns={[
          { key: "numero", label: "Nº" },
          { key: "cliente", label: "Cliente", render: (r) => <span className="font-medium">{r.cliente}</span> },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          { key: "missao", label: "Missão", render: (r) => nomeById(missoes, r.missao_id) },
          { key: "valor", label: "Valor", render: (r) => formatCurrency(r.valor) },
          { key: "data_inicio", label: "Início", render: (r) => formatDate(r.data_inicio) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Cliente" value={values.cliente} onChange={(v) => setValues({ ...values, cliente: v })} required />
            <TextField label="Número" value={values.numero} onChange={(v) => setValues({ ...values, numero: v })} />
            <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
              options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v })}
              options={(missoes ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            <NumberField label="Valor" value={values.valor} onChange={(v) => setValues({ ...values, valor: v })} />
            <SelectField label="Status" value={values.status} onChange={(v) => setValues({ ...values, status: v })}
              options={[
                { value: "rascunho", label: "Rascunho" }, { value: "ativo", label: "Ativo" },
                { value: "concluido", label: "Concluído" }, { value: "cancelado", label: "Cancelado" },
              ]} />
            <TextField label="Data Início" value={values.data_inicio} onChange={(v) => setValues({ ...values, data_inicio: v })} type="date" />
            <TextField label="Data Fim" value={values.data_fim} onChange={(v) => setValues({ ...values, data_fim: v })} type="date" />
            <div className="col-span-2">
              <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
            </div>
          </div>
        )}
      />
    </PageContainer>
  );
}
