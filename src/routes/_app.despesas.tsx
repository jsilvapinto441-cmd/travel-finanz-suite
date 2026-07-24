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
import { formatCurrency, formatDate, formatPeriodoLabel } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { AnexosCell } from "@/components/anexos";
import { PagamentoDialog } from "@/components/pagamento-dialog";
import { CircleDollarSign, CalendarClock, Target, Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { EmpresaFilter } from "@/components/empresa-filter";
import { matchesQuery } from "@/lib/search-match";
import { ExportButton } from "@/components/export-button";
import { KpiCard } from "@/components/kpi-card";
import { useContasBancariasComEmpresa } from "@/lib/bancos";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/use-debounce";
import { toast } from "sonner";
import { deleteRecord, CONFIRM_DELETE_MESSAGE } from "@/lib/delete-record";
import { sanitizeUpdatePayload } from "@/lib/sanitize-update";

export const Route = createFileRoute("/_app/despesas")({ component: Page });

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

function buildGroups(rows: T[]): Group[] {
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
    const v = Number(r.valor ?? 0);
    const pago = Number(r.valor_pago ?? 0);
    g.total += v;
    g.pago += pago;
    g.restante += Math.max(v - pago, 0);
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


  const [empresaFilter, setEmpresaFilter] = useState("");
  const [missaoFilter, setMissaoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "em_aberto" | "pago">("");
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas").select("*").order("data_vencimento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data as T[];
    if (empresaFilter) rows = rows.filter((r) => r.empresa_id === empresaFilter);
    if (missaoFilter) rows = rows.filter((r) => r.missao_id === missaoFilter);
    if (statusFilter === "pago") {
      rows = rows.filter((r) => r.status === "pago");
    } else if (statusFilter === "em_aberto") {
      rows = rows.filter((r) => r.status !== "pago" && r.status !== "cancelado");
    }
    if (dataDe) rows = rows.filter((r) => (r.data_vencimento ?? "") >= dataDe);
    if (dataAte) rows = rows.filter((r) => (r.data_vencimento ?? "") <= dataAte);
    if (search) {
      rows = rows.filter((r) => matchesQuery(r as unknown as Record<string, unknown>, search));
    }
    return rows;
  }, [data, empresaFilter, missaoFilter, statusFilter, dataDe, dataAte, search]);

  const groups = useMemo(() => buildGroups(filtered), [filtered]);

  const totalHoje = useMemo(() => {
    const hoje = new Date().toLocaleDateString("sv-SE");
    return filtered
      .filter((r) => r.data_vencimento === hoje && r.status !== "pago" && r.status !== "cancelado")
      .reduce((acc, r) => acc + Math.max(0, Number(r.valor) - Number(r.valor_pago ?? 0)), 0);
  }, [filtered]);

  const totaisPeriodo = useMemo(() => {
    let total = 0, pago = 0;
    for (const r of filtered) {
      if (r.status === "cancelado") continue;
      total += Number(r.valor ?? 0);
      pago += Number(r.valor_pago ?? 0);
    }
    return { total, pago, restante: Math.max(total - pago, 0) };
  }, [filtered]);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      const clean = sanitizeUpdatePayload("despesas", payload);
      if (editing) {
        const { error } = await supabase.from("despesas").update(clean as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas").insert(clean as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      toast.success(editing ? "Atualizado com sucesso" : "Criado com sucesso");
      setFormOpen(false); setEditing(null); setValues(defaultValues);
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

  const openNew = () => { setEditing(null); setValues(defaultValues); setFormOpen(true); };
  const openEdit = (row: T) => { setEditing(row); setValues(row); setFormOpen(true); };

  const contratoLabel = (id: string | null) => {
    if (!id) return "—";
    const c = contratos?.find((x) => x.id === id);
    return c ? `${c.numero ?? ""} ${c.cliente}`.trim() : "—";
  };

  return (
    <PageContainer>
      <PageHeader
        title="Despesas"
        description="Contas a pagar. O status é calculado automaticamente a partir dos pagamentos registrados."
        actions={
          <ExportButton<any>
            title="Despesas" filename="despesas" rows={filtered as any}
            subtitle={formatPeriodoLabel(dataDe, dataAte)}
            filters={[
              { label: "Empresa", value: empresaFilter ? nomeById(empresas, empresaFilter) : "Todas as empresas" },
              { label: "Missão", value: missaoFilter ? nomeById(missoes, missaoFilter) : "Todas as missões" },
              { label: "Status", value: statusFilter === "pago" ? "Somente pagas" : statusFilter === "em_aberto" ? "Somente em aberto" : "Todos os status" },
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
              
              { header: "Descrição", accessor: (r: T) => r.descricao },
              { header: "Categoria", accessor: (r: T) => categoriaLabel(r.categoria, r.categoria_personalizada) },
              { header: "Empresa", accessor: (r: T) => nomeById(empresas, r.empresa_id) },
              { header: "Missão", accessor: (r: T) => nomeById(missoes, r.missao_id) },
              { header: "Fornecedor", accessor: (r: T) => nomeById(fornecedores, r.fornecedor_id) },
              { header: "Banco", accessor: (r: T) => r.banco ?? "—" },
              { header: "Valor", accessor: (r: T) => formatCurrency(Number(r.valor)) },
              { header: "Valor pago", accessor: (r: T) => formatCurrency(Number(r.valor_pago ?? 0)) },
              { header: "Parcela", accessor: (r: T) => r.parcelas > 1 ? `${r.numero_parcela}/${r.parcelas}` : "Única" },
              { header: "Vencimento", accessor: (r: T) => formatDate(r.data_vencimento) },
              { header: "Data de Pagamento", accessor: (r: T) => formatDate(r.data_pagamento) },
              { header: "Status", accessor: (r: T) => r.status },
            ]}

          />
        }
      />

      {(dataDe || dataAte) ? (
        <KpiCard
          label="Total a pagar no período"
          value={formatCurrency(totaisPeriodo.restante)}
          hint={`${dataDe ? formatDate(dataDe) : "início"} → ${dataAte ? formatDate(dataAte) : "hoje"}${empresaFilter ? " · empresa filtrada" : ""}`}
          icon={<CalendarClock className="size-5" />} tone="warning"
        />
      ) : (
        <KpiCard
          label="Total a pagar hoje" value={formatCurrency(totalHoje)}
          hint={empresaFilter ? "Filtrado pela empresa selecionada" : "Todas as empresas"}
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
            <EmpresaFilter value={empresaFilter} onChange={setEmpresaFilter} />
            <div className="flex items-center gap-2 sm:min-w-[200px]">
              <Target className="size-4 text-muted-foreground shrink-0" />
              <SelectField label="" value={missaoFilter === "" ? "__all__" : missaoFilter}
                onChange={(v) => setMissaoFilter(v === "__all__" ? "" : v)}
                options={[{ value: "__all__", label: "Todas as missões" }, ...(missoes ?? []).map((m) => ({ value: m.id, label: m.nome }))]} />
            </div>
            <div className="sm:min-w-[180px]">
              <SelectField label="" value={statusFilter === "" ? "__all__" : statusFilter}
                onChange={(v) => setStatusFilter(v === "__all__" ? "" : (v as "em_aberto" | "pago"))}
                options={[
                  { value: "__all__", label: "Todos os status" },
                  { value: "em_aberto", label: "Somente em aberto" },
                  { value: "pago", label: "Somente pagas" },
                ]} />
            </div>
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
                          const v = Number(r.valor);
                          const pago = Number(r.valor_pago ?? 0);
                          return (
                            <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                              <td className="px-4 py-2">
                                {r.parcelas > 1 ? `${r.numero_parcela}/${r.parcelas}` : "Única"}
                              </td>
                              <td className="px-4 py-2">{r.banco ?? "—"}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                <div className="font-medium">{formatCurrency(v)}</div>
                                {pago > 0 && pago < v && (
                                  <div className="text-[10px] text-success">Pago {formatCurrency(pago)}</div>
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

      <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) { setEditing(null); setValues(defaultValues); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            <DialogDescription>Preencha os campos abaixo</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(values); }} className="space-y-4">
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
