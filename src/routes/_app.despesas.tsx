import { DatePicker } from "@/components/date-picker";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { TextField, NumberField, CurrencyField, SelectField, TextAreaField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useEmpresas, useMissoes, useContratos, useFornecedores, useFuncionarios, usePrestadoresMei, useConsolidadoras, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate, formatPeriodoLabel, formatStatus } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";
import { PagamentoDialog } from "@/components/pagamento-dialog";
import { CircleDollarSign, CalendarClock, Target, Plus, Pencil, Trash2, Search, Loader2, Building2 } from "lucide-react";
import { matchesQuery } from "@/lib/search-match";
import { sortByVencimento, sortRowsByVencimento } from "@/lib/sort-vencimento";
import { ExportButton } from "@/components/export-button";
import { KpiCard } from "@/components/kpi-card";
import { useContasBancariasComEmpresa } from "@/lib/bancos";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/use-debounce";
import { toast } from "sonner";
import { deleteRecord, CONFIRM_DELETE_MESSAGE } from "@/lib/delete-record";
import { sanitizeUpdatePayload } from "@/lib/sanitize-update";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { RateioMissoes, diferencaRateio, type RateioItem } from "@/components/rateio-missoes";
import { FORMAS_PAGAMENTO_OPTIONS, formaPagamentoLabel, formaMatches } from "@/lib/formas-pagamento";
import { CreditCard } from "lucide-react";
import {
  financialRecordMatchesScope,
  paymentsInFinancialScope,
  sumFinancialPayments,
} from "@/lib/financial-report";

export const Route = createFileRoute("/_app/despesas")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: search.status === "atrasado" || search.status === "em_aberto" || search.status === "pago"
      ? (search.status as "atrasado" | "em_aberto" | "pago")
      : undefined,
  }),
  component: Page,
});

const hoje = () => new Date().toISOString().slice(0, 10);
export const isVencido = (status: string, vencimento: string | null | undefined) =>
  status !== "pago" && status !== "cancelado" && !!vencimento && vencimento.slice(0, 10) < hoje();

type Pagamento = {
  id: string;
  data_pagamento: string | null;
  valor: number;
  forma_pagamento: string | null;
  conta_bancaria_id: string | null;
};

type T = {
  id: string; empresa_id: string | null; missao_id: string | null; contrato_id: string | null;
  fornecedor_id: string | null;
  funcionario_id: string | null; prestador_mei_id: string | null; consolidadora_id: string | null;
  descricao: string; categoria: string; categoria_personalizada: string | null;
  valor: number;
  valor_pago: number;
  data_vencimento: string | null; data_pagamento: string | null; banco: string | null;
  status: string; observacoes: string | null;
  parent_id: string | null; numero_parcela: number; parcelas: number; frequencia: string;
  registros_pagamento?: Pagamento[];
};

const CATEGORIAS = [
  { value: "impostos", label: "Impostos" },
  { value: "funcionarios", label: "Funcionário" },
  { value: "prestador_mei", label: "MEI (Prestador de serviço)" },
  { value: "consolidadora", label: "Consolidadora" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "aluguel", label: "Aluguel" }, { value: "luz", label: "Luz" },
  { value: "condominio", label: "Condomínio" }, { value: "telefone", label: "Telefone" },
  { value: "parcelamento_simples", label: "Parcelamento Simples" }, { value: "avulso", label: "Avulso" },
  { value: "outros", label: "Outros" },
];

const CATEGORIA_SINGULAR: Record<string, string> = {
  impostos: "Imposto",
  funcionarios: "Funcionário",
  prestador_mei: "MEI",
  consolidadora: "Consolidadora",
  fornecedor: "Fornecedor",
  aluguel: "Aluguel",
  luz: "Luz",
  condominio: "Condomínio",
  telefone: "Telefone",
  parcelamento_simples: "Parcelamento Simples",
  avulso: "Avulso",
  outros: "Outros",
};

