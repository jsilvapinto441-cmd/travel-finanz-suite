import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, SelectField } from "@/components/form-fields";
import { useEmpresas, nomeById } from "@/lib/lookups";
import { EmpresaFilter } from "@/components/empresa-filter";
import { ExportButton } from "@/components/export-button";

export const Route = createFileRoute("/_app/fornecedores")({ component: Page });

type T = { id: string; nome: string; cnpj: string | null; responsavel: string | null; telefone: string | null; email: string | null; empresa_id: string | null };

function Page() {
  const { data: empresas } = useEmpresas();
  const [empresaFilter, setEmpresaFilter] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["fornecedores-export"],
    queryFn: async () => (await supabase.from("fornecedores").select("id,nome,cnpj,responsavel,telefone,email,empresa_id").order("nome")).data ?? [],
    staleTime: 30_000,
  });
  const exportRows = (rows as T[]).filter((r) => !empresaFilter || r.empresa_id === empresaFilter);

  return (
    <PageContainer>
      <PageHeader
        title="Fornecedores"
        description="Empresas consolidadoras e parceiros."
        actions={
          <ExportButton<T>
            title="Fornecedores"
            filename="fornecedores"
            rows={exportRows}
            columns={[
              { header: "Nome", accessor: "nome" },
              { header: "CNPJ", accessor: "cnpj" },
              { header: "Responsável", accessor: "responsavel" },
              { header: "Telefone", accessor: "telefone" },
              { header: "Email", accessor: "email" },
              { header: "Empresa", accessor: (r) => nomeById(empresas, r.empresa_id) },
            ]}
          />
        }
      />
      <DataTable<T>
        table="fornecedores" title="Fornecedor" searchFields={["nome", "cnpj", "responsavel"]} orderBy="nome" ascending
        filter={(row) => !empresaFilter || row.empresa_id === empresaFilter}
        toolbar={
          <EmpresaFilter value={empresaFilter} onChange={(v) => setEmpresaFilter(v)} />
        }
        columns={[
          { key: "nome", label: "Nome", render: (r) => <span className="font-medium">{r.nome}</span> },
          { key: "cnpj", label: "CNPJ" },
          { key: "responsavel", label: "Responsável" },
          { key: "telefone", label: "Telefone" },
          { key: "email", label: "Email" },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nome" value={values.nome} onChange={(v) => setValues({ ...values, nome: v })} required />
            <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })} options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
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
