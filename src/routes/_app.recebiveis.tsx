import { DatePicker } from "@/components/date-picker";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { TextField, CurrencyField, SelectField, TextAreaField, Field } from "@/components/form-fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { useEmpresas, useMissoes, useContratos, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate, formatPeriodoLabel, formatStatus } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";
import { PagamentoDialog } from "@/components/pagamento-dialog";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/use-debounce";
import { toast } from "sonner";
import {
  CircleDollarSign, ExternalLink, Plus, Pencil, Trash2, Search, Loader2,
} from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { deleteRecord, CONFIRM_DELETE_MESSAGE } from "@/lib/delete-record";
import { sanitizeUpdatePayload } from "@/lib/sanitize-update";
import { useContasBancariasComEmpresa, type ContaBancariaComEmpresa } from "@/lib/bancos";
import { EmpresaFilter } from "@/components/empresa-filter";
import { Target, CreditCard } from "lucide-react";
import { matchesQuery } from "@/lib/search-match";
import { sortByVencimento, sortRowsByVencimento } from "@/lib/sort-vencimento";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { FORMAS_PAGAMENTO_OPTIONS, formaPagamentoLabel, formaMatches } from "@/lib/formas-pagamento";
import {
  financialRecordMatchesScope,
  paymentsInFinancialScope,
  sumFinancialPayments,
  type FinancialPayment,
} from "@/lib/financial-report";
import { AbatimentosRecebivel, type AbatimentoDraft } from "@/components/abatimentos-recebivel";
import {
  tipoAbatimentoLabel, valorLiquido, valorOriginal, saldoLiquido, type Abatimento,
} from "@/lib/abatimentos";

export const Route = createFileRoute("/_app/recebiveis")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: search.status === "atrasado" || search.status === "em_aberto" || search.status === "pago"
      ? (search.status as "atrasado" | "em_aberto" | "pago")
      : undefined,
  }),
  component: Page,
});

const hoje = () => new Date().toISOString().slice(0, 10);
const isVencido = (status: string, vencimento: string | null | undefined) =>
  status !== "pago" && status !== "cancelado" && !!vencimento && vencimento.slice(0, 10) < hoje();

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
  total_abatimentos?: number | null;
  registros_pagamento?: Pagamento[];
  recebivel_abatimentos?: Abatimento[];
};

type Pagamento = FinancialPayment & {
  id: string;
  conta_bancaria_id: string | null;
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <Input value={value} readOnly className="bg-muted/40 cursor-not-allowed" />
    </Field>
  );
}

