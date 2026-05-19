import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, TextAreaField, SelectField } from "@/components/form-fields";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/missoes")({ component: Page });

type T = { id: string; nome: string; descricao: string | null; status: string; observacoes: string | null };

function Page() {
  return (
    <PageContainer>
      <PageHeader title="Missões" description="Categorias operacionais e comerciais." />
      <DataTable<T>
        table="missoes" title="Missão" searchFields={["nome"]} orderBy="nome" ascending
        defaultValues={{ status: "ativo" }}
        columns={[
          { key: "nome", label: "Nome", render: (r) => <span className="font-medium">{r.nome}</span> },
          { key: "descricao", label: "Descrição" },
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
