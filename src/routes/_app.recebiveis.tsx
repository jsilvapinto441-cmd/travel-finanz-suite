import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, CurrencyField, SelectField, TextAreaField, Field } from "@/components/form-fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEmpresas, useMissoes, useContratos, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";
import { PagamentoDialog } from "@/components/pagamento-dialog";
import { CircleDollarSign, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/recebiveis")({ component: Page });

type T = {
  id: string;
  empresa_id: string | null;
  missao_id: string | null;
  contrato_id: string | null;
  pagador: string;
  numero_fatura: string | null;
  valor_total: number;
  parcelas: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string | null;
  data_recebimento: string | null;
  banco: string | null;
  status: string;
  categoria: string | null;
  observacoes: string | null;
  parent_id: string | null;
  numero_parcela: number;
  frequencia: string;
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <Input value={value} readOnly className="bg-muted/40 cursor-not-allowed" />
    </Field>
  );
}

function RecebivelForm({
  values, setValues,
  empresas, missoes, contratos,
}: {
  values: Partial<T>;
  setValues: React.Dispatch<React.SetStateAction<Partial<T>>>;
  empresas: { id: string; nome: string }[];
  missoes: { id: string; nome: string }[];
  contratos: { id: string; numero: string | null; cliente: string }[];
}) {
  const linkedContrato = useMemo(
    () => contratos.find((c) => c.id === values.contrato_id) ?? null,
    [contratos, values.contrato_id]
  );
  const linked = !!linkedContrato;

  return (
    <div className="space-y-5">
      {linked ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-primary font-semibold">Recebível vinculado a contrato</div>
            <Link to="/contratos" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <ExternalLink className="size-3" /> Ver contrato
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Contrato" value={`${linkedContrato!.numero ?? "—"} ${linkedContrato!.cliente}`} />
            <ReadOnlyField label="Pagador" value={values.pagador ?? ""} />
            <ReadOnlyField label="Empresa" value={nomeById(empresas, values.empresa_id ?? null)} />
            <ReadOnlyField label="Missão" value={nomeById(missoes, values.missao_id ?? null)} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Para alterar valor, parcelas ou datas, edite o contrato. Pagamentos são registrados pelo botão "Registrar pagamento" na lista.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Recebível avulso</div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Pagador" value={values.pagador} onChange={(v) => setValues({ ...values, pagador: v })} required />
            <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
              options={empresas.map((e) => ({ value: e.id, label: e.nome }))} />
            <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v })}
              options={missoes.map((e) => ({ value: e.id, label: e.nome }))} />
            <SelectField label="Contrato (opcional)" value={values.contrato_id ?? ""} onChange={(v) => setValues({ ...values, contrato_id: v })}
              options={contratos.map((c) => ({ value: c.id, label: `${c.numero ?? ""} ${c.cliente}` }))} />
            <CurrencyField label="Valor" value={values.valor_total} onChange={(v) => setValues({ ...values, valor_total: v, valor_parcela: v })} />
            <TextField label="Vencimento" type="date" value={values.data_vencimento} onChange={(v) => setValues({ ...values, data_vencimento: v })} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Nº Fatura" value={values.numero_fatura} onChange={(v) => setValues({ ...values, numero_fatura: v })} />
        <TextField label="Banco" value={values.banco} onChange={(v) => setValues({ ...values, banco: v })} />
        <TextField label="Categoria" value={values.categoria} onChange={(v) => setValues({ ...values, categoria: v })} />
        <ReadOnlyField label="Valor pago (registrado)" value={formatCurrency(Number(values.valor_pago ?? 0))} />
        <div className="col-span-2">
          <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        O <strong>status</strong> é calculado automaticamente a partir dos pagamentos e do vencimento.
      </p>
    </div>
  );
}

function Page() {
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  const { data: contratos } = useContratos();

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<T | null>(null);

  return (
    <PageContainer>
      <PageHeader title="Recebíveis" description="Parcelas geradas pelos contratos + recebíveis avulsos." />
      <DataTable<T>
        table="recebiveis"
        title="Recebível"
        searchFields={["pagador", "numero_fatura"]}
        defaultValues={{ status: "em_aberto", parcelas: 1, frequencia: "mensal" }}
        extraRowActions={(row) => (
          <Button size="sm" variant="ghost"
            className="text-primary hover:bg-primary/10 h-8 px-2"
            onClick={(e) => { e.stopPropagation(); setPayTarget(row); setPayOpen(true); }}>
            <CircleDollarSign className="size-3.5 mr-1" />
            Pagamento
          </Button>
        )}
        columns={[
          {
            key: "pagador", label: "Pagador",
            render: (r) => (
              <div>
                <div className="font-medium">{r.pagador}</div>
                {r.parcelas > 1 && (
                  <div className="text-xs text-muted-foreground">
                    {r.numero_parcela === 0 ? "Entrada" : `Parcela ${r.numero_parcela}/${r.parcelas}`}
                  </div>
                )}
              </div>
            ),
          },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          { key: "numero_fatura", label: "Fatura" },
          {
            key: "valor", label: "Valor",
            render: (r) => {
              const v = Number(r.valor_parcela ?? r.valor_total);
              const pago = Number(r.valor_pago ?? 0);
              return (
                <div className="tabular-nums">
                  <div className="font-medium">{formatCurrency(v)}</div>
                  {pago > 0 && pago < v && (
                    <div className="text-[10px] text-success">Pago {formatCurrency(pago)}</div>
                  )}
                </div>
              );
            },
          },
          { key: "data_vencimento", label: "Vencimento", render: (r) => formatDate(r.data_vencimento) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "anexos", label: "Anexos", render: (r) => <AnexosCell entidade="recebiveis" entidade_id={r.id} /> },
        ]}
        renderForm={({ values, setValues }) => (
          <RecebivelForm values={values} setValues={setValues}
            empresas={empresas ?? []} missoes={missoes ?? []} contratos={contratos ?? []} />
        )}
      />

      <PagamentoDialog
        recebivel={payTarget}
        open={payOpen}
        onOpenChange={(v) => { setPayOpen(v); if (!v) setPayTarget(null); }}
      />
    </PageContainer>
  );
}