function RecebivelForm({
  values, setValues, empresas, missoes, contratos, contas, abatimentos, setAbatimentos,
}: {
  values: Partial<T>;
  setValues: React.Dispatch<React.SetStateAction<Partial<T>>>;
  empresas: { id: string; nome: string }[];
  missoes: { id: string; nome: string }[];
  contratos: { id: string; numero: string | null; cliente: string }[];
  contas: ContaBancariaComEmpresa[];
  abatimentos: AbatimentoDraft[];
  setAbatimentos: (rows: AbatimentoDraft[]) => void;
}) {
  const linkedContrato = useMemo(
    () => contratos.find((c) => c.id === values.contrato_id) ?? null,
    [contratos, values.contrato_id]
  );
  const linked = !!linkedContrato;

  return (
    <div className="space-y-5">
      <div className={`rounded-lg border p-4 space-y-3 ${linked ? "border-primary/30 bg-primary/5" : "border-border"}`}>
        <div className="flex items-center justify-between">
          <div className={`text-xs uppercase tracking-wider font-semibold ${linked ? "text-primary" : "text-muted-foreground"}`}>
            {linked ? "Recebível vinculado a contrato" : "Recebível avulso"}
          </div>
          {linked && (
            <Link to="/contratos" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <ExternalLink className="size-3" /> Ver contrato
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Contrato (opcional)" value={values.contrato_id ?? ""} onChange={(v) => setValues({ ...values, contrato_id: v || null })}
            options={contratos.map((c) => ({ value: c.id, label: `${c.numero ?? ""} ${c.cliente}` }))} placeholder="Sem contrato" />
          <TextField label="Pagador" value={values.pagador} onChange={(v) => setValues({ ...values, pagador: v })} required />
          <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v || null })}
            options={empresas.map((e) => ({ value: e.id, label: e.nome }))} />
          <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v || null })}
            options={missoes.map((e) => ({ value: e.id, label: e.nome }))} />
          <CurrencyField label="Valor" value={values.valor_total} onChange={(v) => setValues({ ...values, valor_total: v, valor_parcela: v })} />
          <TextField label="Vencimento" type="date" value={values.data_vencimento} onChange={(v) => setValues({ ...values, data_vencimento: v })} />
        </div>
      </div>


      <AbatimentosRecebivel
        valorOriginal={Number(values.valor_parcela ?? values.valor_total ?? 0)}
        rows={abatimentos}
        onChange={setAbatimentos}
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Nº Fatura" value={values.numero_fatura} onChange={(v) => setValues({ ...values, numero_fatura: v })} />
        <SelectField
          label="Banco"
          value={values.banco ?? ""}
          onChange={(v) => setValues({ ...values, banco: v })}
          options={contas.map((c) => ({ value: c.label, label: c.label }))}
        />
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

type Group = {
  key: string;
  cliente: string;
  contrato_id: string | null;
  contratoLabel: string | null;
  rows: T[];
  total: number;
  pago: number;
  restante: number;
  proximoVenc: string | null;
  countAberto: number;
  countVencido: number;
};

function buildGroups(
  rows: T[],
  contratos: { id: string; cliente: string; numero: string | null }[],
  scopedPayments: (row: T) => Pagamento[],
): Group[] {
  const map = new Map<string, Group>();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const r of rows) {
    const key = r.contrato_id ?? `avulso:${r.pagador}`;
    let g = map.get(key);
    if (!g) {
      const c = r.contrato_id ? contratos.find((x) => x.id === r.contrato_id) : null;
      g = {
        key,
        cliente: c?.cliente ?? r.pagador ?? "—",
        contrato_id: r.contrato_id,
        contratoLabel: c ? `${c.numero ?? ""} ${c.cliente}`.trim() : null,
        rows: [],
        total: 0, pago: 0, restante: 0,
        proximoVenc: null,
        countAberto: 0, countVencido: 0,
      };
      map.set(key, g);
    }
    g.rows.push(r);
    const v = Number(r.valor_parcela ?? r.valor_total ?? 0);
    const pago = sumFinancialPayments(scopedPayments(r));
    g.total += v;
    g.pago += pago;
    g.restante += Math.max(v - Number(r.valor_pago ?? 0), 0);

    if (r.status !== "pago" && r.data_vencimento) {
      const dv = new Date(r.data_vencimento);
      if (!g.proximoVenc || new Date(g.proximoVenc) > dv) g.proximoVenc = r.data_vencimento;
      if (dv < today) g.countVencido += 1;
      else g.countAberto += 1;
    } else if (r.status !== "pago") {
      g.countAberto += 1;
    }
  }

  for (const g of map.values()) {
    g.rows.sort((a, b) => {
      if (a.numero_parcela !== b.numero_parcela) return a.numero_parcela - b.numero_parcela;
      return (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? "");
    });
  }

  return Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
}

