import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/form-fields";
import { ExportButton } from "@/components/export-button";

export const Route = createFileRoute("/_app/empresas")({ component: Page });

type Empresa = { id: string; nome: string; razao_social: string | null; cnpj: string | null; cor: string | null; ativo: boolean };

function Page() {
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-export"],
    queryFn: async () => (await supabase.from("empresas").select("id,nome,razao_social,cnpj,cor,ativo").order("nome")).data ?? [],
    staleTime: 30_000,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Empresas"
        description="Gerencie as 5 empresas do grupo PRODUZ."
        actions={
          <ExportButton<Empresa>
            title="Empresas"
            filename="empresas"
            rows={empresas as Empresa[]}
            columns={[
              { header: "Nome", accessor: "nome" },
              { header: "Razão Social", accessor: "razao_social" },
              { header: "CNPJ", accessor: "cnpj" },
              { header: "Status", accessor: (r) => (r.ativo ? "Ativa" : "Inativa") },
            ]}
          />
        }
      />
      <DataTable<Empresa>
        table="empresas" title="Empresa" searchFields={["nome", "cnpj"]} orderBy="nome" ascending
        columns={[
          { key: "cor", label: "", render: (r) => <span className="inline-block size-3 rounded-full" style={{ background: r.cor ?? "#0d7a5f" }} />, className: "w-8" },
          { key: "nome", label: "Nome", render: (r) => <span className="font-medium">{r.nome}</span> },
          { key: "razao_social", label: "Razão Social" },
          { key: "cnpj", label: "CNPJ" },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nome" value={values.nome} onChange={(v) => setValues({ ...values, nome: v })} required />
            <TextField label="Cor" value={values.cor ?? "#0d7a5f"} onChange={(v) => setValues({ ...values, cor: v })} type="color" />
            <TextField label="Razão Social" value={values.razao_social} onChange={(v) => setValues({ ...values, razao_social: v })} />
            <TextField label="CNPJ" value={values.cnpj} onChange={(v) => setValues({ ...values, cnpj: v })} />
          </div>
        )}
      />
    </PageContainer>
  );
}
