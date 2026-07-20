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
import { formatCurrency, formatDate } from "@/lib/format";
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
import { Target } from "lucide-react";
import { matchesQuery } from "@/lib/search-match";

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
  values, setValues, empresas, missoes, contratos, contas,
}: {
  values: Partial<T>;
  setValues: React.Dispatch<React.SetStateAction<Partial<T>>>;
  empresas: { id: string; nome: string }[];
  missoes: { id: string; nome: string }[];
  contratos: { id: string; numero: string | null; cliente: string }[];
  contas: ContaBancariaComEmpresa[];
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
            Para alterar valor, parcelas ou datas, edite o contrato. Pagamentos são registrados pelo botão "Pagamento" na lista.
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

function buildGroups(rows: T[], contratos: { id: string; cliente: string; numero: string | null }[]): Group[] {
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recebiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebiveis")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (empresaFilter) rows = rows.filter((r) => r.empresa_id === empresaFilter);
    if (missaoFilter) rows = rows.filter((r) => r.missao_id === missaoFilter);
    if (dataDe) rows = rows.filter((r) => (r.data_vencimento ?? "") >= dataDe);
    if (dataAte) rows = rows.filter((r) => (r.data_vencimento ?? "") <= dataAte);
    if (search) {
      rows = rows.filter((r) => matchesQuery(r as unknown as Record<string, unknown>, search));
    }
    return rows;
  }, [data, search, empresaFilter, missaoFilter, dataDe, dataAte]);

  const groups = useMemo(
    () => buildGroups(filtered, contratos ?? []),
    [filtered, contratos]
  );

  const totaisPeriodo = useMemo(() => {
    let total = 0, recebido = 0;
    for (const r of filtered) {
      if (r.status === "cancelado") continue;
      total += Number(r.valor_parcela ?? r.valor_total ?? 0);
      recebido += Number(r.valor_pago ?? 0);
    }
    return { total, recebido, restante: Math.max(total - recebido, 0) };
  }, [filtered]);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      const clean = sanitizeUpdatePayload("recebiveis", payload);
      if (editing) {
        const { error } = await supabase.from("recebiveis").update(clean as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recebiveis").insert(clean as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recebiveis"] });
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
          <ExportButton<T>
            title="Recebíveis"
            filename="recebiveis"
            rows={(data ?? []) as T[]}
            columns={[
              { header: "Cliente", accessor: "pagador" },
              { header: "Empresa", accessor: (r) => nomeById(empresas, r.empresa_id) },
              { header: "Fatura", accessor: "numero_fatura" },
              { header: "Parcela", accessor: (r) => r.parcelas > 1 ? `${r.numero_parcela}/${r.parcelas}` : "Única" },
              { header: "Valor", accessor: (r) => formatCurrency(Number(r.valor_parcela ?? r.valor_total)) },
              { header: "Pago", accessor: (r) => formatCurrency(Number(r.valor_pago ?? 0)) },
              { header: "Vencimento", accessor: (r) => formatDate(r.data_vencimento) },
              { header: "Recebimento", accessor: (r) => formatDate(r.data_recebimento) },
              { header: "Categoria", accessor: "categoria" },
              { header: "Status", accessor: "status" },
            ]}
          />
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
          <div className="flex flex-wrap items-center gap-2">
            <EmpresaFilter value={empresaFilter} onChange={setEmpresaFilter} />
            <div className="flex items-center gap-2 min-w-[200px]">
              <Target className="size-4 text-muted-foreground shrink-0" />
              <SelectField
                label=""
                value={missaoFilter === "" ? "__all__" : missaoFilter}
                onChange={(v) => setMissaoFilter(v === "__all__" ? "" : v)}
                options={[{ value: "__all__", label: "Todas as missões" }, ...(missoes ?? []).map((m) => ({ value: m.id, label: m.nome }))]}
              />
            </div>
            <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} className="h-9 w-[150px]" title="Vencimento — de" />
            <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} className="h-9 w-[150px]" title="Vencimento — até" />
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
                        Restante <span className="text-primary">{formatCurrency(g.restante)}</span>
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
