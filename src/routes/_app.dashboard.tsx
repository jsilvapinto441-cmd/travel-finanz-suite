import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatMonth } from "@/lib/format";
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, AlertTriangle, Wallet, Building2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  // Auto-marca itens vencidos como atrasados ao abrir o dashboard
  useQuery({
    queryKey: ["marcar-atrasados"],
    queryFn: async () => { await supabase.rpc("marcar_atrasados" as any); return true; },
    staleTime: 5 * 60_000,
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => (await supabase.from("empresas").select("id, nome, cor").order("nome")).data ?? [],
    staleTime: 5 * 60_000,
  });

  const { data: recebiveis } = useQuery({
    queryKey: ["dash-recebiveis", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("recebiveis")
        .select("id,pagador,empresa_id,contrato_id,valor_total,valor_parcela,valor_pago,status,data_vencimento,data_recebimento");
      if (empresaId !== "all") q = q.eq("empresa_id", empresaId);
      return (await q).data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["dash-pagamentos", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("registros_pagamento" as any)
        .select("id,data_pagamento,valor,recebivel_id");
      return (data ?? []) as unknown as { id: string; data_pagamento: string; valor: number; recebivel_id: string }[];
    },
    staleTime: 60_000,
  });

  const { data: despesas } = useQuery({
    queryKey: ["dash-despesas", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("despesas")
        .select("id,descricao,empresa_id,valor,status,categoria,data_vencimento,data_pagamento");
      if (empresaId !== "all") q = q.eq("empresa_id", empresaId);
      return (await q).data ?? [];
    },
    staleTime: 60_000,
  });

  const aggregates = useMemo(() => {
    const inDateRange = (dateStr?: string | null) => {
      if (!dataIni && !dataFim) return true;
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      if (dataIni && d < dataIni) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    };

    const recsAll = recebiveis ?? [];
    const despsAll = despesas ?? [];
    const recs = recsAll.filter((r) => inDateRange(r.data_recebimento ?? r.data_vencimento));
    const desps = despsAll.filter((d) => inDateRange(d.data_pagamento ?? d.data_vencimento));

    const st = (r: any) => String(r.status ?? "");
    const totalReceber = recs
      .filter((r) => ["em_aberto", "parcial", "pago_parcial"].includes(st(r)))
      .reduce((s, r) => s + Math.max(Number(r.valor_parcela ?? r.valor_total ?? 0) - Number(r.valor_pago ?? 0), 0), 0);
    const totalVencido = recs
      .filter((r) => ["atrasado", "vencido"].includes(st(r)))
      .reduce((s, r) => s + Math.max(Number(r.valor_parcela ?? r.valor_total ?? 0) - Number(r.valor_pago ?? 0), 0), 0);

    const now = new Date();
    const ymNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const recebidoMes = (pagamentos ?? [])
      .filter((p) => (p.data_pagamento ?? "").slice(0, 7) === ymNow)
      .reduce((s, p) => s + Number(p.valor ?? 0), 0);

    const contratosComVencidos = new Set(
      recsAll.filter((r) => ["atrasado", "vencido"].includes(st(r)) && r.contrato_id).map((r) => r.contrato_id),
    );
    const contratosTotal = new Set(recsAll.filter((r) => r.contrato_id).map((r) => r.contrato_id));
    const inadimplencia = contratosTotal.size > 0
      ? Math.round((contratosComVencidos.size / contratosTotal.size) * 100)
      : 0;

    const totalDespesa = desps.filter((d) => d.status !== "cancelado").reduce((s, d) => s + Number(d.valor ?? 0), 0);
    const pago = desps.filter((d) => d.status === "pago").reduce((s, d) => s + Number(d.valor ?? 0), 0);
    const atrasados = [
      ...recs.filter((r) => ["atrasado", "vencido"].includes(st(r))),
      ...desps.filter((d) => d.status === "atrasado"),
    ];

    const months: { key: string; label: string; entradas: number; saidas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: formatMonth(d), entradas: 0, saidas: 0 });
    }
    const monthIdx = new Map(months.map((m, i) => [m.key, i]));
    for (const p of pagamentos ?? []) {
      const idx = monthIdx.get((p.data_pagamento ?? "").slice(0, 7));
      if (idx !== undefined) months[idx].entradas += Number(p.valor ?? 0);
    }
    for (const d of desps) {
      const dateStr = d.data_pagamento ?? d.data_vencimento;
      if (!dateStr) continue;
      const idx = monthIdx.get(dateStr.slice(0, 7));
      if (idx !== undefined) months[idx].saidas += Number(d.valor ?? 0);
    }

    const catMap = new Map<string, number>();
    for (const d of desps) {
      catMap.set(d.categoria, (catMap.get(d.categoria) ?? 0) + Number(d.valor ?? 0));
    }
    const catData = [...catMap.entries()].map(([name, value]) => ({ name, value }));

    return { totalReceber, totalVencido, recebidoMes, inadimplencia, totalDespesa, pago, lucro: recebidoMes - pago, atrasados, months, catData };
  }, [recebiveis, despesas, pagamentos, dataIni, dataFim]);

  const { totalReceber, totalVencido, recebidoMes, inadimplencia, totalDespesa, pago, lucro, atrasados, months, catData } = aggregates;
  const colors = ["#f97316", "#fb923c", "#c2410c", "#facc15", "#0d7a5f", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#a16207"];

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard Financeiro"
        description="Visão consolidada de receitas, despesas e lucro."
        actions={
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="w-[220px]">
              <Building2 className="size-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresas?.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card className="p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Período inicial</Label>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-[170px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Período final</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[170px]" />
        </div>
        {(dataIni || dataFim) && (
          <Button variant="outline" size="sm" onClick={() => { setDataIni(""); setDataFim(""); }}>
            Limpar período
          </Button>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total a Receber" value={formatCurrency(totalReceber)}
          hint={`Vencido: ${formatCurrency(totalVencido)}`} icon={<ArrowDownLeft className="size-5" />} tone="success" />
        <KpiCard label="Recebido no Mês" value={formatCurrency(recebidoMes)}
          hint="Pagamentos registrados" icon={<TrendingUp className="size-5" />} tone="gold" />
        <KpiCard label="Total Despesas" value={formatCurrency(totalDespesa)}
          hint={`Pago: ${formatCurrency(pago)}`} icon={<ArrowUpRight className="size-5" />} tone="destructive" />
        <KpiCard label="Inadimplência" value={`${inadimplencia}%`}
          hint={`${atrasados.length} itens em atraso`} icon={<AlertTriangle className="size-5" />} tone="warning" />
      </div>
      

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold">Fluxo de Caixa</h3>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
            <Wallet className="size-5 text-muted-foreground" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name="Entradas" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold mb-4">Despesas por Categoria</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {catData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2 text-xs">
            {catData.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span className="capitalize">{c.name.replace(/_/g, " ")}</span>
                </div>
                <span className="font-medium">{formatCurrency(c.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Evolução Mensal — Lucro</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={months.map((m) => ({ ...m, lucro: m.entradas - m.saidas }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="lucro" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 5, fill: "var(--color-gold)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {atrasados.length > 0 && (
        <Card className="p-6 mt-6 border-destructive/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-destructive" />
            <h3 className="font-display font-semibold">Itens em Atraso</h3>
            <span className="text-xs text-muted-foreground">({atrasados.length})</span>
          </div>
          <div className="space-y-2">
            {atrasados.slice(0, 6).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div>
                  <div className="font-medium">{item.pagador ?? item.descricao}</div>
                  <div className="text-xs text-muted-foreground">Venc. {item.data_vencimento ?? "—"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatCurrency(item.valor_total ?? item.valor)}</span>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