function categoriaLabel(categoria: string, personalizada?: string | null): string {
  if (personalizada) return personalizada.charAt(0).toUpperCase() + personalizada.slice(1);
  return CATEGORIA_SINGULAR[categoria] ?? (categoria.charAt(0).toUpperCase() + categoria.slice(1).replace(/_/g, " "));
}

// Categorias que exibem um campo dinâmico de seleção (cadastro correspondente).
const DYNAMIC_CATEGORIES: Record<string, { label: string; field: "funcionario_id" | "prestador_mei_id" | "consolidadora_id" | "fornecedor_id" }> = {
  funcionarios: { label: "Funcionário", field: "funcionario_id" },
  prestador_mei: { label: "MEI", field: "prestador_mei_id" },
  consolidadora: { label: "Consolidadora", field: "consolidadora_id" },
  fornecedor: { label: "Fornecedor", field: "fornecedor_id" },
};


type Group = {
  key: string;
  parentId: string | null;
  titulo: string;
  categoria: string;
  empresa_id: string | null;
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
  scopedPayments: (row: T) => Pagamento[],
  valorDe: (row: T) => number = (row) => Number(row.valor ?? 0),
  fatorDe: (row: T) => number = () => 1,
): Group[] {
  const map = new Map<string, Group>();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const r of rows) {
    // Agrupa por parent_id ou próprio id (para pais / únicos)
    const key = r.parent_id ?? r.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        parentId: r.parent_id,
        titulo: r.descricao,
        categoria: r.categoria_personalizada ?? r.categoria,
        empresa_id: r.empresa_id,
        rows: [],
        total: 0, pago: 0, restante: 0,
        proximoVenc: null, countAberto: 0, countVencido: 0,
      };
      map.set(key, g);
    }
    g.rows.push(r);
    const f = fatorDe(r);
    const v = valorDe(r);
    const pago = sumFinancialPayments(scopedPayments(r)) * f;
    g.total += v;
    g.pago += pago;
    g.restante += Math.max(v - Number(r.valor_pago ?? 0) * f, 0);
    if (r.status !== "pago" && r.data_vencimento) {
      const dv = new Date(r.data_vencimento);
      if (!g.proximoVenc || new Date(g.proximoVenc) > dv) g.proximoVenc = r.data_vencimento;
      if (dv < today) g.countVencido += 1;
      else g.countAberto += 1;
    } else if (r.status !== "pago") {
      g.countAberto += 1;
    }
  }
  // Se o pai (parent_id null) não foi retornado no filtro, ainda ok
  for (const g of map.values()) {
    g.rows.sort((a, b) => (a.numero_parcela ?? 0) - (b.numero_parcela ?? 0));
    // título prefere o do "pai"
    const pai = g.rows.find((r) => r.parent_id === null);
    if (pai) { g.titulo = pai.descricao; g.categoria = pai.categoria_personalizada ?? pai.categoria; g.empresa_id = pai.empresa_id; }
  }
  return Array.from(map.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
}

