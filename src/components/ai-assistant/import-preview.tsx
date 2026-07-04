import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { executeImport, listEmpresasQuick } from "@/lib/ai-assistant.functions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Loader2, CheckCircle2 } from "lucide-react";

export type ImportItem = {
  tipo: "despesa" | "receita";
  descricao: string;
  valor: number;
  data_vencimento?: string | null;
  categoria?: string | null;
  pagador_ou_fornecedor?: string | null;
  observacoes?: string | null;
};

export function ImportPreviewDialog({
  open,
  onOpenChange,
  items,
  summary,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: ImportItem[];
  summary?: string;
  onConfirmed?: (result: { despesas: number; recebiveis: number }) => void;
}) {
  const [rows, setRows] = useState<ImportItem[]>(items);
  const [empresaId, setEmpresaId] = useState<string>("");
  const listEmp = useServerFn(listEmpresasQuick);
  const execute = useServerFn(executeImport);

  const empresasQ = useQuery({
    queryKey: ["ai-import-empresas"],
    queryFn: () => listEmp(),
    enabled: open,
  });

  const totals = rows.reduce(
    (acc, r) => {
      if (r.tipo === "despesa") acc.despesas += r.valor;
      else acc.receitas += r.valor;
      return acc;
    },
    { despesas: 0, receitas: 0 },
  );

  const mut = useMutation({
    mutationFn: async () => {
      const result = await execute({
        data: {
          empresa_id: empresaId || undefined,
          items: rows,
        },
      });
      return result;
    },
    onSuccess: (r) => {
      toast.success(
        `Importado: ${r.despesas} despesa(s), ${r.recebiveis} receita(s).`,
      );
      onConfirmed?.(r);
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Falha ao importar: ${(e as Error).message}`),
  });

  function updateRow(i: number, patch: Partial<ImportItem>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            Prévia da importação
          </DialogTitle>
          <DialogDescription>
            {summary ??
              "Revise os lançamentos identificados antes de gravar no sistema."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Registros</div>
            <div className="text-lg font-semibold">{rows.length}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Total despesas</div>
            <div className="text-lg font-semibold text-destructive">
              {formatCurrency(totals.despesas)}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Total receitas</div>
            <div className="text-lg font-semibold text-primary">
              {formatCurrency(totals.receitas)}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground mb-1">Empresa</div>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Selecionar (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {(empresasQ.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">Tipo</th>
                <th className="text-left p-2 font-medium">Descrição</th>
                <th className="text-left p-2 font-medium">Categoria</th>
                <th className="text-left p-2 font-medium">Vencimento</th>
                <th className="text-right p-2 font-medium">Valor</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhum lançamento identificado.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <Select
                      value={r.tipo}
                      onValueChange={(v) =>
                        updateRow(i, { tipo: v as "despesa" | "receita" })
                      }
                    >
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="despesa">Despesa</SelectItem>
                        <SelectItem value="receita">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1.5">
                    <Input
                      value={r.descricao}
                      className="h-8"
                      onChange={(e) => updateRow(i, { descricao: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      value={r.categoria ?? ""}
                      className="h-8 w-36"
                      placeholder="outros"
                      onChange={(e) => updateRow(i, { categoria: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="date"
                      value={r.data_vencimento ?? ""}
                      className="h-8 w-40"
                      onChange={(e) =>
                        updateRow(i, { data_vencimento: e.target.value || null })
                      }
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={r.valor}
                      className="h-8 w-28 text-right"
                      onChange={(e) =>
                        updateRow(i, { valor: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="p-1.5">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || rows.length === 0}
          >
            {mut.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
            Importar para o sistema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
