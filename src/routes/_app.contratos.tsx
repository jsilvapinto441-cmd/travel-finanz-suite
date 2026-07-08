import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, NumberField, CurrencyField, SelectField, TextAreaField, Field } from "@/components/form-fields";
import { Input } from "@/components/ui/input";
import { useEmpresas, useMissoes, nomeById } from "@/lib/lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ExportButton } from "@/components/export-button";
import { CalendarDays, Plane, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/_app/contratos")({ component: Page });

type T = {
  id: string;
  empresa_id: string | null;
  missao_id: string | null;
  cliente: string;
  numero: string | null;
  destino: string | null;
  data_embarque: string | null;
  data_retorno: string | null;
  num_passageiros: number | null;
  tipo_servico: string | null;
  valor: number;
  valor_entrada: number;
  valor_saldo: number;
  parcelas: number;
  frequencia: string;
  dia_vencimento: number;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  observacoes: string | null;
  metodo_pagamento: string | null;
};

const TIPOS = [
  { value: "pacote_completo", label: "Pacote completo" },
  { value: "so_aereo", label: "Só aéreo" },
  { value: "so_hospedagem", label: "Só hospedagem" },
  { value: "personalizado", label: "Personalizado" },
];
const FREQS = [
  { value: "mensal", label: "Mensal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "semanal", label: "Semanal" },
  { value: "unico", label: "Único" },
];
const STATUS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "em_analise", label: "Em análise" },
  { value: "ativo", label: "Ativo" },
  { value: "aguardando_pagamento", label: "Aguardando pagamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];
const METODOS_PAGAMENTO = [
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "link_pagamento", label: "Link de pagamento" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "deposito", label: "Depósito" },
  { value: "ted", label: "TED" },
  { value: "transferencia_bancaria", label: "Transferência bancária" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function lastDayOfMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function addToDate(base: string, freq: string, n: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (freq === "unico") return base;
  if (freq === "semanal") dt.setDate(dt.getDate() + n * 7);
  else if (freq === "quinzenal") dt.setDate(dt.getDate() + n * 15);
  else dt.setMonth(dt.getMonth() + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function diffDays(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  const ms = new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
  return Math.round(ms / 86400000);
}

function addDays(base: string, days: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function ContratoForm({
  values, setValues,
  empresas, missoes,
}: {
  values: Partial<T>;
  setValues: React.Dispatch<React.SetStateAction<Partial<T>>>;
  empresas: { id: string; nome: string }[];
  missoes: { id: string; nome: string }[];
}) {
  const valor = Number(values.valor ?? 0);
  const entrada = Number(values.valor_entrada ?? 0);
  const saldo = Math.max(valor - entrada, 0);
  const parcelas = Math.max(1, Number(values.parcelas ?? 1));
  const freq = values.frequencia ?? "mensal";
  const dia = Math.min(31, Math.max(1, Number(values.dia_vencimento ?? 10)));
  const inicio = values.data_inicio ?? "";

  const preview = useMemo(() => {
    if (saldo <= 0 || !inicio) return [] as { i: number; valor: number; venc: string }[];
    const cents = Math.round(saldo * 100);
    const per = Math.floor(cents / parcelas);
    const rem = cents - per * parcelas;
    const [y, m] = inicio.split("-").map(Number);
    let base: string;
    if (freq === "mensal") {
      const dayClamped = Math.min(dia, lastDayOfMonth(y, m - 1));
      base = `${y}-${pad(m)}-${pad(dayClamped)}`;
    } else {
      base = inicio;
    }
    const n = freq === "unico" ? 1 : parcelas;
    return Array.from({ length: n }, (_, i) => ({
      i: i + 1,
      valor: (i === n - 1 ? per + rem : per) / 100,
      venc: addToDate(base, freq, i + 1),
    }));
  }, [saldo, parcelas, freq, dia, inicio]);

  // Quantidade de dias da viagem (calcula data_retorno automaticamente)
  const qtdDias = values.data_embarque && values.data_retorno
    ? Math.max(1, diffDays(values.data_embarque, values.data_retorno))
    : null;

  return (
    <div className="space-y-6">
      {/* Cliente & Viagem */}
      <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
          <Plane className="size-3.5" /> Cliente & viagem
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Cliente" value={values.cliente} onChange={(v) => setValues({ ...values, cliente: v })} required />
          <TextField label="Destino" value={values.destino} onChange={(v) => setValues({ ...values, destino: v })} />
          <TextField
            label="Data de embarque"
            type="date"
            value={values.data_embarque}
            onChange={(v) => {
              const dias = qtdDias ?? null;
              const novo: Partial<T> = { ...values, data_embarque: v };
              if (v && dias && dias >= 1) novo.data_retorno = addDays(v, dias);
              setValues(novo);
            }}
          />
          <Field label="Quantidade de dias">
            <Input
              type="number"
              min={1}
              value={qtdDias ?? ""}
              placeholder="Ex: 7"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setValues({ ...values, data_retorno: null });
                  return;
                }
                const d = Math.max(1, Math.floor(Number(raw) || 1));
                if (values.data_embarque) {
                  setValues({ ...values, data_retorno: addDays(values.data_embarque, d) });
                }
              }}
            />
          </Field>
          <TextField
            label="Data de retorno"
            type="date"
            value={values.data_retorno}
            onChange={(v) => setValues({ ...values, data_retorno: v })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 hidden">
          <span />
          <Field label="Nº de passageiros">
            <div className="relative">
              <Users className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" type="number" min={1} value={values.num_passageiros ?? ""}
                onChange={(e) => setValues({ ...values, num_passageiros: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
          </Field>
          <SelectField label="Tipo de serviço" value={values.tipo_servico ?? ""} onChange={(v) => setValues({ ...values, tipo_servico: v })} options={TIPOS} />
        </div>
      </div>

      {/* Vínculos */}
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
          options={empresas.map((e) => ({ value: e.id, label: e.nome }))} />
        <SelectField label="Missão" value={values.missao_id ?? ""} onChange={(v) => setValues({ ...values, missao_id: v })}
          options={missoes.map((e) => ({ value: e.id, label: e.nome }))} />
        <TextField label="Número (gerado automaticamente se vazio)" value={values.numero} onChange={(v) => setValues({ ...values, numero: v })} placeholder="CTR-2026-001" />
        <SelectField label="Status" value={values.status ?? "ativo"} onChange={(v) => setValues({ ...values, status: v })} options={STATUS} />
      </div>

      {/* Financeiro */}
      <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
          <Sparkles className="size-3.5" /> Plano financeiro
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <CurrencyField label="Valor total" value={values.valor} onChange={(v) => setValues({ ...values, valor: v })} />
          <CurrencyField label="Valor de entrada" value={values.valor_entrada} onChange={(v) => setValues({ ...values, valor_entrada: v })} />
          <Field label="Saldo a parcelar">
            <Input value={formatCurrency(saldo)} readOnly className="bg-muted/40 cursor-not-allowed" />
          </Field>
          <NumberField label="Parcelas" value={values.parcelas} onChange={(v) => setValues({ ...values, parcelas: Math.max(1, Math.floor(v || 1)) })} step="1" />
          <SelectField label="Frequência" value={freq} onChange={(v) => setValues({ ...values, frequencia: v })} options={FREQS} />
          <NumberField label="Dia do vencimento" value={values.dia_vencimento ?? 10} onChange={(v) => setValues({ ...values, dia_vencimento: Math.min(31, Math.max(1, Math.floor(v || 1))) })} step="1" />
          <TextField label="Vigência — início" type="date" value={values.data_inicio} onChange={(v) => setValues({ ...values, data_inicio: v })} />
          <TextField label="Vigência — fim" type="date" value={values.data_fim} onChange={(v) => setValues({ ...values, data_fim: v })} />
          <SelectField label="Método de pagamento" value={values.metodo_pagamento ?? ""} onChange={(v) => setValues({ ...values, metodo_pagamento: v })} options={METODOS_PAGAMENTO} />
        </div>

        {preview.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
                <CalendarDays className="size-3.5" /> Preview das parcelas
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {entrada > 0 && <>Entrada {formatCurrency(entrada)} + </>}{parcelas}× saldo {formatCurrency(saldo)}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-right px-3 py-2 font-medium">Valor</th>
                  <th className="text-left px-3 py-2 font-medium">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {entrada > 0 && (
                  <tr className="border-t border-border/60 bg-primary/5">
                    <td className="px-3 py-2 text-primary">Entrada</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(entrada)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(inicio || null)}</td>
                  </tr>
                )}
                {preview.map((p) => (
                  <tr key={p.i} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{p.i}/{parcelas}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(p.valor)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(p.venc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
              Os recebíveis serão criados/atualizados automaticamente ao salvar. Parcelas com pagamento registrado são preservadas.
            </div>
          </div>
        )}
      </div>

      <TextAreaField label="Observações" value={values.observacoes} onChange={(v) => setValues({ ...values, observacoes: v })} />
    </div>
  );
}

function Page() {
  const { data: empresas } = useEmpresas();
  const { data: missoes } = useMissoes();

  // Recebíveis para contar parcelas pagas por contrato (info na lista)
  const { data: recebiveis } = useQuery({
    queryKey: ["recebiveis-min-por-contrato"],
    queryFn: async () =>
      (await supabase.from("recebiveis").select("contrato_id,status,valor_total,valor_pago")).data ?? [],
    staleTime: 30_000,
  });

  const resumoPorContrato = useMemo(() => {
    const map = new Map<string, { pagos: number; total: number; recebido: number; vencidos: number }>();
    for (const r of recebiveis ?? []) {
      if (!r.contrato_id) continue;
      const cur = map.get(r.contrato_id) ?? { pagos: 0, total: 0, recebido: 0, vencidos: 0 };
      cur.total += 1;
      if (r.status === "pago") cur.pagos += 1;
      if (r.status === "atrasado") cur.vencidos += 1;
      cur.recebido += Number(r.valor_pago ?? 0);
      map.set(r.contrato_id, cur);
    }
    return map;
  }, [recebiveis]);

  const { data: allContratos = [] } = useQuery({
    queryKey: ["contratos-export"],
    queryFn: async () => (await supabase.from("contratos").select("*").order("created_at", { ascending: false })).data ?? [],
    staleTime: 30_000,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Contratos"
        description="Contratos com clientes — geram recebíveis automaticamente."
        actions={
          <ExportButton<T>
            title="Contratos"
            filename="contratos"
            rows={allContratos as T[]}
            columns={[
              { header: "Nº", accessor: "numero" },
              { header: "Cliente", accessor: "cliente" },
              { header: "Empresa", accessor: (r) => nomeById(empresas, r.empresa_id) },
              { header: "Destino", accessor: "destino" },
              { header: "Embarque", accessor: (r) => formatDate(r.data_embarque) },
              { header: "Retorno", accessor: (r) => formatDate(r.data_retorno) },
              { header: "Passageiros", accessor: "num_passageiros" },
              { header: "Valor total", accessor: (r) => formatCurrency(Number(r.valor)) },
              { header: "Entrada", accessor: (r) => formatCurrency(Number(r.valor_entrada)) },
              { header: "Parcelas", accessor: "parcelas" },
              { header: "Início", accessor: (r) => formatDate(r.data_inicio) },
              { header: "Status", accessor: "status" },
            ]}
          />
        }
      />
      <DataTable<T>
        table="contratos"
        title="Contrato"
        searchFields={["cliente", "numero", "destino"]}
        defaultValues={{
          status: "ativo",
          valor: 0,
          valor_entrada: 0,
          parcelas: 1,
          frequencia: "mensal",
          dia_vencimento: 10,
        }}
        columns={[
          { key: "numero", label: "Nº" },
          {
            key: "cliente", label: "Cliente",
            render: (r) => (
              <div>
                <div className="font-medium">{r.cliente}</div>
                {r.destino && <div className="text-xs text-muted-foreground">{r.destino}</div>}
              </div>
            ),
          },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          { key: "valor", label: "Valor", render: (r) => formatCurrency(r.valor) },
          {
            key: "parcelas_pagas", label: "Parcelas",
            render: (r) => {
              const s = resumoPorContrato.get(r.id);
              if (!s) return <span className="text-muted-foreground">—</span>;
              return (
                <span className="tabular-nums">
                  <span className="text-success font-medium">{s.pagos}</span>
                  <span className="text-muted-foreground">/{s.total}</span>
                  {s.vencidos > 0 && <span className="ml-2 text-destructive text-xs">({s.vencidos} venc.)</span>}
                </span>
              );
            },
          },
          { key: "data_inicio", label: "Início", render: (r) => formatDate(r.data_inicio) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
        renderForm={({ values, setValues }) => (
          <ContratoForm values={values} setValues={setValues} empresas={empresas ?? []} missoes={missoes ?? []} />
        )}
      />
    </PageContainer>
  );
}
