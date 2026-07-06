import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { TextField, CurrencyField, SelectField, TextAreaField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BANCOS_PRE_CADASTRADOS, TIPOS_CONTA, useContasBancarias, useSaldosBancarios,
  type ContaBancaria,
} from "@/lib/bancos";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Landmark } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { deleteRecord, CONFIRM_DELETE_MESSAGE } from "@/lib/delete-record";

export const Route = createFileRoute("/_app/bancos")({ component: Page });

const defaults: Partial<ContaBancaria> = {
  tipo: "corrente",
  ativo: true,
  saldo_inicial: 0,
};

function Page() {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const { data, isLoading } = useContasBancarias();
  const { data: saldos } = useSaldosBancarios();
  const { data: empresas } = useQuery({
    queryKey: ["empresas-por-conta"],
    queryFn: async () => (await supabase.from("empresas").select("id, nome, conta_bancaria_id").order("nome")).data ?? [],
    staleTime: 30_000,
  });

  const empresaPorConta = new Map((empresas ?? []).map((e) => [e.conta_bancaria_id, e.nome]));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [values, setValues] = useState<Partial<ContaBancaria>>(defaults);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [customBanco, setCustomBanco] = useState("");

  const upsert = useMutation({
    mutationFn: async (payload: Partial<ContaBancaria>) => {
      const data: any = { ...payload };
      if (data.banco === "__custom__") data.banco = customBanco.trim();
      if (!data.banco) throw new Error("Informe o nome do banco");
      if (editing) {
        const { error } = await supabase.from("contas_bancarias" as any).update(data).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_bancarias" as any).insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contas-bancarias"] });
      qc.invalidateQueries({ queryKey: ["saldos-bancarios"] });
      toast.success(editing ? "Conta atualizada" : "Conta cadastrada");
      setOpen(false); setEditing(null); setValues(defaults); setCustomBanco("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteRecord("contas_bancarias", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contas-bancarias"] });
      qc.invalidateQueries({ queryKey: ["saldos-bancarios"] });
      toast.success("Conta excluída com sucesso");
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setValues(defaults); setCustomBanco(""); setOpen(true); };
  const openEdit = (c: ContaBancaria) => {
    setEditing(c);
    setValues(c);
    setCustomBanco(BANCOS_PRE_CADASTRADOS.includes(c.banco as any) ? "" : c.banco);
    setOpen(true);
  };

  const bancoOptions = [
    ...BANCOS_PRE_CADASTRADOS.map((b) => ({ value: b, label: b })),
    { value: "__custom__", label: "+ Outro banco (informar)" },
  ];

  const totalSaldo = (data ?? []).reduce(
    (acc, c) => acc + (saldos?.get(c.id) ?? Number(c.saldo_inicial ?? 0)),
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Bancos e Contas"
        description="Cadastre suas contas bancárias para vincular pagamentos e recebimentos."
        actions={
          <div className="flex gap-2">
            <ExportButton<ContaBancaria>
              title="Contas Bancárias"
              filename="contas_bancarias"
              rows={data ?? []}
              columns={[
                { header: "Banco", accessor: "banco" },
                { header: "Empresa", accessor: (r) => empresaPorConta.get(r.id) ?? "—" },
                { header: "Tipo", accessor: "tipo" },
                { header: "Agência", accessor: "agencia" },
                { header: "Conta", accessor: (r) => r.conta ? `${r.conta}${r.digito ? "-" + r.digito : ""}` : "" },
                { header: "Titular", accessor: "titular" },
                { header: "Documento", accessor: "documento" },
                { header: "PIX", accessor: "chave_pix" },
                { header: "Saldo inicial", accessor: (r) => formatCurrency(Number(r.saldo_inicial)) },
                { header: "Saldo atual", accessor: (r) => formatCurrency(saldos?.get(r.id) ?? Number(r.saldo_inicial ?? 0)) },
                { header: "Status", accessor: (r) => (r.ativo ? "Ativa" : "Inativa") },
              ]}
            />
            {canEdit && (
              <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="size-4 mr-1" /> Nova conta
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-4 mb-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Landmark className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo consolidado</div>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(totalSaldo)}</div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !data?.length ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Landmark className="size-10 mx-auto mb-3 opacity-40" />
          <div className="font-medium mb-1">Nenhuma conta cadastrada</div>
          <div className="text-sm">Cadastre uma conta para começar a usar o fluxo de caixa automático.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.map((c) => {
            const saldo = saldos?.get(c.id) ?? Number(c.saldo_inicial ?? 0);
            return (
              <Card key={c.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2">
                      {c.banco}
                      {!c.ativo && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.agencia ? `Ag. ${c.agencia}` : "—"} · {c.conta ? `CC ${c.conta}${c.digito ? "-" + c.digito : ""}` : "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{c.tipo}</div>
                    {empresaPorConta.get(c.id) && (
                      <div className="text-[11px] text-primary font-medium mt-0.5 truncate">
                        {empresaPorConta.get(c.id)}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button size="icon" variant="ghost"
                          onClick={() => setDeletingId(c.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo atual</div>
                  <div className={"text-xl font-semibold tabular-nums " + (saldo < 0 ? "text-destructive" : "")}>
                    {formatCurrency(saldo)}
                  </div>
                </div>
                {c.chave_pix && (
                  <div className="text-[11px] text-muted-foreground truncate">PIX: {c.chave_pix}</div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setValues(defaults); setCustomBanco(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conta bancária" : "Nova conta bancária"}</DialogTitle>
            <DialogDescription>Esta conta poderá ser usada nas baixas de recebíveis e despesas.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(values); }} className="grid grid-cols-2 gap-3">
            <SelectField label="Banco" value={values.banco ?? ""} onChange={(v) => setValues({ ...values, banco: v })}
              options={bancoOptions} />
            {values.banco === "__custom__" && (
              <TextField label="Nome do banco" value={customBanco} onChange={setCustomBanco} required />
            )}
            <SelectField label="Tipo de conta" value={values.tipo ?? "corrente"} onChange={(v) => setValues({ ...values, tipo: v })}
              options={TIPOS_CONTA} />
            <TextField label="Agência" value={values.agencia} onChange={(v) => setValues({ ...values, agencia: v })} />
            <TextField label="Conta" value={values.conta} onChange={(v) => setValues({ ...values, conta: v })} />
            <TextField label="Dígito" value={values.digito} onChange={(v) => setValues({ ...values, digito: v })} />
            <TextField label="Titular" value={values.titular} onChange={(v) => setValues({ ...values, titular: v })} />
            <TextField label="CPF / CNPJ" value={values.documento} onChange={(v) => setValues({ ...values, documento: v })} />
            <TextField label="Chave PIX" value={values.chave_pix} onChange={(v) => setValues({ ...values, chave_pix: v })} />
            <CurrencyField label="Saldo inicial" value={values.saldo_inicial} onChange={(v) => setValues({ ...values, saldo_inicial: v })} />
            <SelectField label="Status" value={values.ativo === false ? "inativa" : "ativa"}
              onChange={(v) => setValues({ ...values, ativo: v === "ativa" })}
              options={[{ value: "ativa", label: "Ativa" }, { value: "inativa", label: "Inativa" }]} />
            <div className="col-span-2">
              <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
            </div>
            <DialogFooter className="col-span-2">
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
    </PageContainer>
  );
}
