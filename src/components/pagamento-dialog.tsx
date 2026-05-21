import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CurrencyField, SelectField, TextField, TextAreaField } from "@/components/form-fields";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

type Recebivel = {
  id: string;
  pagador: string;
  valor_parcela: number;
  valor_total: number;
  valor_pago: number;
  numero_parcela: number;
  parcelas: number;
};

type Despesa = {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number;
  numero_parcela: number;
  parcelas: number;
};

type Pagamento = {
  id: string;
  data_pagamento: string;
  valor: number;
  forma_pagamento: string;
  observacao: string | null;
  created_at: string;
};

const FORMAS = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props =
  | { recebivel: Recebivel | null; despesa?: undefined; open: boolean; onOpenChange: (v: boolean) => void }
  | { despesa: Despesa | null; recebivel?: undefined; open: boolean; onOpenChange: (v: boolean) => void };

export function PagamentoDialog(props: Props) {
  const { open, onOpenChange } = props;
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const mode: "recebivel" | "despesa" = "despesa" in props && props.despesa !== undefined ? "despesa" : "recebivel";
  const target = mode === "despesa" ? (props as any).despesa : (props as any).recebivel;

  const titulo = mode === "despesa" ? "Registrar pagamento da despesa" : "Registrar pagamento";
  const nome = mode === "despesa" ? target?.descricao : target?.pagador;
  const valorAlvo = mode === "despesa"
    ? Number(target?.valor ?? 0)
    : Number(target?.valor_parcela ?? target?.valor_total ?? 0);
  const valorPago = Number(target?.valor_pago ?? 0);
  const restante = Math.max(valorAlvo - valorPago, 0);

  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState<number>(restante);
  const [forma, setForma] = useState<string>("pix");
  const [obs, setObs] = useState<string>("");

  useEffect(() => {
    if (open && target) {
      setData(todayISO());
      setValor(restante > 0 ? restante : valorAlvo);
      setForma("pix");
      setObs("");
    }
  }, [open, target?.id]); // eslint-disable-line

  const filterCol = mode === "despesa" ? "despesa_id" : "recebivel_id";

  const { data: pagamentos } = useQuery({
    queryKey: ["pagamentos", mode, target?.id],
    enabled: !!target?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_pagamento" as any)
        .select("*")
        .eq(filterCol, target!.id)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Pagamento[];
    },
  });

  const createPagamento = useMutation({
    mutationFn: async () => {
      if (!target) return;
      if (!valor || valor <= 0) throw new Error("Valor inválido");
      const { data: auth } = await supabase.auth.getUser();
      const payload: any = {
        data_pagamento: data,
        valor,
        forma_pagamento: forma,
        observacao: obs || null,
        user_id: auth.user?.id ?? null,
      };
      if (mode === "despesa") payload.despesa_id = target.id;
      else payload.recebivel_id = target.id;
      const { error } = await supabase.from("registros_pagamento" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["pagamentos", mode, target?.id] });
      qc.invalidateQueries({ queryKey: ["recebiveis"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      qc.invalidateQueries({ queryKey: ["dash-recebiveis"] });
      qc.invalidateQueries({ queryKey: ["dash-pagamentos"] });
      setValor(0);
      setObs("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePagamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registros_pagamento" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento removido");
      qc.invalidateQueries({ queryKey: ["pagamentos", mode, target?.id] });
      qc.invalidateQueries({ queryKey: ["recebiveis"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                <span className="font-medium">{nome}</span>
                {target.parcelas > 1 && <> — Parcela {target.numero_parcela}/{target.parcelas}</>}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor</div>
            <div className="font-semibold tabular-nums">{formatCurrency(valorAlvo)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Já {mode === "despesa" ? "pago" : "recebido"}</div>
            <div className="font-semibold tabular-nums text-success">{formatCurrency(valorPago)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Restante</div>
            <div className="font-semibold tabular-nums text-primary">{formatCurrency(restante)}</div>
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); createPagamento.mutate(); }}
          className="grid grid-cols-2 gap-3"
        >
          <TextField label="Data do pagamento" type="date" value={data} onChange={setData} required />
          <CurrencyField label={mode === "despesa" ? "Valor pago" : "Valor recebido"} value={valor} onChange={setValor} required />
          <SelectField label="Forma de pagamento" value={forma} onChange={setForma} options={FORMAS} />
          <div className="col-span-2">
            <TextAreaField label="Observação" value={obs} onChange={setObs} />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" disabled={createPagamento.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {createPagamento.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Registrar pagamento
            </Button>
          </div>
        </form>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Histórico de pagamentos
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            {pagamentos && pagamentos.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Data</th>
                    <th className="text-right px-3 py-2 font-medium">Valor</th>
                    <th className="text-left px-3 py-2 font-medium">Forma</th>
                    <th className="text-left px-3 py-2 font-medium">Obs</th>
                    {isAdmin && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.map((p) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="px-3 py-2 tabular-nums">{formatDate(p.data_pagamento)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(p.valor)}</td>
                      <td className="px-3 py-2 capitalize">{p.forma_pagamento}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.observacao ?? "—"}</td>
                      {isAdmin && (
                        <td className="px-2 py-2 text-right">
                          <Button size="icon" variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => removePagamento.mutate(p.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-6">Nenhum pagamento registrado.</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
