import { type ReactNode, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

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
}

export function DataTable<T extends { id: string }>({
  table, title, columns, searchFields = [], renderForm, defaultValues = {},
  orderBy = "created_at", ascending = false, filter, toolbar, emptyHint,
}: DataTableProps<T>) {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<Partial<T>>(defaultValues);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [table, orderBy, ascending],
    queryFn: async () => {
      const { data, error } = await supabase.from(table as any).select("*").order(orderBy, { ascending });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<T>) => {
      if (editing) {
        const { error } = await supabase.from(table as any).update(payload as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert(payload as any);
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
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Excluído");
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setValues(defaultValues);
    setOpen(true);
  }
  function openEdit(row: T) {
    setEditing(row);
    setValues(row);
    setOpen(true);
  }

  const filtered = (data ?? [])
    .filter(filter ?? (() => true))
    .filter((row) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return searchFields.some((k) => String((row as any)[k] ?? "").toLowerCase().includes(q));
    });

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar..." value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            {toolbar}
          </div>
          {canEdit && (
            <Button onClick={openNew} className="gradient-emerald text-primary-foreground">
              <Plus className="size-4 mr-1" /> Novo
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
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
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-12">
                    <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">
                    {emptyHint ?? "Nenhum registro encontrado."}
                  </TableCell>
                </TableRow>
              ) : filtered.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost"
                            onClick={() => setDeletingId(row.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
              <Button type="submit" disabled={upsert.isPending} className="gradient-emerald text-primary-foreground">
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
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && remove.mutate(deletingId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
