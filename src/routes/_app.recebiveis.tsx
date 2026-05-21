import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, NumberField, CurrencyField, SelectField, TextAreaField, Field } from "@/components/form-fields";
import { Input } from "@/components/ui/input";
import { useEmpresas, useMissoes, useContratos, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";
import { CalendarDays, Receipt, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/recebiveis")({ component: Page });

type T = {
  id: string; empresa_id: string | null; missao_id: string | null; contrato_id: string | null;
  pagador: string; numero_fatura: string | null; valor_total: number; parcelas: number;
  valor_parcela: number; data_vencimento: string | null; data_recebimento: string | null;
  banco: string | null; status: string; categoria: string | null; observacoes: string | null;
  parent_id: string | null; numero_parcela: number; frequencia: string;
};

// ---------- helpers ----------
function pad(n: number) { return n.toString().padStart(2, "0"); }

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function lastDayOfMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

/** First parcel date from "day of month" — uses current month if day not yet passed, otherwise next month. */
function firstDateFromDay(dia: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  const today = now.getDate();
  if (dia < today) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const day = Math.min(dia, lastDayOfMonth(year, month));
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function addToDate(base: string, freq: string, n: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (freq === "diario") dt.setDate(dt.getDate() + n);
  else if (freq === "semanal") dt.setDate(dt.getDate() + n * 7);
  else if (freq === "quinzenal") dt.setDate(dt.getDate() + n * 15);
  else if (freq === "anual") dt.setFullYear(dt.getFullYear() + n);
  else { // mensal
    const targetMonth = dt.getMonth() + n;
    const targetYear = dt.getFullYear() + Math.floor(targetMonth / 12);
    const normMonth = ((targetMonth % 12) + 12) % 12;
    const targetDay = Math.min(d, lastDayOfMonth(targetYear, normMonth));
    return `${targetYear}-${pad(normMonth + 1)}-${pad(targetDay)}`;
  }
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Compute parcels with correct rounding on last installment. */
function computeParcels(total: number, n: number) {
  const safeN = Math.max(1, Math.floor(n || 1));
  const cents = Math.round((total || 0) * 100);
  const base = Math.floor(cents / safeN);
  const remainder = cents - base * safeN;
  return Array.from({ length: safeN }, (_, i) => {
    const valueCents = i === safeN - 1 ? base + remainder : base;
    return valueCents / 100;
  });
}

// ---------- custom form ----------
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
  // dia_vencimento derives from data_vencimento (existing record) or starts as today's day
  const initialDia = (() => {
    if (values.data_vencimento) {
      const d = String(values.data_vencimento).slice(0, 10).split("-")[2];
      return Number(d) || new Date().getDate();
    }
    return new Date().getDate();
  })();
  const [diaVencimento, setDiaVencimento] = useState<number>(initialDia);

  const total = Number(values.valor_total ?? 0);
  const parcelas = Math.max(1, Number(values.parcelas ?? 1));
  const frequencia = values.frequencia ?? "mensal";

  // Compute parcel values + dates (reactive)
  const parcelaValores = useMemo(() => computeParcels(total, parcelas), [total, parcelas]);
  const firstDate = useMemo(() => firstDateFromDay(Math.min(31, Math.max(1, diaVencimento || 1))), [diaVencimento]);
  const parcelaDatas = useMemo(
    () => Array.from({ length: parcelas }, (_, i) => addToDate(firstDate, frequencia, i)),
    [firstDate, frequencia, parcelas]
  );

  // Sync computed valor_parcela + data_vencimento back to form state
  useEffect(() => {
    const novoValorParcela = parcelaValores[0] ?? 0;
    const novaData = parcelaDatas[0] ?? null;
    setValues((prev) => {
      if (prev.valor_parcela === novoValorParcela && prev.data_vencimento === novaData) return prev;
      return { ...prev, valor_parcela: novoValorParcela, data_vencimento: novaData };
    });
  }, [parcelaValores, parcelaDatas, setValues]);

  const showDetalhes = parcelas >= 1 && total > 0;

  return (
    <div className="space-y-6">
      {/* Bloco 1: dados principais */}
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Pagador" value={values.pagador} onChange={(v) => setValues({ ...values, pagador: v })} required />
        <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
          options={empresas.map((e) => ({ value: e.id, label: e.nome }))} />
        <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v })}
          options={missoes.map((e) => ({ value: e.id, label: e.nome }))} />
        <SelectField label="Contrato" value={values.contrato_id ?? ""} onChange={(v) => setValues({ ...values, contrato_id: v })}
          options={contratos.map((c) => ({ value: c.id, label: `${c.numero ?? ""} ${c.cliente}` }))} />
      </div>

      {/* Bloco 2: cálculo */}
      <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
          <Sparkles className="size-3.5" /> Cálculo automático
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CurrencyField label="Valor Total" value={values.valor_total} onChange={(v) => setValues({ ...values, valor_total: v })} />
          <NumberField label="Parcelas" value={values.parcelas} onChange={(v) => setValues({ ...values, parcelas: Math.max(1, Math.floor(v || 1)) })} step="1" />
          <SelectField label="Frequência" value={frequencia} onChange={(v) => setValues({ ...values, frequencia: v })}
            options={[
              { value: "diario", label: "Diário" },
              { value: "semanal", label: "Semanal" },
              { value: "quinzenal", label: "Quinzenal" },
              { value: "mensal", label: "Mensal" },
              { value: "anual", label: "Anual" },
            ]} />
          <Field label="Dia do vencimento">
            <Input type="number" min={1} max={31} value={diaVencimento}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setDiaVencimento(Math.min(31, Math.max(1, Math.floor(n))));
              }}
            />
          </Field>
        </div>

        {showDetalhes && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor por parcela</div>
              <div className="text-sm font-semibold tabular-nums">{formatCurrency(parcelaValores[0] ?? 0)}</div>
            </div>
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">1ª parcela em</div>
              <div className="text-sm font-semibold tabular-nums">{formatDate(parcelaDatas[0] ?? null)}</div>
            </div>
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Última parcela em</div>
              <div className="text-sm font-semibold tabular-nums">{formatDate(parcelaDatas[parcelas - 1] ?? null)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Bloco 3: detalhamento (só aparece após parcelas definidas) */}
      {showDetalhes && (
        <div className="rounded-lg border border-border overflow-hidden animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
              <CalendarDays className="size-3.5" /> Detalhamento das parcelas
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {parcelas}× — Total {formatCurrency(total)}
            </div>
          </div>

          {/* Nº Fatura — aparece somente após definir parcelas, dentro do detalhamento */}
          <div className="px-4 pt-4">
            <Field label="Nº Fatura (base)">
              <div className="relative">
                <Receipt className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={values.numero_fatura ?? ""}
                  onChange={(e) => setValues({ ...values, numero_fatura: e.target.value })}
                  placeholder="Ex: NF-2026-001"
                />
              </div>
            </Field>
          </div>

          <div className="overflow-x-auto px-2 pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-2 py-2 font-medium">#</th>
                  <th className="text-left px-2 py-2 font-medium">Nº Fatura</th>
                  <th className="text-right px-2 py-2 font-medium">Valor</th>
                  <th className="text-right px-2 py-2 font-medium">Pago</th>
                  <th className="text-right px-2 py-2 font-medium">Restante</th>
                  <th className="text-left px-2 py-2 font-medium">Vencimento</th>
                  <th className="text-left px-2 py-2 font-medium">Status</th>
                  <th className="text-left px-2 py-2 font-medium">Banco</th>
                  <th className="text-left px-2 py-2 font-medium">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {parcelaValores.map((v, i) => (
                  <tr key={i} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{i + 1}/{parcelas}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {values.numero_fatura ? `${values.numero_fatura}-${pad(i + 1)}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums">{formatCurrency(v)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(0)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(v)}</td>
                    <td className="px-2 py-2 tabular-nums">{formatDate(parcelaDatas[i])}</td>
                    <td className="px-2 py-2"><StatusBadge status="em_aberto" /></td>
                    <td className="px-2 py-2 text-muted-foreground">{values.banco || "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{values.categoria || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bloco 4: complementares */}
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Banco" value={values.banco} onChange={(v) => setValues({ ...values, banco: v })} />
        <TextField label="Categoria" value={values.categoria} onChange={(v) => setValues({ ...values, categoria: v })} />
        <TextField label="Recebimento (opcional)" value={values.data_recebimento} onChange={(v) => setValues({ ...values, data_recebimento: v })} type="date" />
        <SelectField label="Status" value={values.status ?? "em_aberto"} onChange={(v) => setValues({ ...values, status: v })}
          options={[
            { value: "em_aberto", label: "Em aberto" },
            { value: "pago", label: "Pago" },
            { value: "atrasado", label: "Atrasado" },
            { value: "cancelado", label: "Cancelado" },
          ]} />
        <div className="col-span-2">
          <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
        </div>
      </div>
    </div>
  );
}

function Page() {
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  const { data: contratos } = useContratos();
  return (
    <PageContainer>
      <PageHeader title="Recebíveis" description="Contas a receber. Lançamentos parcelados geram parcelas filhas automaticamente." />
      <DataTable<T>
        table="recebiveis" title="Recebível" searchFields={["pagador", "numero_fatura"]}
        defaultValues={{ status: "em_aberto", parcelas: 1, frequencia: "mensal", data_vencimento: todayISO() }}
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
          <RecebivelForm
            values={values}
            setValues={setValues}
            empresas={empresas ?? []}
            missoes={missoes ?? []}
            contratos={contratos ?? []}
          />
        )}
      />
    </PageContainer>
  );
}
