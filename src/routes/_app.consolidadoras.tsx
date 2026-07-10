import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, CurrencyField, TextAreaField, SelectField, Field } from "@/components/form-fields";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ExportButton } from "@/components/export-button";
import { useContasBancariasComEmpresa } from "@/lib/bancos";

export const Route = createFileRoute("/_app/consolidadoras")({ component: Page });

type T = {
  id: string;
  nome: string;
  documento: string | null;
  valor_contratado: number;
  banco: string | null;
  observacoes: string | null;
  ativo: boolean;
};

function Page() {
  const { data: contas } = useContasBancariasComEmpresa({ ativas: true });

  const { data: allRows = [] } = useQuery({
    queryKey: ["consolidadoras-export"],
    queryFn: async () =>
      ((await (supabase as any).from("consolidadoras").select("*").order("nome")).data ?? []) as T[],
    staleTime: 30_000,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Consolidadoras"
        description="Cadastro das consolidadoras. Este módulo não gera despesas automáticas — o custo é contabilizado apenas quando uma despesa é lançada na categoria Consolidador."
        actions={
          <ExportButton<T>
            title="Consolidadoras"
            filename="consolidadoras"
            rows={allRows}
            columns={[
              { header: "Nome", accessor: "nome" },
              { header: "Documento", accessor: (r) => r.documento ?? "—" },
              { header: "Valor contratado", accessor: (r) => formatCurrency(Number(r.valor_contratado)) },
              { header: "Banco", accessor: (r) => r.banco ?? "—" },
              { header: "Status", accessor: (r) => (r.ativo ? "Ativo" : "Inativo") },
            ]}
          />
        }
      />

      <DataTable<T>
        table="consolidadoras"
        title="Consolidadora"
        searchFields={["nome", "documento"]}
        orderBy="nome"
        ascending
        defaultValues={{ ativo: true, valor_contratado: 0 }}
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
          { key: "documento", label: "Documento", render: (r) => r.documento ?? "—" },
          { key: "valor_contratado", label: "Valor contratado", render: (r) => formatCurrency(Number(r.valor_contratado)) },
          { key: "banco", label: "Banco", render: (r) => r.banco ?? "—" },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <TextField label="Nome" value={values.nome} required
                onChange={(v) => setValues({ ...values, nome: v })} />
            </div>
            <TextField label="Documento (CNPJ/CPF)" value={values.documento}
              onChange={(v) => setValues({ ...values, documento: v })} />
            <CurrencyField label="Valor contratado" value={values.valor_contratado}
              onChange={(v) => setValues({ ...values, valor_contratado: v })} />
            <SelectField label="Banco" value={values.banco ?? ""}
              onChange={(v) => setValues({ ...values, banco: v })}
              options={(contas ?? []).map((c) => ({ value: c.label, label: c.label }))} />
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
              Este cadastro é apenas informativo. Para lançar um pagamento, acesse
              <strong> Despesas → Nova Despesa</strong> e selecione a categoria <strong>Consolidador</strong>.
            </p>
          </div>
        )}
      />
    </PageContainer>
  );
}
