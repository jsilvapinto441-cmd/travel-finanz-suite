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
import {
  executeImport,
  listEmpresasQuick,
  IMPORT_MODULES,
  type ImportModule,
} from "@/lib/ai-assistant.functions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Loader2, CheckCircle2 } from "lucide-react";

export type ImportItem = Record<string, unknown>;

const MODULE_LABEL: Record<ImportModule, string> = {
  despesas: "Despesas",
  recebiveis: "Recebíveis",
  fornecedores: "Fornecedores",
  funcionarios: "Funcionários",
  empresas: "Empresas",
  bancos: "Bancos",
  missoes: "Missões",
  contratos: "Contratos",
};

// Colunas exibidas na prévia por módulo (chave → label + tipo)
const MODULE_COLUMNS: Record<
  ImportModule,
  { key: string; label: string; type: "text" | "number" | "date" }[]
> = {
  despesas: [
    { key: "descricao", label: "Descrição", type: "text" },
    { key: "categoria", label: "Categoria", type: "text" },
    { key: "data_vencimento", label: "Vencimento", type: "date" },
    { key: "valor", label: "Valor", type: "number" },
  ],
  recebiveis: [
    { key: "pagador", label: "Pagador", type: "text" },
    { key: "categoria", label: "Categoria", type: "text" },
    { key: "data_vencimento", label: "Vencimento", type: "date" },
    { key: "parcelas", label: "Parcelas", type: "number" },
    { key: "valor_total", label: "Valor total", type: "number" },
  ],
  fornecedores: [
    { key: "nome", label: "Nome", type: "text" },
    { key: "cnpj", label: "CNPJ", type: "text" },
    { key: "email", label: "E-mail", type: "text" },
    { key: "telefone", label: "Telefone", type: "text" },
    { key: "responsavel", label: "Responsável", type: "text" },
  ],
  funcionarios: [
    { key: "nome", label: "Nome", type: "text" },
    { key: "cargo", label: "Cargo", type: "text" },
    { key: "salario", label: "Salário", type: "number" },
    { key: "data_admissao", label: "Admissão", type: "date" },
  ],
  empresas: [
    { key: "nome", label: "Nome", type: "text" },
    { key: "cnpj", label: "CNPJ", type: "text" },
    { key: "razao_social", label: "Razão social", type: "text" },
  ],
  bancos: [
    { key: "banco", label: "Banco", type: "text" },
    { key: "agencia", label: "Agência", type: "text" },
    { key: "conta", label: "Conta", type: "text" },
    { key: "titular", label: "Titular", type: "text" },
    { key: "saldo_inicial", label: "Saldo", type: "number" },
  ],
  missoes: [
    { key: "nome", label: "Nome", type: "text" },
    { key: "descricao", label: "Descrição", type: "text" },
  ],
  contratos: [
    { key: "cliente", label: "Cliente", type: "text" },
    { key: "destino", label: "Destino", type: "text" },
    { key: "data_inicio", label: "Início", type: "date" },
    { key: "parcelas", label: "Parcelas", type: "number" },
    { key: "valor", label: "Valor", type: "number" },
  ],
};

// Módulos que aceitam vínculo com empresa
const MODULES_WITH_EMPRESA: ImportModule[] = [
  "despesas",
  "recebiveis",
  "funcionarios",
  "contratos",
];

export function ImportPreviewDialog({
  open,
  onOpenChange,
  module: initialModule,
  items,
  summary,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  module: ImportModule;
  items: ImportItem[];
  summary?: string;
  onConfirmed?: (result: { inserted: number; module: ImportModule }) => void;
}) {
  const [module, setModule] = useState<ImportModule>(initialModule);
  const [rows, setRows] = useState<ImportItem[]>(items);
  const [empresaId, setEmpresaId] = useState<string>("");
  const listEmp = useServerFn(listEmpresasQuick);
  const execute = useServerFn(executeImport);

  const empresasQ = useQuery({
    queryKey: ["ai-import-empresas"],
    queryFn: () => listEmp(),
    enabled: open && MODULES_WITH_EMPRESA.includes(module),
  });

  const columns = MODULE_COLUMNS[module];

  const total = rows.reduce((sum, r) => {
    const v = Number(r.valor ?? r.valor_total ?? r.salario ?? r.saldo_inicial ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const mut = useMutation({
    mutationFn: async () => {
      const result = await execute({
        data: {
          module,
          empresa_id: MODULES_WITH_EMPRESA.includes(module)
            ? empresaId || undefined
            : undefined,
          items: rows,
        },
      });
      return result;
    },
    onSuccess: (r) => {
      if (r.errors.length) {
        toast.warning(
          `${r.inserted} registro(s) importado(s). Erros: ${r.errors.join(" · ")}`,
        );
      } else {
        toast.success(
          `${r.inserted} registro(s) importado(s) em ${MODULE_LABEL[r.module]}.`,
        );
      }
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
            Prévia da importação · {MODULE_LABEL[module]}
          </DialogTitle>
          <DialogDescription>
            {summary ??
              "Revise os registros identificados antes de gravar no sistema."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground mb-1">Módulo destino</div>
            <Select
              value={module}
              onValueChange={(v) => setModule(v as ImportModule)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_MODULES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODULE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Registros</div>
            <div className="text-lg font-semibold">{rows.length}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-semibold text-primary">
              {formatCurrency(total)}
            </div>
          </div>
          {MODULES_WITH_EMPRESA.includes(module) && (
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
          )}
        </div>

        <div className="max-h-[45vh] overflow-y-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`text-${c.type === "number" ? "right" : "left"} p-2 font-medium`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Nenhum registro identificado.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c) => {
                    const v = r[c.key];
                    return (
                      <td key={c.key} className="p-1.5">
                        <Input
                          type={c.type === "date" ? "date" : c.type === "number" ? "number" : "text"}
                          step={c.type === "number" ? "0.01" : undefined}
                          value={v === null || v === undefined ? "" : String(v)}
                          className={`h-8 ${c.type === "number" ? "text-right" : ""}`}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const next =
                              c.type === "number"
                                ? raw === ""
                                  ? null
                                  : parseFloat(raw)
                                : raw || null;
                            updateRow(i, { [c.key]: next });
                          }}
                        />
                      </td>
                    );
                  })}
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
