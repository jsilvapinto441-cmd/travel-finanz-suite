import { type ReactNode, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/use-debounce";
import { deleteRecord, CONFIRM_DELETE_MESSAGE } from "@/lib/delete-record";
import { sanitizeUpdatePayload } from "@/lib/sanitize-update";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  table: string;
  title: string;
  columns: Column<T>[];
  searchFields?: (keyof T)[];
  renderForm: (state: {
    values: Partial<T>;
    setValues: React.Dispatch<React.SetStateAction<Partial<T>>>;
  }) => ReactNode;
  defaultValues?: Partial<T>;
  orderBy?: string;
  ascending?: boolean;
  filter?: (row: T) => boolean;
  toolbar?: ReactNode;
  emptyHint?: string;
  pageSize?: number;
  extraRowActions?: (row: T) => ReactNode;
  onAfterSave?: (savedId: string, values: Partial<T>, mode: "create" | "update") => Promise<void> | void;
}

export function DataTable<T extends { id: string }>({
  table, title, columns, searchFields = [], renderForm, defaultValues = {},
  orderBy = "created_at", ascending = false, filter, toolbar, emptyHint,
  pageSize = 50, extraRowActions,
}: DataTableProps<T>) {
  const qc = useQueryClient();
  const { canEdit } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 200);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<Partial<T>>(defaultValues);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [table, orderBy, ascending],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as any)
        .select("*")
        .order(orderBy, { ascending });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
    placeholderData: keepPreviousData,
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (filter) rows = rows.filter(filter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        searchFields.some((k) => String((row as any)[k] ?? "").toLowerCase().includes(q))
      );
    }
    return rows;
  }, [data, filter, search, searchFields]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [filtered, safePage, pageSize]
  );

  const upsert = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      if (editing) {
        const clean = sanitizeUpdatePayload(table, payload);
        const { error } = await supabase.from(table as any).update(clean as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const clean = sanitizeUpdatePayload(table, payload);
        const { error } = await supabase.from(table as any).insert(clean as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(editing ? "Atualizado com sucesso" : "Criado com sucesso");
      setOpen(false); setEditing(null); setValues(defaultValues);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteRecord(table, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Registro excluído com sucesso");
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = useCallback(() => {
    setEditing(null);
    setValues(defaultValues);
    setOpen(true);
  }, [defaultValues]);

  const openEdit = useCallback((row: T) => {
    setEditing(row);
    setValues(row);
    setOpen(true);
  }, []);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between border-b">
          <div className="flex flex-1 gap-2 items-center min-w-0">
            <div className="relative flex-1 sm:max-w-sm min-w-0">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Buscar..."
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
              />
            </div>
            {toolbar}
            {isFetching && !isLoading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
            )}
          </div>
          {canEdit && (
            <Button onClick={openNew} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4 mr-1" /> Novo
            </Button>
          )}
        </div>

        {/* Vista tabela — apenas em sm+ (mantém experiência desktop intacta) */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.className}>{c.label}</TableHead>
                ))}
                {canEdit && <TableHead className="w-24 text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.className}>
                        <Skeleton className="h-4 w-full max-w-[160px]" />
                      </TableCell>
                    ))}
                    {canEdit && <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">
                    {emptyHint ?? "Nenhum registro encontrado."}
                  </TableCell>
                </TableRow>
              ) : pageRows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {extraRowActions?.(row)}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost"
                          onClick={() => setDeletingId(row.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Vista cards — apenas mobile. Mesmos dados/render/columns, layout stacked. */}
        <div className="sm:hidden divide-y">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          ) : pageRows.length === 0 ? (
            <div className="text-center py-12 px-4 text-sm text-muted-foreground">
              {emptyHint ?? "Nenhum registro encontrado."}
            </div>
          ) : pageRows.map((row) => (
            <div key={row.id} className="p-4 active:bg-accent/40 transition-colors">
              <dl className="space-y-1.5">
                {columns.map((c, idx) => {
                  const content = c.render ? c.render(row) : String((row as any)[c.key] ?? "—");
                  // Primeira coluna vira o "título" do card em destaque
                  if (idx === 0) {
                    return (
                      <div key={c.key} className="mb-2">
                        <dd className="text-base font-semibold leading-tight break-words">
                          {content}
                        </dd>
                      </div>
                    );
                  }
                  return (
                    <div key={c.key} className="grid grid-cols-[minmax(0,90px)_minmax(0,1fr)] gap-2 items-start">
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium pt-0.5">
                        {c.label}
                      </dt>
                      <dd className="text-sm text-foreground break-words min-w-0 text-right">
                        {content}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {canEdit && (
                <div className="mt-3 pt-3 border-t flex justify-end gap-1">
                  {extraRowActions?.(row)}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(row)} className="gap-1">
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => setDeletingId(row.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1">
                    <Trash2 className="size-3.5" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <div className="text-muted-foreground text-xs sm:text-sm">
              <span className="hidden sm:inline">{safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, total)} de </span>
              {total} <span className="sm:hidden">itens</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-muted-foreground tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <Button size="icon" variant="outline" disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>


      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setValues(defaultValues); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${title}` : `Novo ${title}`}</DialogTitle>
            <DialogDescription>Preencha os campos abaixo</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(values); }} className="space-y-4">
            {renderForm({ values, setValues })}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
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
    </>
  );
}