function Page() {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  const { data: contratos } = useContratos();
  const { data: contas } = useContasBancariasComEmpresa({ ativas: true });

  const [empresaFilter, setEmpresaFilter] = useState("");
  const [missaoFilter, setMissaoFilter] = useState("");
  const initialStatus = Route.useSearch().status;
  const [statusFilter, setStatusFilter] = useState<"" | "em_aberto" | "pago" | "atrasado">(initialStatus ?? "");
  const [formaFilter, setFormaFilter] = useState<string[]>([]);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 200);

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<T | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const defaultValues: Partial<T> = { status: "em_aberto", parcelas: 1, frequencia: "mensal" };
  const [values, setValues] = useState<Partial<T>>(defaultValues);
  const [abatimentos, setAbatimentos] = useState<AbatimentoDraft[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recebiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebiveis")
        .select("*, registros_pagamento(id, data_pagamento, valor, forma_pagamento, conta_bancaria_id), recebivel_abatimentos(id, recebivel_id, tipo, valor, descricao, data_abatimento)")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (empresaFilter) rows = rows.filter((r) => r.empresa_id === empresaFilter);
    if (missaoFilter) rows = rows.filter((r) => r.missao_id === missaoFilter);
    if (statusFilter === "pago") {
      rows = rows.filter((r) => r.status === "pago");
    } else if (statusFilter === "em_aberto") {
      rows = rows.filter((r) => r.status !== "pago" && r.status !== "cancelado");
    } else if (statusFilter === "atrasado") {
      rows = rows.filter((r) => isVencido(r.status, r.data_vencimento));
    }
    rows = rows.filter((r) => financialRecordMatchesScope({
      dueDate: r.data_vencimento,
      payments: r.registros_pagamento,
      period: { from: dataDe, to: dataAte },
      hasPaymentMethodFilter: formaFilter.length > 0,
      paymentMatches: (p) => formaMatches(p.forma_pagamento, formaFilter),
    }));
    if (search) {
      rows = rows.filter((r) => matchesQuery(r as unknown as Record<string, unknown>, search));
    }
    return sortByVencimento(rows);
  }, [data, search, empresaFilter, missaoFilter, statusFilter, dataDe, dataAte, formaFilter]);

  const scopedPayments = (row: T) => paymentsInFinancialScope(
    row.registros_pagamento,
    { from: dataDe, to: dataAte },
    (payment) => formaMatches(payment.forma_pagamento, formaFilter),
  );

  const groups = useMemo(
    () => buildGroups(filtered, contratos ?? [], scopedPayments),
    [filtered, contratos, dataDe, dataAte, formaFilter]
  );

  const totaisPeriodo = useMemo(() => {
    let total = 0, recebido = 0;
    for (const r of filtered) {
      if (r.status === "cancelado") continue;
      total += Number(r.valor_parcela ?? r.valor_total ?? 0);
      recebido += sumFinancialPayments(scopedPayments(r));
    }
    const restante = filtered.reduce(
      (sum, r) => sum + Math.max(
        Number(r.valor_parcela ?? r.valor_total ?? 0) - Number(r.valor_pago ?? 0),
        0,
      ),
      0,
    );
    return { total, recebido, restante };
  }, [filtered, dataDe, dataAte, formaFilter]);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      const clean = sanitizeUpdatePayload("recebiveis", payload);
      if (editing) {
        const { error } = await supabase.from("recebiveis").update(clean as any).eq("id", editing.id);
        if (error) throw error;

        // Mantém as demais parcelas do mesmo grupo consistentes (empresa,
        // missão, contrato e pagador são atributos do grupo, não da parcela).
        const shared: Record<string, unknown> = {};
        for (const k of ["empresa_id", "missao_id", "contrato_id", "pagador"] as const) {
          if (k in clean && (clean as any)[k] !== (editing as any)[k]) shared[k] = (clean as any)[k];
        }
        if (Object.keys(shared).length) {
          const rootId = editing.parent_id ?? editing.id;
          await supabase.from("recebiveis").update(shared as any).eq("id", rootId).neq("id", editing.id);
          await supabase.from("recebiveis").update(shared as any).eq("parent_id", rootId).neq("id", editing.id);
        }
      } else {
        const { error } = await supabase.from("recebiveis").insert(clean as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      for (const key of [
        ["recebiveis"], ["contratos"], ["despesas"], ["pagamentos"],
        ["dash-recebiveis"], ["dash-pagamentos"], ["fluxo-caixa"], ["saldos-bancarios"],
      ]) {
        qc.invalidateQueries({ queryKey: key });
      }
      toast.success(editing ? "Atualizado com sucesso" : "Criado com sucesso");
      setFormOpen(false); setEditing(null); setValues(defaultValues);
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteRecord("recebiveis", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebiveis"] });
      toast.success("Registro excluído com sucesso");
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setValues(defaultValues); setFormOpen(true); };
  const openEdit = (row: T) => { setEditing(row); setValues(row); setFormOpen(true); };

  return (
    <PageContainer>
      <PageHeader
        title="Recebíveis"
        description="Parcelas geradas pelos contratos + recebíveis avulsos."
        actions={
          (() => {
            type ExportRow = { rec: T; pagamento: Pagamento | null; totalRecebidoEscopo: number };
            const rows: ExportRow[] = [];
            for (const rec of filtered) {
              const pgtos = scopedPayments(rec);
              const totalRecebidoEscopo = sumFinancialPayments(pgtos);
              pgtos.sort((a, b) => (a.data_pagamento ?? "").localeCompare(b.data_pagamento ?? ""));
              if (pgtos.length === 0) rows.push({ rec, pagamento: null, totalRecebidoEscopo });
              else for (const p of pgtos) rows.push({ rec, pagamento: p, totalRecebidoEscopo });
            }
            const exportRows = sortRowsByVencimento(rows, (r) => r.rec.data_vencimento);
            const contaLabelById = (id: string | null) =>
              !id ? "—" : (contas ?? []).find((c) => c.id === id)?.label ?? "—";
            return (
              <ExportButton<ExportRow>
                title="Recebíveis"
                filename="recebiveis"
                rows={exportRows}
                subtitle={formatPeriodoLabel(dataDe, dataAte)}
                filters={[
                  { label: "Empresa", value: empresaFilter ? nomeById(empresas, empresaFilter) : "Todas as empresas" },
                  { label: "Missão", value: missaoFilter ? nomeById(missoes, missaoFilter) : "Todas as missões" },
                  { label: "Status", value: statusFilter === "pago" ? "Somente recebidas" : statusFilter === "em_aberto" ? "Somente em aberto" : statusFilter === "atrasado" ? "Somente em atraso" : "Todos os status" },
                  { label: "Forma de recebimento", value: formaFilter.length ? formaFilter.map(formaPagamentoLabel).join(", ") : "Todas" },
                  { label: "Período", value: formatPeriodoLabel(dataDe, dataAte).replace(/^Período:\s*/i, "") },
                  { label: "Busca", value: search || "" },
                ]}
                summary={[
                  { label: "Registros", value: String(filtered.length) },
                  { label: "Total a receber", value: formatCurrency(totaisPeriodo.total) },
                  { label: "Recebido", value: formatCurrency(totaisPeriodo.recebido) },
                  { label: "A receber", value: formatCurrency(totaisPeriodo.restante) },
                ]}
                columns={[
                  { header: "Cliente", accessor: (r) => r.rec.pagador },
                  { header: "Empresa", accessor: (r) => nomeById(empresas, r.rec.empresa_id) },
                  { header: "Missão", accessor: (r) => nomeById(missoes, r.rec.missao_id) },
                  { header: "Fatura", accessor: (r) => r.rec.numero_fatura ?? "—" },
                  { header: "Parcela", accessor: (r) => r.rec.parcelas > 1 ? `${r.rec.numero_parcela}/${r.rec.parcelas}` : "Única" },
                  { header: "Vencimento", accessor: (r) => formatDate(r.rec.data_vencimento) },
                  { header: "Valor do contrato", accessor: (r) => formatCurrency(Number(r.rec.valor_parcela ?? r.rec.valor_total)) },
                  { header: "Data do recebimento", accessor: (r) => r.pagamento ? formatDate(r.pagamento.data_pagamento) : "—" },
                  { header: "Valor recebido", accessor: (r) => r.pagamento ? formatCurrency(Number(r.pagamento.valor)) : formatCurrency(0) },
                  { header: "Forma de recebimento", accessor: (r) => r.pagamento ? formaPagamentoLabel(r.pagamento.forma_pagamento) : "—" },
                  { header: "Conta", accessor: (r) => r.pagamento ? contaLabelById(r.pagamento.conta_bancaria_id) : "—" },
                  { header: "Total recebido no filtro", accessor: (r) => formatCurrency(r.totalRecebidoEscopo) },
                  { header: "Saldo a receber", accessor: (r) => formatCurrency(Math.max(Number(r.rec.valor_parcela ?? r.rec.valor_total) - Number(r.rec.valor_pago ?? 0), 0)) },
                  { header: "Status", accessor: (r) => formatStatus(r.rec.status) },
                ]}
              />
            );
          })()
        }
      />

      <Card className="overflow-hidden">
        <div className="p-4 flex flex-col gap-3 border-b">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar em todos os campos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            {canEdit && (
              <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="size-4 mr-1" /> Novo
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2">
            <EmpresaFilter value={empresaFilter} onChange={setEmpresaFilter} />
            <div className="flex items-center gap-2 sm:min-w-[200px]">
              <Target className="size-4 text-muted-foreground shrink-0" />
              <SelectField
                label=""
                value={missaoFilter === "" ? "__all__" : missaoFilter}
                onChange={(v) => setMissaoFilter(v === "__all__" ? "" : v)}
                options={[{ value: "__all__", label: "Todas as missões" }, ...(missoes ?? []).map((m) => ({ value: m.id, label: m.nome }))]}
              />
            </div>
            <div className="sm:min-w-[180px]">
              <SelectField
                label=""
                value={statusFilter === "" ? "__all__" : statusFilter}
                onChange={(v) => setStatusFilter(v === "__all__" ? "" : (v as "em_aberto" | "pago" | "atrasado"))}
                options={[
                  { value: "__all__", label: "Todos os status" },
                  { value: "em_aberto", label: "Somente em aberto" },
                  { value: "atrasado", label: "Somente em atraso" },
                  { value: "pago", label: "Somente recebidas" },
                ]}
              />
            </div>
            <MultiSelectFilter
              label="Forma de recebimento"
              placeholder="Todas"
              icon={<CreditCard className="size-4 text-muted-foreground shrink-0" />}
              options={FORMAS_PAGAMENTO_OPTIONS}
              value={formaFilter}
              onChange={setFormaFilter}
            />
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground sm:hidden col-span-2 -mb-1">Vencimento</label>
              <DatePicker value={dataDe} onChange={setDataDe} className="h-9 w-full sm:w-[150px]" aria-label="Vencimento — de" />
              <DatePicker value={dataAte} onChange={setDataAte} className="h-9 w-full sm:w-[150px]" aria-label="Vencimento — até" />

              {(dataDe || dataAte) && (
                <button
                  type="button"
                  onClick={() => { setDataDe(""); setDataAte(""); }}
                  className="col-span-2 sm:col-auto text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Limpar período
                </button>
              )}
            </div>
          </div>
          <div className="md:hidden grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total a Receber</div>
              <div className="font-semibold tabular-nums">{formatCurrency(totaisPeriodo.total)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recebido</div>
              <div className="font-semibold tabular-nums text-success">{formatCurrency(totaisPeriodo.recebido)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">A receber</div>
              <div className="font-semibold tabular-nums text-primary">{formatCurrency(totaisPeriodo.restante)}</div>
            </div>
          </div>
        </div>



        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhum recebível encontrado.</div>
        ) : (
          <Accordion type="multiple" className="divide-y">
            {groups.map((g) => (
              <AccordionItem key={g.key} value={g.key} className="border-0 border-b last:border-b-0">
                <AccordionTrigger className="px-4 hover:bg-muted/30 hover:no-underline">
                  <div className="flex flex-1 items-center gap-4 pr-4">
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-medium truncate flex items-center gap-2">
                        {g.cliente}
                        {g.contratoLabel && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                            · {g.contratoLabel}
                          </span>
                        )}
                        {!g.contrato_id && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">· avulso</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{g.rows.length} {g.rows.length === 1 ? "parcela" : "parcelas"}</span>
                        {g.countVencido > 0 && <span className="text-destructive">{g.countVencido} vencida(s)</span>}
                        {g.countAberto > 0 && <span>{g.countAberto} em aberto</span>}
                        {g.proximoVenc && <span>Próx. venc.: {formatDate(g.proximoVenc)}</span>}
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end shrink-0 tabular-nums">
                      <div className="text-sm font-semibold">{formatCurrency(g.total)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {g.pago > 0 && <span className="text-success">Pago {formatCurrency(g.pago)} · </span>}
                        A receber <span className="text-primary">{formatCurrency(g.restante)}</span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <div className="overflow-x-auto bg-muted/10 border-t">
                    <table className="w-full text-sm">
                      <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr className="border-b">
                          <th className="text-left px-4 py-2 font-medium">Parcela</th>
                          <th className="text-left px-4 py-2 font-medium">Empresa</th>
                          <th className="text-left px-4 py-2 font-medium">Fatura</th>
                          <th className="text-right px-4 py-2 font-medium">Valor</th>
                          <th className="text-left px-4 py-2 font-medium">Vencimento</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                          <th className="text-left px-4 py-2 font-medium">Anexos</th>
                          {canEdit && <th className="text-right px-4 py-2 font-medium">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => {
                          const v = Number(r.valor_parcela ?? r.valor_total);
                          const pago = Number(r.valor_pago ?? 0);
                          return (
                            <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                              <td className="px-4 py-2">
                                {r.parcelas > 1
                                  ? (r.numero_parcela === 0 ? "Entrada" : `Parcela ${r.numero_parcela}/${r.parcelas}`)
                                  : "Única"}
                              </td>
                              <td className="px-4 py-2">{nomeById(empresas, r.empresa_id)}</td>
                              <td className="px-4 py-2">{r.numero_fatura ?? "—"}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                <div className="font-medium">{formatCurrency(v)}</div>
                                {pago > 0 && pago < v && (
                                  <div className="text-[10px] text-success">Pago {formatCurrency(pago)}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 tabular-nums">{formatDate(r.data_vencimento)}</td>
                              <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                              <td className="px-4 py-2"><AnexosCell entidade="recebiveis" entidade_id={r.id} /></td>
                              {canEdit && (
                                <td className="px-4 py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="ghost"
                                      className="text-primary hover:bg-primary/10 h-8 px-2"
                                      onClick={() => { setPayTarget(r); setPayOpen(true); }}>
                                      <CircleDollarSign className="size-3.5 mr-1" />
                                      Pagamento
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost"
                                      onClick={() => setDeletingId(r.id)}
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) { setEditing(null); setValues(defaultValues); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Recebível" : "Novo Recebível"}</DialogTitle>
            <DialogDescription>Preencha os campos abaixo</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(values); }} className="space-y-4">
            <RecebivelForm values={values} setValues={setValues}
              empresas={empresas ?? []} missoes={missoes ?? []} contratos={contratos ?? []} contas={contas ?? []} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsert.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {upsert.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>{CONFIRM_DELETE_MESSAGE}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deletingId) remove.mutate(deletingId); }}>
              {remove.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PagamentoDialog
        recebivel={payTarget}
        open={payOpen}
        onOpenChange={(v) => { setPayOpen(v); if (!v) setPayTarget(null); }}
      />
    </PageContainer>
  );
}
