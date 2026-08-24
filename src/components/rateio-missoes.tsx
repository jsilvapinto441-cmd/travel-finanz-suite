import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CurrencyField, SelectField } from "@/components/form-fields";
import { formatCurrency } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export type RateioItem = { id?: string; missao_id: string; valor: number };

export function somaRateio(itens: RateioItem[]): number {
  return itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
}

/** Diferença (em centavos) entre o total da despesa e a soma do rateio. */
export function diferencaRateio(itens: RateioItem[], total: number): number {
  return Math.round(total * 100) - Math.round(somaRateio(itens) * 100);
}

export function RateioMissoes({
  itens,
  onChange,
  total,
  missoes,
}: {
  itens: RateioItem[];
  onChange: (next: RateioItem[]) => void;
  total: number;
  missoes: { id: string; nome: string }[];
}) {
  const soma = somaRateio(itens);
  const diffCents = diferencaRateio(itens, total);
  const usadas = useMemo(() => new Set(itens.map((i) => i.missao_id)), [itens]);

  const add = () => onChange([...itens, { missao_id: "", valor: 0 }]);
  const update = (idx: number, patch: Partial<RateioItem>) =>
    onChange(itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => onChange(itens.filter((_, i) => i !== idx));
  const distribuirRestante = (idx: number) =>
    update(idx, { valor: Math.max(0, Number(((Number(itens[idx]?.valor ?? 0) * 100 + diffCents) / 100).toFixed(2))) });

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Rateio por missão
        </Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="size-3.5 mr-1" /> Adicionar missão
        </Button>
      </div>

      {itens.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Opcional. Use para distribuir uma mesma fatura entre várias missões — o lançamento
          financeiro continua sendo único, com o valor total.
        </p>
      ) : (
        <div className="space-y-2">
          {itens.map((it, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <SelectField
                  label={idx === 0 ? "Missão" : ""}
                  value={it.missao_id}
                  onChange={(v) => update(idx, { missao_id: v })}
                  options={missoes
                    .filter((m) => m.id === it.missao_id || !usadas.has(m.id))
                    .map((m) => ({ value: m.id, label: m.nome }))}
                />
              </div>
              <div className="w-40 shrink-0">
                <CurrencyField
                  label={idx === 0 ? "Valor" : ""}
                  value={it.valor}
                  onChange={(v) => update(idx, { valor: v })}
                />
              </div>
              {diffCents !== 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 text-[11px] px-2"
                  onClick={() => distribuirRestante(idx)}
                >
                  Ajustar
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => remove(idx)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
            <span className="text-muted-foreground">
              Soma do rateio: <strong className="tabular-nums">{formatCurrency(soma)}</strong> de{" "}
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </span>
            {diffCents === 0 ? (
              <span className="text-success">Rateio conferido</span>
            ) : (
              <span className="text-destructive">
                {diffCents > 0 ? "Faltam " : "Excede "}
                {formatCurrency(Math.abs(diffCents) / 100)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
