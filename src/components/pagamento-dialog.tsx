import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Paperclip, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CurrencyField, SelectField, TextField, TextAreaField, Field } from "@/components/form-fields";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useContasBancariasComEmpresa } from "@/lib/bancos";
import { Link } from "@tanstack/react-router";
import { validateDateString } from "@/lib/date-validation";


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
  conta_bancaria_id: string | null;
  comprovante_path: string | null;
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
  const { isAdmin, user } = useAuth();
  const { data: contas } = useContasBancariasComEmpresa({ ativas: true });

  const mode: "recebivel" | "despesa" = "despesa" in props && props.despesa !== undefined ? "despesa" : "recebivel";
  const target = mode === "despesa" ? (props as any).despesa : (props as any).recebivel;

  const titulo = mode === "despesa" ? "Registrar pagamento da despesa" : "Registrar recebimento";
  const nome = mode === "despesa" ? target?.descricao : target?.pagador;
  const valorAlvo = mode === "despesa"
    ? Number(target?.valor ?? 0)
    : Number(target?.valor_parcela ?? target?.valor_total ?? 0);
  const valorPago = Number(target?.valor_pago ?? 0);
  const restante = Math.max(valorAlvo - valorPago, 0);

  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState<number>(restante);
  const [forma, setForma] = useState<string>("pix");
  const [contaId, setContaId] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Pagamento | null>(null);

  useEffect(() => {
    if (open && target) {
      setData(todayISO());
      setValor(restante > 0 ? restante : valorAlvo);
      setForma("pix");
      setContaId("");
      setObs("");
      setComprovante(null);
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
      if (restante <= 0) throw new Error("Este item já está quitado. Edite um pagamento existente no histórico abaixo.");

      let comprovante_path: string | null = null;
      if (comprovante && user) {
        setUploading(true);
        const ext = (comprovante.name.split(".").pop() ?? "bin").toLowerCase();
        const path = `${user.id}/comprovantes/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("anexos").upload(path, comprovante, {
          contentType: comprovante.type || undefined,
          upsert: false,
        });
        setUploading(false);
        if (upErr) throw upErr;
        comprovante_path = path;
      }

      const { data: auth } = await supabase.auth.getUser();
      const payload: any = {
        data_pagamento: data,
        valor,
        forma_pagamento: forma,
        observacao: obs || null,
        user_id: auth.user?.id ?? null,
        conta_bancaria_id: contaId || null,
        comprovante_path,
      };
      if (mode === "despesa") payload.despesa_id = target.id;
      else payload.recebivel_id = target.id;
      const { error } = await supabase.from("registros_pagamento" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(mode === "despesa" ? "Pagamento registrado" : "Recebimento registrado");
      qc.invalidateQueries({ queryKey: ["pagamentos", mode, target?.id] });
      qc.invalidateQueries({ queryKey: ["recebiveis"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      qc.invalidateQueries({ queryKey: ["dash-recebiveis"] });
      qc.invalidateQueries({ queryKey: ["dash-pagamentos"] });
      qc.invalidateQueries({ queryKey: ["fluxo-caixa"] });
      qc.invalidateQueries({ queryKey: ["saldos-bancarios"] });
      setValor(0);
      setObs("");
      setComprovante(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: Error) => { setUploading(false); toast.error(e.message); },
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
      qc.invalidateQueries({ queryKey: ["fluxo-caixa"] });
      qc.invalidateQueries({ queryKey: ["saldos-bancarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePagamento = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pagamento> }) => {
      const { error } = await supabase
        .from("registros_pagamento" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
      // Sincroniza também a movimentação já lançada (se houver) para refletir
      // no fluxo de caixa/saldos sem duplicar registros.
      const movPatch: Record<string, unknown> = {};
      if (patch.data_pagamento !== undefined) movPatch.data_movimentacao = patch.data_pagamento;
      if (patch.valor !== undefined) movPatch.valor = patch.valor;
      if (patch.forma_pagamento !== undefined) movPatch.forma_pagamento = patch.forma_pagamento;
      if (patch.conta_bancaria_id !== undefined) movPatch.conta_bancaria_id = patch.conta_bancaria_id;
      if (patch.observacao !== undefined) movPatch.observacao = patch.observacao;
      if (Object.keys(movPatch).length) {
        await supabase
          .from("movimentacoes_financeiras" as any)
          .update(movPatch as any)
          .eq("registro_pagamento_id", id);
      }
    },
    onSuccess: () => {
      toast.success("Pagamento atualizado");
      qc.invalidateQueries({ queryKey: ["pagamentos", mode, target?.id] });
      qc.invalidateQueries({ queryKey: ["recebiveis"] });
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["fluxo-caixa"] });
      qc.invalidateQueries({ queryKey: ["saldos-bancarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function abrirComprovante(path: string) {
    const { data, error } = await supabase.storage.from("anexos").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  const contaOptions = (contas ?? []).map((c) => ({ value: c.id, label: c.label }));

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

        {restante > 0 ? (
        <form
          onSubmit={(e) => { e.preventDefault(); createPagamento.mutate(); }}
          className="grid grid-cols-2 gap-3"
        >
          <TextField label="Data do pagamento" type="date" value={data} onChange={setData} required />
          <CurrencyField label={mode === "despesa" ? "Valor pago" : "Valor recebido"} value={valor} onChange={setValor} required />
          <SelectField label="Forma de pagamento" value={forma} onChange={setForma} options={FORMAS} />
          <SelectField
            label={mode === "despesa" ? "Banco de saída" : "Banco de entrada"}
            value={contaId}
            onChange={setContaId}
            options={contaOptions.length ? contaOptions : [{ value: "", label: "Nenhuma conta cadastrada" }]}
            placeholder={contaOptions.length ? "Selecionar conta..." : "Cadastre uma conta em /bancos"}
          />
          {!contaOptions.length && (
            <div className="col-span-2 text-xs text-muted-foreground rounded-md bg-muted/30 p-2">
              Sem conta selecionada, esta baixa não atualizará o fluxo de caixa.{" "}
              <Link to="/bancos" className="text-primary underline">Cadastrar conta agora</Link>
            </div>
          )}
          <div className="col-span-2">
            <TextAreaField label="Observação" value={obs} onChange={setObs} />
          </div>
          <div className="col-span-2">
            <Field label="Comprovante (opcional)">
              {comprovante ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-sm">
                  <Paperclip className="size-3.5 text-muted-foreground" />
                  <span className="truncate flex-1">{comprovante.name}</span>
                  <Button type="button" size="icon" variant="ghost" className="size-7"
                    onClick={() => { setComprovante(null); if (fileRef.current) fileRef.current.value = ""; }}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                />
              )}
            </Field>
          </div>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" disabled={createPagamento.isPending || uploading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {(createPagamento.isPending || uploading) && <Loader2 className="size-4 animate-spin mr-2" />}
              {mode === "despesa" ? "Registrar pagamento" : "Registrar recebimento"}
            </Button>
          </div>
        </form>
        ) : (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="font-medium text-primary mb-1">
              {mode === "despesa" ? "Despesa já quitada" : "Recebimento concluído"}
            </div>
            <div className="text-muted-foreground text-xs">
              Para alterar a data, valor, forma de pagamento ou banco, use o botão <Pencil className="inline size-3 mx-0.5" /> na coluna de ações do histórico abaixo.
            </div>
          </div>
        )}

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
                    <th className="text-left px-3 py-2 font-medium">Conta</th>
                    <th className="text-left px-3 py-2 font-medium">Comp.</th>
                    <th className="w-10" />
                    {isAdmin && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.map((p) => {
                    const conta = contas?.find((c) => c.id === p.conta_bancaria_id);
                    return (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="px-3 py-2 tabular-nums">{formatDate(p.data_pagamento)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(p.valor)}</td>
                        <td className="px-3 py-2 capitalize">{p.forma_pagamento}</td>
                        <td className="px-3 py-2 text-muted-foreground">{conta?.banco ?? "—"}</td>
                        <td className="px-3 py-2">
                          {p.comprovante_path ? (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                              onClick={() => abrirComprovante(p.comprovante_path!)}>
                              <Paperclip className="size-3 mr-1" /> ver
                            </Button>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Button size="icon" variant="ghost" className="size-8"
                            title="Editar pagamento"
                            onClick={() => setEditing(p)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        </td>
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
                    );
                  })}
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

        <EditPagamentoDialog
          pagamento={editing}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          formas={FORMAS}
          contaOptions={contaOptions}
          onSave={async (patch) => {
            if (!editing) return;
            await updatePagamento.mutateAsync({ id: editing.id, patch });
            setEditing(null);
          }}
          saving={updatePagamento.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditPagamentoDialog({
  pagamento, onOpenChange, formas, contaOptions, onSave, saving,
}: {
  pagamento: Pagamento | null;
  onOpenChange: (v: boolean) => void;
  formas: { value: string; label: string }[];
  contaOptions: { value: string; label: string }[];
  onSave: (patch: Partial<Pagamento>) => Promise<void>;
  saving: boolean;
}) {
  const [data, setData] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [forma, setForma] = useState("");
  const [contaId, setContaId] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (pagamento) {
      setData(pagamento.data_pagamento);
      setValor(Number(pagamento.valor ?? 0));
      setForma(pagamento.forma_pagamento);
      setContaId(pagamento.conta_bancaria_id ?? "");
      setObs(pagamento.observacao ?? "");
    }
  }, [pagamento?.id]); // eslint-disable-line

  return (
    <Dialog open={!!pagamento} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar pagamento</DialogTitle>
          <DialogDescription>Ajuste os dados deste lançamento. As alterações substituem o registro atual.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = validateDateString(data);
            if (!res.ok) { toast.error(res.message); return; }
            if (!valor || valor <= 0) { toast.error("Valor inválido"); return; }
            await onSave({
              data_pagamento: data,
              valor,
              forma_pagamento: forma,
              conta_bancaria_id: contaId || null,
              observacao: obs || null,
            });
          }}
          className="grid grid-cols-2 gap-3"
        >
          <TextField label="Data do pagamento" type="date" value={data} onChange={setData} required />
          <CurrencyField label="Valor" value={valor} onChange={setValor} required />
          <SelectField label="Forma de pagamento" value={forma} onChange={setForma} options={formas} />
          <SelectField
            label="Conta bancária"
            value={contaId}
            onChange={setContaId}
            options={contaOptions.length ? contaOptions : [{ value: "", label: "Nenhuma conta cadastrada" }]}
            placeholder="Selecionar conta..."
          />
          <div className="col-span-2">
            <TextAreaField label="Observação" value={obs} onChange={setObs} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
