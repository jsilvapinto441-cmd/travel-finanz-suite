import { Button } from "@/components/ui/button";
import { CurrencyField, SelectField, TextField } from "@/components/form-fields";
import { formatCurrency } from "@/lib/format";
import { TIPOS_ABATIMENTO, type Abatimento } from "@/lib/abatimentos";
import { Plus, Trash2 } from "lucide-react";

export type AbatimentoDraft = Abatimento & { _new?: boolean };

export function AbatimentosRecebivel({
  valorOriginal,
  rows,
  onChange,
}: {
  valorOriginal: number;
  rows: AbatimentoDraft[];
  onChange: (rows: AbatimentoDraft[]) => void;
}) {
  const total = rows.reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const liquido = Math.max(valorOriginal - total, 0);

  const add = () =>
    onChange([
      ...rows,
      {
        id: crypto.randomUUID(),
        tipo: "reembolso",
        valor: 0,
        descricao: "",
        data_abatimento: null,
        _new: true,
      },
    ]);

  const patch = (id: string, p: Partial<AbatimentoDraft>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Abatimentos (reembolso, comissão, desconto)
        </div>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="size-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhum abatimento. O valor líquido a receber é igual ao valor original da fatura.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-md bg-muted/20 p-2">
              <div className="sm:col-span-3">
                <SelectField
                  label="Tipo"
                  value={r.tipo}
                  onChange={(v) => patch(r.id, { tipo: v })}
                  options={TIPOS_ABATIMENTO}
                />
              </div>
              <div className="sm:col-span-3">
                <CurrencyField label="Valor" value={r.valor} onChange={(v) => patch(r.id, { valor: v })} />
              </div>
              <div className="sm:col-span-3">
                <TextField
                  label="Data"
                  type="date"
                  value={r.data_abatimento ?? ""}
                  onChange={(v) => patch(r.id, { data_abatimento: v || null })}
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label="Observação"
                  value={r.descricao ?? ""}
                  onChange={(v) => patch(r.id, { descricao: v })}
                />
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor da fatura</div>
          <div className="font-semibold tabular-nums">{formatCurrency(valorOriginal)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Abatimentos</div>
          <div className="font-semibold tabular-nums text-destructive">− {formatCurrency(total)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Líquido a receber</div>
          <div className="font-semibold tabular-nums text-primary">{formatCurrency(liquido)}</div>
        </div>
      </div>
    </div>
  );
}
