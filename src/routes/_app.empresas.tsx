import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, SelectField } from "@/components/form-fields";
import { ExportButton } from "@/components/export-button";
import { useContasBancarias, contaLabel } from "@/lib/bancos";

export const Route = createFileRoute("/_app/empresas")({ component: Page });

type Empresa = { id: string; nome: string; razao_social: string | null; cnpj: string | null; cor: string | null; ativo: boolean; conta_bancaria_id: string | null };

function Page() {
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-export"],
    queryFn: async () => (await supabase.from("empresas").select("id,nome,razao_social,cnpj,cor,ativo,conta_bancaria_id").order("nome")).data ?? [],
    staleTime: 30_000,
  });

  const { data: contas = [] } = useContasBancarias();
  const contaMap = new Map(contas.map((c) => [c.id, contaLabel(c)]));

  const contaOptions = [
    { value: "__none__", label: "Nenhuma conta" },
    ...contas.map((c) => ({ value: c.id, label: contaLabel(c) })),
  ];

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
              { header: "Banco Principal", accessor: (r) => contaMap.get(r.conta_bancaria_id ?? "") ?? "—" },
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
          { key: "banco", label: "Banco Principal", render: (r) => <span className="text-sm text-muted-foreground">{contaMap.get(r.conta_bancaria_id ?? "") ?? "—"}</span> },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nome" value={values.nome} onChange={(v) => setValues({ ...values, nome: v })} required />
            <TextField label="Cor" value={values.cor ?? "#0d7a5f"} onChange={(v) => setValues({ ...values, cor: v })} type="color" />
            <TextField label="Razão Social" value={values.razao_social} onChange={(v) => setValues({ ...values, razao_social: v })} />
            <TextField label="CNPJ" value={values.cnpj} onChange={(v) => setValues({ ...values, cnpj: v })} />
            <div className="col-span-2">
              <SelectField
                label="Conta Bancária Principal"
                value={values.conta_bancaria_id ?? "__none__"}
                onChange={(v) => setValues({ ...values, conta_bancaria_id: v === "__none__" ? null : v })}
                options={contaOptions}
              />
            </div>
          </div>
        )}
      />
    </PageContainer>
  );
}
