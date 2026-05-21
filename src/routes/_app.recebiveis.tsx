import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, NumberField, CurrencyField, SelectField, TextAreaField } from "@/components/form-fields";
import { useEmpresas, useMissoes, useContratos, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";

export const Route = createFileRoute("/_app/recebiveis")({ component: Page });

type T = {
  id: string; empresa_id: string | null; missao_id: string | null; contrato_id: string | null;
  pagador: string; numero_fatura: string | null; valor_total: number; parcelas: number;
  valor_parcela: number; data_vencimento: string | null; data_recebimento: string | null;
  banco: string | null; status: string; categoria: string | null; observacoes: string | null;
  parent_id: string | null; numero_parcela: number; frequencia: string;
};

function Page() {
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  const { data: contratos } = useContratos();
  return (
    <PageContainer>
      <PageHeader title="Recebíveis" description="Contas a receber. Lançamentos parcelados geram parcelas filhas automaticamente." />
      <DataTable<T>
        table="recebiveis" title="Recebível" searchFields={["pagador", "numero_fatura"]}
        defaultValues={{ status: "em_aberto", parcelas: 1, frequencia: "mensal" }}
        columns={[
          { key: "pagador", label: "Pagador", render: (r) => (
            <div>
              <div className="font-medium">{r.pagador}</div>
              {r.parcelas > 1 && <div className="text-xs text-muted-foreground">Parcela {r.numero_parcela}/{r.parcelas}</div>}
            </div>
          ) },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          { key: "numero_fatura", label: "Fatura" },
          { key: "valor_total", label: "Valor", render: (r) => formatCurrency(r.valor_total) },
          { key: "data_vencimento", label: "Vencimento", render: (r) => formatDate(r.data_vencimento) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "anexos", label: "Anexos", render: (r) => <AnexosCell entidade="recebiveis" entidade_id={r.id} /> },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Pagador" value={values.pagador} onChange={(v) => setValues({ ...values, pagador: v })} required />
            <TextField label="Nº Fatura" value={values.numero_fatura} onChange={(v) => setValues({ ...values, numero_fatura: v })} />
            <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
              options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v })}
              options={(missoes ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            <SelectField label="Contrato" value={values.contrato_id ?? ""} onChange={(v) => setValues({ ...values, contrato_id: v })}
              options={(contratos ?? []).map((c) => ({ value: c.id, label: `${c.numero ?? ""} ${c.cliente}` }))} />
            <NumberField label="Valor Total" value={values.valor_total} onChange={(v) => setValues({ ...values, valor_total: v })} />
            <NumberField label="Parcelas" value={values.parcelas} onChange={(v) => setValues({ ...values, parcelas: v })} step="1" />
            <SelectField label="Frequência" value={values.frequencia ?? "mensal"} onChange={(v) => setValues({ ...values, frequencia: v })}
              options={[
                { value: "mensal", label: "Mensal" }, { value: "quinzenal", label: "Quinzenal" },
                { value: "semanal", label: "Semanal" }, { value: "anual", label: "Anual" },
              ]} />
            <NumberField label="Valor Parcela" value={values.valor_parcela} onChange={(v) => setValues({ ...values, valor_parcela: v })} />
            <TextField label="Vencimento" value={values.data_vencimento} onChange={(v) => setValues({ ...values, data_vencimento: v })} type="date" />
            <TextField label="Recebimento" value={values.data_recebimento} onChange={(v) => setValues({ ...values, data_recebimento: v })} type="date" />
            <TextField label="Banco" value={values.banco} onChange={(v) => setValues({ ...values, banco: v })} />
            <TextField label="Categoria" value={values.categoria} onChange={(v) => setValues({ ...values, categoria: v })} />
            <SelectField label="Status" value={values.status} onChange={(v) => setValues({ ...values, status: v })}
              options={[
                { value: "em_aberto", label: "Em aberto" }, { value: "pago", label: "Pago" },
                { value: "atrasado", label: "Atrasado" }, { value: "cancelado", label: "Cancelado" },
              ]} />
            <div className="col-span-2">
              <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
            </div>
          </div>
        )}
      />
    </PageContainer>
  );
}
