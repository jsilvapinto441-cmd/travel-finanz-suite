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
  ArrowDownLeft, ArrowUpRight, AlertTriangle, Wallet, Building2, TrendingUp, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
// funcionários não geram despesa automática — mantido o import removido intencionalmente.
import { exportRelatorioGerencial } from "@/lib/relatorio-gerencial";
import { FileText, Target } from "lucide-react";
import { useMissoes } from "@/lib/lookups";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [missaoId, setMissaoId] = useState<string>("all");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const { data: missoes } = useMissoes();

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
    queryKey: ["dash-recebiveis", empresaId, missaoId],
    queryFn: async () => {
      let q = supabase
        .from("recebiveis")
        .select("id,pagador,empresa_id,contrato_id,valor_total,valor_parcela,valor_pago,status,data_vencimento,data_recebimento,missao_id");
      if (empresaId !== "all") q = q.eq("empresa_id", empresaId);
      if (missaoId !== "all") q = q.eq("missao_id", missaoId);
      return (await q).data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["dash-pagamentos", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("registros_pagamento" as any)
        .select("id,data_pagamento,valor,recebivel_id,despesa_id");
      return (data ?? []) as unknown as { id: string; data_pagamento: string; valor: number; recebivel_id: string | null; despesa_id: string | null }[];
    },
    staleTime: 60_000,
  });

  const { data: despesas } = useQuery({
    queryKey: ["dash-despesas", empresaId, missaoId],
    queryFn: async () => {
      let q = supabase
        .from("despesas")
        .select("id,descricao,empresa_id,valor,valor_pago,status,categoria,data_vencimento,data_pagamento,missao_id");
      if (empresaId !== "all") q = q.eq("empresa_id", empresaId);
      if (missaoId !== "all") q = q.eq("missao_id", missaoId);
      return (await q).data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: funcionarios } = useQuery({
    queryKey: ["dash-funcionarios", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("funcionarios")
        .select("id,empresa_id,ativo,salario,vale_transporte,alimentacao,fgts,inss,custos_adicionais");
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
    const pagsAll = pagamentos ?? [];
    const recs = recsAll.filter((r) => inDateRange(r.data_vencimento));
    const desps = despsAll.filter((d) => inDateRange(d.data_pagamento ?? d.data_vencimento));
    // SOMENTE pagamentos de clientes (recebíveis) — nunca de despesas
    const pagsCliente = pagsAll.filter((p) => p.recebivel_id && inDateRange(p.data_pagamento));

    const st = (r: any) => String(r.status ?? "");

    // 1. TOTAL CONTRATADO — soma de todas as parcelas/recebíveis (exceto cancelados)
    const totalContratado = recs
      .filter((r) => st(r) !== "cancelado")
      .reduce((s, r) => s + Number(r.valor_parcela ?? r.valor_total ?? 0), 0);

    // 2. TOTAL RECEBIDO — apenas pagamentos de clientes
    const totalRecebido = pagsCliente.reduce((s, p) => s + Number(p.valor ?? 0), 0);

    // 3. TOTAL EM ABERTO = Contratado - Recebido
    const totalEmAberto = Math.max(totalContratado - totalRecebido, 0);

    // 4. EM ATRASO
    const totalVencido = recs
      .filter((r) => ["atrasado", "vencido"].includes(st(r)))
      .reduce((s, r) => s + Math.max(Number(r.valor_parcela ?? r.valor_total ?? 0) - Number(r.valor_pago ?? 0), 0), 0);

    const contratosComVencidos = new Set(
      recsAll.filter((r) => ["atrasado", "vencido"].includes(st(r)) && r.contrato_id).map((r) => r.contrato_id),
    );
    const contratosTotal = new Set(recsAll.filter((r) => r.contrato_id).map((r) => r.contrato_id));
    const inadimplencia = contratosTotal.size > 0
      ? Math.round((contratosComVencidos.size / contratosTotal.size) * 100)
      : 0;

    // 5a. DESPESAS OPERACIONAIS — soma de despesas manuais (exceto canceladas)
    const totalOperacional = desps.filter((d) => d.status !== "cancelado").reduce((s, d) => s + Number(d.valor ?? 0), 0);
    const despesasPagas = desps.reduce((s, d) => s + Number(d.valor_pago ?? 0), 0);

    // 5b. CUSTOS COM FUNCIONÁRIOS — cadastros de funcionários NÃO geram despesa
    //     automática. O custo só entra quando uma despesa é lançada em Despesas.
    const folhaMensal = 0;


    // 5c. TOTAL GERAL DE DESPESAS = apenas Operacionais
    const totalDespesa = totalOperacional;

    // 6. LUCRO LÍQUIDO = Total Recebido - Total de Despesas
    const lucro = totalRecebido - totalDespesa;


    const atrasados = [
      ...recs.filter((r) => ["atrasado", "vencido"].includes(st(r))),
      ...desps.filter((d) => d.status === "atrasado"),
    ];

    const now = new Date();
    const months: { key: string; label: string; entradas: number; saidas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: formatMonth(d), entradas: 0, saidas: 0 });
    }
    const monthIdx = new Map(months.map((m, i) => [m.key, i]));
    // Entradas = somente pagamentos de clientes
    for (const p of pagsAll) {
      if (!p.recebivel_id) continue;
      const idx = monthIdx.get((p.data_pagamento ?? "").slice(0, 7));
      if (idx !== undefined) months[idx].entradas += Number(p.valor ?? 0);
    }
    for (const d of desps) {
      const dateStr = d.data_pagamento ?? d.data_vencimento;
      if (!dateStr) continue;
      const idx = monthIdx.get(dateStr.slice(0, 7));
      if (idx !== undefined) months[idx].saidas += Number(d.valor ?? 0);
    }
    // Folha mensal recorrente entra em todos os meses do fluxo
    for (const m of months) m.saidas += folhaMensal;

    const catMap = new Map<string, number>();
    for (const d of desps) {
      catMap.set(d.categoria, (catMap.get(d.categoria) ?? 0) + Number(d.valor ?? 0));
    }
    if (folhaMensal > 0) catMap.set("folha_pagamento", (catMap.get("folha_pagamento") ?? 0) + folhaMensal);
    const catData = [...catMap.entries()].map(([name, value]) => ({ name, value }));

    // ===== Por empresa: evolução mensal de lucro + comparativo lucro x despesas =====
    const empresasList = (empresas ?? []).filter((e) => empresaId === "all" || e.id === empresaId);
    const recById = new Map((recsAll).map((r) => [r.id, r]));

    // Inicializa estrutura mensal por empresa
    const monthsPorEmpresa = months.map((m) => {
      const row: any = { key: m.key, label: m.label };
      for (const e of empresasList) {
        row[`in_${e.id}`] = 0;
        row[`out_${e.id}`] = 0;
      }
      return row;
    });

    // Entradas (pagamentos de clientes) por empresa via recebivel
    for (const p of pagsAll) {
      if (!p.recebivel_id) continue;
      const rec = recById.get(p.recebivel_id);
      if (!rec?.empresa_id) continue;
      if (empresaId !== "all" && rec.empresa_id !== empresaId) continue;
      const idx = monthIdx.get((p.data_pagamento ?? "").slice(0, 7));
      if (idx === undefined) continue;
      monthsPorEmpresa[idx][`in_${rec.empresa_id}`] += Number(p.valor ?? 0);
    }
    // Saídas (despesas operacionais) por empresa
    for (const d of desps) {
      if (!d.empresa_id) continue;
      const dateStr = d.data_pagamento ?? d.data_vencimento;
      if (!dateStr) continue;
      const idx = monthIdx.get(dateStr.slice(0, 7));
      if (idx === undefined) continue;
      monthsPorEmpresa[idx][`out_${d.empresa_id}`] += Number(d.valor ?? 0);
    }
    // Cadastros de funcionários NÃO geram despesa automática por empresa.


    // Receita mensal por empresa + linha "Soma total"
    const receitaPorEmpresa = monthsPorEmpresa.map((m) => {
      const row: any = { label: m.label };
      let total = 0;
      for (const e of empresasList) {
        const v = m[`in_${e.id}`] ?? 0;
        row[e.id] = v;
        total += v;
      }
      row.__total = total;
      return row;
    });

    // Entrada x Saída por empresa (mês atual — consistente com KPIs)
    const mesAtual = monthsPorEmpresa[monthsPorEmpresa.length - 1];
    const entradaSaidaPorEmpresa = empresasList.map((e) => {
      const entrada = mesAtual?.[`in_${e.id}`] ?? 0;
      const saida = mesAtual?.[`out_${e.id}`] ?? 0;
      return { id: e.id, nome: e.nome, cor: e.cor || "#f97316", entrada, saida };
    });

    return { totalContratado, totalRecebido, totalEmAberto, totalVencido, inadimplencia, totalOperacional, folhaMensal, totalDespesa, despesasPagas, lucro, atrasados, months, catData, empresasList, receitaPorEmpresa, entradaSaidaPorEmpresa };
  }, [recebiveis, despesas, pagamentos, funcionarios, empresas, empresaId, dataIni, dataFim]);

  const { totalContratado, totalRecebido, totalEmAberto, totalVencido, totalOperacional, folhaMensal, totalDespesa, despesasPagas, lucro, atrasados, months, catData, empresasList, receitaPorEmpresa, entradaSaidaPorEmpresa } = aggregates;

  const semDados =
    (recebiveis?.length ?? 0) === 0 &&
    (despesas?.length ?? 0) === 0 &&
    (funcionarios?.length ?? 0) === 0 &&
    (pagamentos?.length ?? 0) === 0;

  const colors = ["#f97316", "#fb923c", "#c2410c", "#facc15", "#0d7a5f", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#a16207"];

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard Financeiro"
        description="Visão consolidada de receitas, despesas e lucro."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              onClick={() => {
                const empresaNome =
                  empresaId === "all"
                    ? "Todas as empresas"
                    : empresas?.find((e) => e.id === empresaId)?.nome ?? "—";
                exportRelatorioGerencial({
                  empresaNome,
                  periodo: { from: dataIni, to: dataFim },
                  kpis: {
                    totalContratado,
                    totalRecebido,
                    totalEmAberto,
                    totalVencido,
                    inadimplencia: aggregates.inadimplencia,
                    totalOperacional,
                    folhaMensal,
                    totalDespesa,
                    despesasPagas,
                    lucro,
                    qtdAtrasados: atrasados.length,
                  },
                  fluxoMensal: months.map((m) => ({
                    label: m.label,
                    entradas: m.entradas,
                    saidas: m.saidas,
                  })),
                  despesasCategoria: catData,
                  empresasLucro: empresasList.map((e) => {
                    const mesAtual = aggregates.receitaPorEmpresa[aggregates.receitaPorEmpresa.length - 1];
                    const receita = Number(mesAtual?.[e.id] ?? 0);
                    const linha = entradaSaidaPorEmpresa.find((x) => x.id === e.id);
                    const despesa = linha?.saida ?? 0;
                    return {
                      nome: e.nome,
                      receita_realizada: receita,
                      despesa_realizada: despesa,
                      lucro_realizado: receita - despesa,
                      lucro_projetado: receita - despesa,
                    };
                  }),
                });
              }}
            >
              <FileText className="size-4 mr-2" />
              Relatório Gerencial (PDF)
            </Button>
          </div>
        }
      />


      {semDados && (
        <Card className="p-6 mb-6 border-dashed border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <Wallet className="size-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-display font-semibold mb-1">Bem-vindo ao Rotas!</h3>
              <p className="text-sm text-muted-foreground">
                Você ainda não cadastrou nenhum dado. Comece adicionando uma <strong>empresa</strong>, um <strong>contrato</strong> ou uma <strong>despesa</strong> para ver seus indicadores e gráficos ganharem vida.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Período inicial</Label>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-[170px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Período final</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[170px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="size-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresas?.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Missão</Label>
          <Select value={missaoId} onValueChange={setMissaoId}>
            <SelectTrigger className="w-[200px]">
              <Target className="size-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas as missões" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as missões</SelectItem>
              {missoes?.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(dataIni || dataFim || empresaId !== "all" || missaoId !== "all") && (
          <Button variant="outline" size="sm" onClick={() => { setDataIni(""); setDataFim(""); setEmpresaId("all"); setMissaoId("all"); }}>
            Limpar filtros
          </Button>
        )}
      </Card>

      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Financeiro</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Contratado" value={formatCurrency(totalContratado)}
          hint="Soma dos contratos e parcelas" icon={<Wallet className="size-5" />} tone="default" />
        <KpiCard label="Total Recebido" value={formatCurrency(totalRecebido)}
          hint="Pagamentos de clientes" icon={<ArrowDownLeft className="size-5" />} tone="success" />
        <KpiCard label="Total em Aberto" value={formatCurrency(totalEmAberto)}
          hint="Contratado − Recebido" icon={<ArrowDownLeft className="size-5" />} tone="gold" />
        <KpiCard label="Em Atraso" value={String(atrasados.length)}
          hint={`Contas vencidas · ${formatCurrency(totalVencido)}`} icon={<AlertTriangle className="size-5" />} tone="warning" />
      </div>

      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Despesas</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Despesas Operacionais" value={formatCurrency(totalOperacional)}
          hint={`Pago: ${formatCurrency(despesasPagas)}`} icon={<ArrowUpRight className="size-5" />} tone="destructive" />
        <KpiCard label="Custos com Funcionários" value={formatCurrency(folhaMensal)}
          hint="Folha mensal (ativos)" icon={<Users className="size-5" />} tone="warning" />
        <KpiCard label="Total Geral de Despesas" value={formatCurrency(totalDespesa)}
          hint="Operacionais + Folha" icon={<Wallet className="size-5" />} tone="default" />
      </div>

      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Resultado</div>
      <div className="grid grid-cols-1 gap-4 mb-6">
        <KpiCard label="Lucro Líquido" value={formatCurrency(lucro)}
          hint="Recebido − (Operacionais + Folha)" icon={<TrendingUp className="size-5" />} tone="gold" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Comparativo de Receita das Empresas</h3>
            <TrendingUp className="size-4 text-muted-foreground" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={receitaPorEmpresa}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  formatter={(v: number, name: string) => [formatCurrency(v), name === "__total" ? "Soma total" : (empresasList.find((e) => e.id === name)?.nome ?? name)]}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === "__total" ? "Soma total" : (empresasList.find((e) => e.id === v)?.nome ?? v)} />
                {empresasList.map((e) => (
                  <Line key={e.id} type="monotone" dataKey={e.id} stroke={e.cor || "#f97316"} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                ))}
                {empresaId === "all" && empresasList.length > 1 && (
                  <Line type="monotone" dataKey="__total" name="__total" stroke="var(--color-muted-foreground)" strokeWidth={3.5} dot={{ r: 4 }} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Entrada × Saída (mês atual)</h3>
            <Building2 className="size-4 text-muted-foreground" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={entradaSaidaPorEmpresa}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" angle={-20} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  formatter={(v: number, name: string) => [formatCurrency(v), name]}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entrada" name="Entrada" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saida" name="Saída" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

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
