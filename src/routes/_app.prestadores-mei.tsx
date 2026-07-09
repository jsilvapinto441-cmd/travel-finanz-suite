import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, CurrencyField, SelectField } from "@/components/form-fields";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ExportButton } from "@/components/export-button";
import { useContasBancariasComEmpresa } from "@/lib/bancos";

export const Route = createFileRoute("/_app/prestadores-mei")({ component: Page });

const CATEGORIA = "prestador_mei";

const METODOS_PAGAMENTO = [
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "link_pagamento", label: "Link de pagamento" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "deposito", label: "Depósito" },
  { value: "ted", label: "TED" },
  { value: "transferencia_bancaria", label: "Transferência bancária" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];

type T = {
  id: string;
  descricao: string;
  categoria: string;
  nome_empresa: string | null;
  numero_nota_fiscal: string | null;
  metodo_pagamento: string | null;
  banco: string | null;
  valor: number;
  valor_pago: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  parcelas: number;
  frequencia: string;
};

function Page() {
  const { data: contas } = useContasBancariasComEmpresa({ ativas: true });

  const { data: allRows = [] } = useQuery({
    queryKey: ["despesas-export-prestador-mei"],
    queryFn: async () =>
      (await supabase.from("despesas").select("*").eq("categoria", CATEGORIA).order("created_at", { ascending: false })).data ?? [],
    staleTime: 30_000,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Prestadores de Serviço (MEI)"
        description="Lançamentos são contabilizados automaticamente como despesas."
        actions={
          <ExportButton<T>
            title="Prestadores MEI"
            filename="prestadores-mei"
            rows={allRows as unknown as T[]}
            columns={[
              { header: "Nome da empresa", accessor: (r) => r.nome_empresa ?? r.descricao },
              { header: "Nota fiscal", accessor: (r) => r.numero_nota_fiscal ?? "—" },
              { header: "Valor pago", accessor: (r) => formatCurrency(Number(r.valor)) },
              { header: "Método de pagamento", accessor: (r) => r.metodo_pagamento ?? "—" },
              { header: "Banco", accessor: (r) => r.banco ?? "—" },
              { header: "Vencimento", accessor: (r) => formatDate(r.data_vencimento) },
              { header: "Status", accessor: (r) => r.status },
            ]}
          />
        }
      />

      <DataTable<T>
        table="despesas"
        title="Prestador MEI"
        searchFields={["nome_empresa", "numero_nota_fiscal", "descricao"]}
        filter={(row) => row.categoria === CATEGORIA}
        defaultValues={{
          categoria: CATEGORIA,
          status: "em_aberto",
          parcelas: 1,
          frequencia: "mensal",
          descricao: "",
        }}
        columns={[
          { key: "nome_empresa", label: "Nome da empresa", render: (r) => <span className="font-medium">{r.nome_empresa ?? r.descricao}</span> },
          { key: "numero_nota_fiscal", label: "Nota fiscal", render: (r) => r.numero_nota_fiscal ?? "—" },
          { key: "valor", label: "Valor pago", render: (r) => formatCurrency(Number(r.valor)) },
          { key: "metodo_pagamento", label: "Método", render: (r) => r.metodo_pagamento ?? "—" },
          { key: "banco", label: "Banco", render: (r) => r.banco ?? "—" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <TextField label="Nome da empresa" value={values.nome_empresa} required
                onChange={(v) => setValues({ ...values, nome_empresa: v, descricao: v })} />
            </div>
            <TextField label="Cadastro de nota fiscal" value={values.numero_nota_fiscal}
              onChange={(v) => setValues({ ...values, numero_nota_fiscal: v })} />
            <CurrencyField label="Valor pago" value={values.valor}
              onChange={(v) => setValues({ ...values, valor: v })} />
            <SelectField label="Método de pagamento" value={values.metodo_pagamento ?? ""}
              onChange={(v) => setValues({ ...values, metodo_pagamento: v })}
              options={METODOS_PAGAMENTO} />
            <SelectField label="Banco" value={values.banco ?? ""}
              onChange={(v) => setValues({ ...values, banco: v })}
              options={(contas ?? []).map((c) => ({ value: c.label, label: c.label }))} />
            <TextField label="Data de vencimento" type="date" value={values.data_vencimento}
              onChange={(v) => setValues({ ...values, data_vencimento: v })} />
          </div>
        )}
      />
    </PageContainer>
  );
}