function Page() {
  const qc = useQueryClient();
  const { canEdit } = useAuth();
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();
  const { data: contratos } = useContratos();
  const { data: fornecedores } = useFornecedores();
  const { data: funcionarios } = useFuncionarios();
  const { data: prestadoresMei } = usePrestadoresMei();
  const { data: consolidadoras } = useConsolidadoras();
  const { data: contas } = useContasBancariasComEmpresa({ ativas: true });


  const { data: rateiosByDespesa } = useQuery({
    queryKey: ["despesa-rateios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesa_rateios")
        .select("id, despesa_id, missao_id, valor");
      if (error) throw error;
      const map = new Map<string, RateioItem[]>();
      for (const r of (data ?? []) as any[]) {
        const list = map.get(r.despesa_id) ?? [];
        list.push({ id: r.id, missao_id: r.missao_id, valor: Number(r.valor ?? 0) });
        map.set(r.despesa_id, list);
      }
      return map;
    },
  });
  const rateiosDe = (id: string): RateioItem[] => rateiosByDespesa?.get(id) ?? [];

  const [empresaFilter, setEmpresaFilter] = useState<string[]>([]);
  const [missaoFilter, setMissaoFilter] = useState<string[]>([]);
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
  const defaultValues: Partial<T> = {
    status: "em_aberto", descricao: "", categoria: "outros", categoria_personalizada: null,
    parcelas: 1, frequencia: "mensal",
  };
  const [values, setValues] = useState<Partial<T>>(defaultValues);
  const [rateio, setRateio] = useState<RateioItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas")
        .select("*, registros_pagamento(id, data_pagamento, valor, forma_pagamento, conta_bancaria_id)")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data as T[];
    if (empresaFilter.length > 0) rows = rows.filter((r) => !!r.empresa_id && empresaFilter.includes(r.empresa_id));
    if (missaoFilter.length > 0)
      rows = rows.filter(
        (r) =>
          (!!r.missao_id && missaoFilter.includes(r.missao_id)) ||
          (rateiosByDespesa?.get(r.id) ?? []).some((x) => missaoFilter.includes(x.missao_id)),
      );
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
  }, [data, rateiosByDespesa, empresaFilter, missaoFilter, statusFilter, dataDe, dataAte, formaFilter, search]);

  const scopedPayments = (row: T) => paymentsInFinancialScope(
    row.registros_pagamento,
    { from: dataDe, to: dataAte },
    (payment) => formaMatches(payment.forma_pagamento, formaFilter),
  );

  /** Valor da despesa considerando o rateio quando há filtro por missão. */
  const valorNoEscopo = (row: T): number => {
    const total = Number(row.valor ?? 0);
    if (missaoFilter.length === 0) return total;
    const itens = rateiosByDespesa?.get(row.id) ?? [];
    if (itens.length === 0) return total;
    const valorRateado = itens
      .filter((x) => missaoFilter.includes(x.missao_id))
      .reduce((sum, item) => sum + Number(item.valor ?? 0), 0);
    return valorRateado > 0 ? valorRateado : total;
  };
  /** Proporção do valor da despesa atribuída à missão filtrada (1 quando sem rateio/filtro). */
  const fatorEscopo = (row: T): number => {
    const total = Number(row.valor ?? 0);
    if (!total) return 1;
    return valorNoEscopo(row) / total;
  };

  const groups = useMemo(
    () => buildGroups(filtered, scopedPayments, valorNoEscopo, fatorEscopo),
    [filtered, dataDe, dataAte, formaFilter, missaoFilter, rateiosByDespesa],
  );

  const totalHoje = useMemo(() => {
    const hoje = new Date().toLocaleDateString("sv-SE");
    return filtered
      .filter((r) => r.data_vencimento === hoje && r.status !== "pago" && r.status !== "cancelado")
      .reduce((acc, r) => acc + Math.max(0, valorNoEscopo(r) - Number(r.valor_pago ?? 0) * fatorEscopo(r)), 0);
  }, [filtered, missaoFilter, rateiosByDespesa]);

  const totaisPeriodo = useMemo(() => {
    let total = 0, pago = 0;
    for (const r of filtered) {
      if (r.status === "cancelado") continue;
      total += valorNoEscopo(r);
      pago += sumFinancialPayments(scopedPayments(r)) * fatorEscopo(r);
    }
    const restante = filtered.reduce(
      (sum, r) => sum + Math.max(valorNoEscopo(r) - Number(r.valor_pago ?? 0) * fatorEscopo(r), 0),
      0,
    );
    return { total, pago, restante };
  }, [filtered, dataDe, dataAte, formaFilter, missaoFilter, rateiosByDespesa]);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      const clean = sanitizeUpdatePayload("despesas", payload);
      let despesaId: string;
      if (editing) {
        const { error } = await supabase.from("despesas").update(clean as any).eq("id", editing.id);
        if (error) throw error;
        despesaId = editing.id;
      } else {
        const { data, error } = await supabase.from("despesas").insert(clean as any).select("id").single();
        if (error) throw error;
        despesaId = (data as any).id as string;
      }
      // Sincroniza o rateio por missão (a despesa continua sendo um único lançamento)
      const itens = rateio.filter((r) => r.missao_id && Number(r.valor) > 0);
      const { error: delErr } = await supabase.from("despesa_rateios").delete().eq("despesa_id", despesaId);
      if (delErr) throw delErr;
      if (itens.length > 0) {
        const { error: insErr } = await supabase.from("despesa_rateios").insert(
          itens.map((r) => ({ despesa_id: despesaId, missao_id: r.missao_id, valor: r.valor })) as any,
        );
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["despesa-rateios"] });
      toast.success(editing ? "Atualizado com sucesso" : "Criado com sucesso");
      setFormOpen(false); setEditing(null); setValues(defaultValues); setRateio([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await deleteRecord("despesas", id); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      toast.success("Registro excluído com sucesso");
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setValues(defaultValues); setRateio([]); setFormOpen(true); };
  const openEdit = (row: T) => { setEditing(row); setValues(row); setRateio(rateiosDe(row.id)); setFormOpen(true); };

  const rateioTexto = (id: string) =>
    rateiosDe(id).map((r) => `${nomeById(missoes, r.missao_id)}: ${formatCurrency(Number(r.valor))}`).join(" | ");

  const contratoLabel = (id: string | null) => {
    if (!id) return "—";
    const c = contratos?.find((x) => x.id === id);
    return c ? `${c.numero ?? ""} ${c.cliente}`.trim() : "—";
  };

  // Linhas expandidas: uma por pagamento (ou uma por despesa sem pagamentos).
  type ExportRow = {
    despesa: T;
    pagamento: Pagamento | null;
    totalPagoEscopo: number;
  };
  const exportRows: ExportRow[] = useMemo(() => {
    const out: ExportRow[] = [];
    for (const d of filtered) {
      const pgtos = scopedPayments(d);
      const totalPagoEscopo = sumFinancialPayments(pgtos);
      pgtos.sort((a, b) => (a.data_pagamento ?? "").localeCompare(b.data_pagamento ?? ""));
      if (pgtos.length === 0) {
        out.push({ despesa: d, pagamento: null, totalPagoEscopo });
      } else {
        for (const p of pgtos) out.push({ despesa: d, pagamento: p, totalPagoEscopo });
      }
    }
    return sortRowsByVencimento(out, (r) => r.despesa.data_vencimento);
  }, [filtered, dataDe, dataAte, formaFilter]);

  const contaLabelById = (id: string | null) => {
    if (!id) return "—";
    return (contas ?? []).find((c) => c.id === id)?.label ?? "—";
  };

  return (
    <PageContainer>
      <PageHeader
        title="Despesas"
        description="Contas a pagar. O status é calculado automaticamente a partir dos pagamentos registrados."
        actions={
          <ExportButton<ExportRow>
            title="Despesas" filename="despesas" rows={exportRows}
            subtitle={formatPeriodoLabel(dataDe, dataAte)}
            filters={[
              { label: "Empresa", value: empresaFilter.length ? empresaFilter.map((id) => nomeById(empresas, id)).join(", ") : "Todas as empresas" },
              { label: "Missão", value: missaoFilter.length ? missaoFilter.map((id) => nomeById(missoes, id)).join(", ") : "Todas as missões" },
              { label: "Status", value: statusFilter === "pago" ? "Somente pagas" : statusFilter === "em_aberto" ? "Somente em aberto" : statusFilter === "atrasado" ? "Somente em atraso" : "Todos os status" },
              { label: "Forma de pagamento", value: formaFilter.length ? formaFilter.map(formaPagamentoLabel).join(", ") : "Todas" },
              { label: "Período", value: formatPeriodoLabel(dataDe, dataAte).replace(/^Período:\s*/i, "") },
              { label: "Busca", value: search || "" },
            ]}
            summary={[
              { label: "Registros", value: String(filtered.length) },
              { label: "Total a pagar", value: formatCurrency(totaisPeriodo.total) },
              { label: "Pago", value: formatCurrency(totaisPeriodo.pago) },
              { label: "A pagar", value: formatCurrency(totaisPeriodo.restante) },
            ]}
            columns={[
              { header: "Descrição", accessor: (r) => r.despesa.descricao },
              { header: "Categoria", accessor: (r) => categoriaLabel(r.despesa.categoria, r.despesa.categoria_personalizada) },
              { header: "Empresa", accessor: (r) => nomeById(empresas, r.despesa.empresa_id) },
              { header: "Missão", accessor: (r) => nomeById(missoes, r.despesa.missao_id) },
              { header: "Rateio por missão", accessor: (r) => rateioTexto(r.despesa.id) || "—" },
              { header: "Fornecedor", accessor: (r) => nomeById(fornecedores, r.despesa.fornecedor_id) },
              { header: "Parcela", accessor: (r) => r.despesa.parcelas > 1 ? `${r.despesa.numero_parcela}/${r.despesa.parcelas}` : "Única" },
              { header: "Vencimento", accessor: (r) => formatDate(r.despesa.data_vencimento) },
              { header: "Valor do contrato", accessor: (r) => formatCurrency(valorNoEscopo(r.despesa)) },
              { header: "Data do pagamento", accessor: (r) => r.pagamento ? formatDate(r.pagamento.data_pagamento) : "—" },
              { header: "Valor pago", accessor: (r) => r.pagamento ? formatCurrency(Number(r.pagamento.valor) * fatorEscopo(r.despesa)) : formatCurrency(0) },
              { header: "Forma de pagamento", accessor: (r) => r.pagamento ? formaPagamentoLabel(r.pagamento.forma_pagamento) : "—" },
              { header: "Conta", accessor: (r) => r.pagamento ? contaLabelById(r.pagamento.conta_bancaria_id) : (r.despesa.banco ?? "—") },
              { header: "Total pago no filtro", accessor: (r) => formatCurrency(r.totalPagoEscopo * fatorEscopo(r.despesa)) },
              { header: "Saldo a pagar", accessor: (r) => formatCurrency(Math.max(valorNoEscopo(r.despesa) - Number(r.despesa.valor_pago ?? 0) * fatorEscopo(r.despesa), 0)) },
              { header: "Status", accessor: (r) => formatStatus(r.despesa.status) },
            ]}

          />
        }
      />


      {(dataDe || dataAte) ? (
        <KpiCard
          label="Total a pagar no período"
          value={formatCurrency(totaisPeriodo.restante)}
          hint={`${dataDe ? formatDate(dataDe) : "início"} → ${dataAte ? formatDate(dataAte) : "hoje"}${empresaFilter.length ? ` · ${empresaFilter.length === 1 ? "1 empresa" : `${empresaFilter.length} empresas`}` : ""}`}
          icon={<CalendarClock className="size-5" />} tone="warning"
        />
      ) : (
        <KpiCard
          label="Total a pagar hoje" value={formatCurrency(totalHoje)}
          hint={empresaFilter.length ? (empresaFilter.length === 1 ? "Filtrado pela empresa selecionada" : `Filtrado por ${empresaFilter.length} empresas`) : "Todas as empresas"}
          icon={<CalendarClock className="size-5" />} tone="warning"
        />
      )}

      <Card className="overflow-hidden">
        <div className="p-4 flex flex-col gap-3 border-b">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar em todos os campos..."
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            {canEdit && (
              <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="size-4 mr-1" /> Nova despesa
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2">
            <MultiSelectFilter
              label="Empresa"
              placeholder="Todas as empresas"
              selectedLabel="empresas selecionadas"
              allLabel="Selecionar todas as empresas"
              icon={<Building2 className="size-4 text-muted-foreground shrink-0" />}
              options={(empresas ?? []).map((empresa) => ({ value: empresa.id, label: empresa.nome }))}
              value={empresaFilter}
              onChange={setEmpresaFilter}
            />
            <MultiSelectFilter
              label="Missão"
              placeholder="Todas as missões"
              selectedLabel="missões selecionadas"
              allLabel="Selecionar todas as missões"
              icon={<Target className="size-4 text-muted-foreground shrink-0" />}
              options={(missoes ?? []).map((missao) => ({ value: missao.id, label: missao.nome }))}
              value={missaoFilter}
              onChange={setMissaoFilter}
            />
            <div className="sm:min-w-[180px]">
              <SelectField label="" value={statusFilter === "" ? "__all__" : statusFilter}
                onChange={(v) => setStatusFilter(v === "__all__" ? "" : (v as "em_aberto" | "pago" | "atrasado"))}
                options={[
                  { value: "__all__", label: "Todos os status" },
                  { value: "em_aberto", label: "Somente em aberto" },
                  { value: "atrasado", label: "Somente em atraso" },
                  { value: "pago", label: "Somente pagas" },
                ]} />
            </div>
            <MultiSelectFilter
              label="Forma de pagamento"
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
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
              <div className="font-semibold tabular-nums">{formatCurrency(totaisPeriodo.total)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pago</div>
              <div className="font-semibold tabular-nums text-success">{formatCurrency(totaisPeriodo.pago)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">A pagar</div>
              <div className="font-semibold tabular-nums text-primary">{formatCurrency(totaisPeriodo.restante)}</div>
            </div>
          </div>
        </div>



        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Nenhuma despesa encontrada.</div>
        ) : (
          <Accordion type="multiple" className="divide-y">
            {groups.map((g) => (
              <AccordionItem key={g.key} value={g.key} className="border-0 border-b last:border-b-0">
                <AccordionTrigger className="px-4 hover:bg-muted/30 hover:no-underline">
                  <div className="flex flex-1 items-center gap-4 pr-4">
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-medium truncate flex items-center gap-2">
                        {g.titulo}
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                          · {categoriaLabel(g.categoria)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{nomeById(empresas, g.empresa_id)}</span>
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
                        A pagar <span className="text-primary">{formatCurrency(g.restante)}</span>
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
                          <th className="text-left px-4 py-2 font-medium">Banco</th>
                          <th className="text-right px-4 py-2 font-medium">Valor</th>
                          <th className="text-left px-4 py-2 font-medium">Vencimento</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                          <th className="text-left px-4 py-2 font-medium">Anexos</th>
                          {canEdit && <th className="text-right px-4 py-2 font-medium">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => {
                          const rateado = rateiosDe(r.id).length > 0;
                          const v = valorNoEscopo(r);
                          const pago = Number(r.valor_pago ?? 0) * fatorEscopo(r);
                          return (
                            <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                              <td className="px-4 py-2">
                                {r.parcelas > 1 ? `${r.numero_parcela}/${r.parcelas}` : "Única"}
                              </td>
                              <td className="px-4 py-2">{r.banco ?? "—"}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                <div className="font-medium">{formatCurrency(v)}</div>
                                {rateado && missaoFilter && (
                                  <div className="text-[10px] text-muted-foreground">
                                    Rateada · total {formatCurrency(Number(r.valor))}
                                  </div>
                                )}
                                {pago > 0 && pago < v && (
                                  <div className="text-[10px] text-success">Pago {formatCurrency(pago)}</div>
                                )}
                                {rateado && !missaoFilter && (
                                  <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground text-right">
                                    {rateiosDe(r.id).map((rt) => (
                                      <div key={rt.id ?? rt.missao_id}>
                                        {nomeById(missoes, rt.missao_id)}: {formatCurrency(Number(rt.valor))}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 tabular-nums">{formatDate(r.data_vencimento)}</td>
                              <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                              <td className="px-4 py-2"><AnexosCell entidade="despesas" entidade_id={r.id} /></td>
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

      <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) { setEditing(null); setValues(defaultValues); setRateio([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            <DialogDescription>Preencha os campos abaixo</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const itens = rateio.filter((r) => r.missao_id && Number(r.valor) > 0);
            if (itens.length > 0 && diferencaRateio(itens, Number(values.valor ?? 0)) !== 0) {
              toast.error("A soma do rateio por missão deve ser exatamente igual ao valor da despesa.");
              return;
            }
            upsert.mutate(values);
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Categoria" value={values.categoria}
                onChange={(v) => setValues({
                  ...values,
                  categoria: v,
                  categoria_personalizada: v === "outros" ? values.categoria_personalizada : null,
                  // limpa vínculos de outras categorias ao trocar
                  funcionario_id: v === "funcionarios" ? values.funcionario_id : null,
                  prestador_mei_id: v === "prestador_mei" ? values.prestador_mei_id : null,
                  consolidadora_id: v === "consolidadora" ? values.consolidadora_id : null,
                  fornecedor_id: v === "fornecedor" ? values.fornecedor_id : null,
                })}
                options={CATEGORIAS} />
              {values.categoria === "outros" && (
                <TextField label="Categoria personalizada" value={values.categoria_personalizada ?? ""} onChange={(v) => setValues({ ...values, categoria_personalizada: v })} />
              )}
              {(() => {
                const cat = values.categoria ?? "";
                const meta = DYNAMIC_CATEGORIES[cat];
                if (!meta) return null;
                const options =
                  meta.field === "funcionario_id" ? (funcionarios ?? []) :
                  meta.field === "prestador_mei_id" ? (prestadoresMei ?? []) :
                  meta.field === "consolidadora_id" ? (consolidadoras ?? []) :
                  (fornecedores ?? []);
                return (
                  <SelectField
                    label={meta.label}
                    value={(values as any)[meta.field] ?? ""}
                    onChange={(v) => setValues({ ...values, [meta.field]: v } as Partial<T>)}
                    options={options.map((o: { id: string; nome: string }) => ({ value: o.id, label: o.nome }))}
                  />
                );
              })()}
              <CurrencyField label="Valor (por parcela)" value={values.valor} onChange={(v) => setValues({ ...values, valor: v })} />
              <NumberField label="Parcelas" value={values.parcelas} onChange={(v) => setValues({ ...values, parcelas: v })} step="1" />
              <SelectField label="Frequência" value={values.frequencia ?? "mensal"} onChange={(v) => setValues({ ...values, frequencia: v })}
                options={[
                  { value: "mensal", label: "Mensal" }, { value: "quinzenal", label: "Quinzenal" },
                  { value: "semanal", label: "Semanal" }, { value: "anual", label: "Anual" },
                ]} />
              <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
                options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
              <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v })}
                options={(missoes ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
              <SelectField label="Contrato" value={values.contrato_id ?? ""} onChange={(v) => setValues({ ...values, contrato_id: v })}
                options={(contratos ?? []).map((c) => ({ value: c.id, label: `${c.numero ?? ""} ${c.cliente}` }))} />

              <TextField label="Vencimento" value={values.data_vencimento} onChange={(v) => setValues({ ...values, data_vencimento: v })} type="date" />
              <SelectField label="Banco" value={values.banco ?? ""} onChange={(v) => setValues({ ...values, banco: v })}
                options={(contas ?? []).map((c) => ({ value: c.label, label: c.label }))} />
              <div className="col-span-2">
                <TextField label="Descrição" value={values.descricao} onChange={(v) => setValues({ ...values, descricao: v })} />
              </div>
              <div className="col-span-2">
                <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
              </div>
              <div className="col-span-2">
                <RateioMissoes
                  itens={rateio}
                  onChange={setRateio}
                  total={Number(values.valor ?? 0)}
                  missoes={missoes ?? []}
                />
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground">
                Em despesas parceladas, o valor informado é repetido em <strong>cada</strong> parcela (não é dividido).
                O <strong>status</strong> é calculado automaticamente; para marcar como pago, use o botão <strong>Pagamento</strong> na lista.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsert.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {upsert.isPending && <Loader2 className="size-4 animate-spin mr-2" />} Salvar
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
              {remove.isPending && <Loader2 className="size-4 animate-spin mr-2" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PagamentoDialog
        despesa={payTarget ? {
          id: payTarget.id, descricao: payTarget.descricao, valor: Number(payTarget.valor),
          valor_pago: Number(payTarget.valor_pago ?? 0),
          numero_parcela: payTarget.numero_parcela, parcelas: payTarget.parcelas,
        } : null}
        open={payOpen}
        onOpenChange={(v) => { setPayOpen(v); if (!v) setPayTarget(null); }}
      />
    </PageContainer>
  );
}
