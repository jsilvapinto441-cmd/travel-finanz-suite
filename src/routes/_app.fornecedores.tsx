import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/form-fields";

export const Route = createFileRoute("/_app/fornecedores")({ component: Page });

type T = { id: string; nome: string; cnpj: string | null; responsavel: string | null; telefone: string | null; email: string | null };

function Page() {
  return (
    <PageContainer>
      <PageHeader title="Fornecedores" description="Empresas consolidadoras e parceiros." />
      <DataTable<T>
        table="fornecedores" title="Fornecedor" searchFields={["nome", "cnpj", "responsavel"]} orderBy="nome" ascending
        columns={[
          { key: "nome", label: "Nome", render: (r) => <span className="font-medium">{r.nome}</span> },
          { key: "cnpj", label: "CNPJ" },
          { key: "responsavel", label: "Responsável" },
          { key: "telefone", label: "Telefone" },
          { key: "email", label: "Email" },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nome" value={values.nome} onChange={(v) => setValues({ ...values, nome: v })} required />
            <TextField label="CNPJ" value={values.cnpj} onChange={(v) => setValues({ ...values, cnpj: v })} />
            <TextField label="Responsável" value={values.responsavel} onChange={(v) => setValues({ ...values, responsavel: v })} />
            <TextField label="Telefone" value={values.telefone} onChange={(v) => setValues({ ...values, telefone: v })} />
            <TextField label="Email" value={values.email} onChange={(v) => setValues({ ...values, email: v })} type="email" />
          </div>
        )}
      />
    </PageContainer>
  );
}
