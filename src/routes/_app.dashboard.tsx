import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/date-picker";

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
// funcionários não geram despesa automática — mantido o import removido intencionalmente.
import { exportRelatorioGerencial } from "@/lib/relatorio-gerencial";
import { FileText, Target } from "lucide-react";
import { useMissoes } from "@/lib/lookups";
import { DespesasCategoriaDialog } from "@/components/despesas-categoria-dialog";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [missaoId, setMissaoId] = useState<string>("all");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const navigate = useNavigate();
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
        .select("id,descricao,empresa_id,fornecedor_id,valor,valor_pago,status,categoria,data_vencimento,data_pagamento,missao_id");
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

    // Missões concluídas são encerradas: seus valores saem de TODOS os cálculos.
    const missoesConcluidas = new Set(
      (missoes ?? []).filter((m) => m.status === "concluido").map((m) => m.id),
    );
    const foraDeMissaoConcluida = (row: { missao_id?: string | null }) =>
      !row.missao_id || !missoesConcluidas.has(row.missao_id);

    const recsAll = (recebiveis ?? []).filter(foraDeMissaoConcluida);
    const despsAll = (despesas ?? []).filter(foraDeMissaoConcluida);
    const pagsAll = pagamentos ?? [];
    // Ids dos recebíveis já filtrados por empresa/missão (queries acima)
    const recIdsFiltrados = new Set(recsAll.map((r) => r.id));
    const recs = recsAll.filter((r) => inDateRange(r.data_vencimento));
    const desps = despsAll.filter((d) => inDateRange(d.data_vencimento));
    // SOMENTE pagamentos de clientes cujo recebível pertence ao escopo filtrado
    const pagsCliente = pagsAll.filter((p) => p.recebivel_id && recIdsFiltrados.has(p.recebivel_id) && inDateRange(p.data_pagamento));
    const despIdsFiltradas = new Set(despsAll.map((d) => d.id));
    const pagsDespesas = pagsAll.filter(
      (p) => p.despesa_id && despIdsFiltradas.has(p.despesa_id) && inDateRange(p.data_pagamento),
    );

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
    const despesasPagas = pagsDespesas.reduce((s, p) => s + Number(p.valor ?? 0), 0);

    // 5b. CUSTOS COM FUNCIONÁRIOS — cadastros de funcionários NÃO geram despesa
    //     automática. O custo só entra quando uma despesa é lançada em Despesas.
    const folhaMensal = 0;


    // 5c. TOTAL GERAL DE DESPESAS = apenas Operacionais
    const totalDespesa = totalOperacional;

    // 6. LUCRO LÍQUIDO = Total Recebido - Total de Despesas
    const lucro = totalRecebido - despesasPagas;


    const atrasados = [
      ...recs
        .filter((r) => ["atrasado", "vencido"].includes(st(r)))
        .map((r: any) => ({
          id: `rec-${r.id}`,
          tipo: "Recebível" as const,
          nome: r.pagador ?? "—",
          data_vencimento: r.data_vencimento,
          valor: Math.max(Number(r.valor_parcela ?? r.valor_total ?? 0) - Number(r.valor_pago ?? 0), 0),
          status: r.status,
        })),
      ...desps
        .filter((d) => d.status === "atrasado")
        .map((d: any) => ({
          id: `desp-${d.id}`,
          tipo: "Despesa" as const,
          nome: d.descricao ?? "—",
          data_vencimento: d.data_vencimento,
          valor: Math.max(Number(d.valor ?? 0) - Number(d.valor_pago ?? 0), 0),
          status: d.status,
        })),
    ].sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));

    // Contagem de itens vencidos com saldo pendente (vencimento já passou)
    const hojeStr = new Date().toISOString().slice(0, 10);
    const vencido = (status: string, venc: string | null | undefined) =>
      status !== "pago" && status !== "cancelado" && !!venc && String(venc).slice(0, 10) < hojeStr;

    const recsAtrasados = recs.filter((r: any) => vencido(st(r), r.data_vencimento));
    const despsAtrasadas = desps.filter((d: any) => vencido(d.status, d.data_vencimento));
    const qtdRecAtraso = recsAtrasados.length;
    const qtdDespAtraso = despsAtrasadas.length;
    const valorRecAtraso = recsAtrasados.reduce((s2: number, r: any) => s2 + Math.max(Number(r.valor_parcela ?? r.valor_total ?? 0) - Number(r.valor_pago ?? 0), 0), 0);
    const valorDespAtraso = despsAtrasadas.reduce((s2: number, d: any) => s2 + Math.max(Number(d.valor ?? 0) - Number(d.valor_pago ?? 0), 0), 0);


    const now = new Date();
    const months: { key: string; label: string; entradas: number; saidas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: formatMonth(d), entradas: 0, saidas: 0 });
    }
    const monthIdx = new Map(months.map((m, i) => [m.key, i]));
    // Entradas = somente pagamentos de clientes dentro do escopo filtrado
    for (const p of pagsAll) {
      if (!p.recebivel_id || !recIdsFiltrados.has(p.recebivel_id)) continue;
      const idx = monthIdx.get((p.data_pagamento ?? "").slice(0, 7));
      if (idx !== undefined) months[idx].entradas += Number(p.valor ?? 0);
    }
    for (const p of pagsAll) {
      if (!p.despesa_id || !despIdsFiltradas.has(p.despesa_id)) continue;
      const idx = monthIdx.get((p.data_pagamento ?? "").slice(0, 7));
      if (idx !== undefined) months[idx].saidas += Number(p.valor ?? 0);
    }
    // Folha mensal recorrente entra em todos os meses do fluxo
    for (const m of months) m.saidas += folhaMensal;

    const catMap = new Map<string, number>();
    for (const d of desps) {
      catMap.set(d.categoria, (catMap.get(d.categoria) ?? 0) + Number(d.valor ?? 0));
    }
    if (folhaMensal > 0) catMap.set("folha_pagamento", (catMap.get("folha_pagamento") ?? 0) + folhaMensal);
    const catData = [...catMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

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
    const despById = new Map(despsAll.map((d) => [d.id, d]));
    for (const p of pagsAll) {
      if (!p.despesa_id) continue;
      const d = despById.get(p.despesa_id);
      if (!d?.empresa_id) continue;
      const idx = monthIdx.get((p.data_pagamento ?? "").slice(0, 7));
      if (idx === undefined) continue;
      monthsPorEmpresa[idx][`out_${d.empresa_id}`] += Number(p.valor ?? 0);
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

    // ===== Entrada × Saída (série cronológica, respeitando TODOS os filtros) =====
    // Usa exatamente os pagamentos já filtrados por empresa / missão / período,
    // portanto os valores batem com as telas de Recebíveis e Despesas.
    const toDate = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
    const datasPag = [...pagsCliente, ...pagsDespesas]
      .map((p) => (p.data_pagamento ?? "").slice(0, 10))
      .filter(Boolean)
      .sort();

    let inicio: Date;
    let fim: Date;
    if (dataIni || dataFim) {
      inicio = toDate(dataIni || datasPag[0] || dataFim!);
      fim = toDate(dataFim || datasPag[datasPag.length - 1] || dataIni!);
    } else if (datasPag.length) {
      const seisMeses = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
      const primeiro = toDate(datasPag[0]);
      inicio = primeiro > seisMeses ? primeiro : seisMeses;
      fim = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    } else {
      inicio = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
      fim = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }
    if (fim < inicio) fim = inicio;

    const diasRange = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
    const granularidade: "dia" | "mes" = diasRange <= 62 ? "dia" : "mes";

    const bucketKey = (iso: string) => (granularidade === "dia" ? iso.slice(0, 10) : iso.slice(0, 7));
    const buckets: { key: string; label: string; entrada: number; saida: number }[] = [];
    if (granularidade === "dia") {
      for (let t = inicio.getTime(); t <= fim.getTime(); t += 86400000) {
        const d = new Date(t);
        const key = d.toISOString().slice(0, 10);
        buckets.push({
          key,
          label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
          entrada: 0,
          saida: 0,
        });
      }
    } else {
      const cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
      const limite = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), 1));
      while (cursor <= limite) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
        buckets.push({
          key,
          label: formatMonth(new Date(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)),
          entrada: 0,
          saida: 0,
        });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    }
    const bucketIdx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const p of pagsCliente) {
      const i = bucketIdx.get(bucketKey(p.data_pagamento ?? ""));
      if (i !== undefined) buckets[i].entrada += Number(p.valor ?? 0);
    }
    for (const p of pagsDespesas) {
      const i = bucketIdx.get(bucketKey(p.data_pagamento ?? ""));
      if (i !== undefined) buckets[i].saida += Number(p.valor ?? 0);
    }
    const entradaSaidaSerie = buckets.map((b) => ({ ...b, saldo: b.entrada - b.saida }));
    const entradaSaidaTotais = entradaSaidaSerie.reduce(
      (acc, b) => ({ entrada: acc.entrada + b.entrada, saida: acc.saida + b.saida }),
      { entrada: 0, saida: 0 },
    );
    const entradaSaidaVazio = entradaSaidaTotais.entrada === 0 && entradaSaidaTotais.saida === 0;

    return { qtdRecAtraso, qtdDespAtraso, valorRecAtraso, valorDespAtraso, totalContratado, totalRecebido, totalEmAberto, totalVencido, inadimplencia, totalOperacional, folhaMensal, totalDespesa, despesasPagas, lucro, atrasados, months, catData, empresasList, receitaPorEmpresa, entradaSaidaPorEmpresa, entradaSaidaSerie, entradaSaidaTotais, entradaSaidaVazio, granularidade, despsAll };
  }, [recebiveis, despesas, pagamentos, funcionarios, empresas, missoes, empresaId, missaoId, dataIni, dataFim]);


  const { qtdRecAtraso, qtdDespAtraso, valorRecAtraso, valorDespAtraso, totalContratado, totalRecebido, totalEmAberto, totalVencido, totalOperacional, folhaMensal, totalDespesa, despesasPagas, lucro, atrasados, months, catData, empresasList, receitaPorEmpresa, entradaSaidaPorEmpresa, entradaSaidaSerie, entradaSaidaTotais, entradaSaidaVazio, granularidade, despsAll } = aggregates;

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
                const missaoNome =
                  missaoId === "all"
                    ? "Todas as missões"
                    : missoes?.find((m) => m.id === missaoId)?.nome ?? "—";
                exportRelatorioGerencial({
                  empresaNome,
                  missaoNome,
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
          <DatePicker value={dataIni} onChange={setDataIni} className="w-[170px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Período final</Label>
          <DatePicker value={dataFim} onChange={setDataFim} className="w-[170px]" />
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
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}{m.status === "concluido" ? " (Concluída)" : ""}
                </SelectItem>
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
        <KpiCard label="A receber" value={formatCurrency(totalEmAberto)}
          hint="Saldo pendente de recebíveis" icon={<ArrowDownLeft className="size-5" />} tone="gold" />

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

      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Pendências financeiras</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <KpiCard
          label="Despesas em atraso"
          value={String(qtdDespAtraso)}
          hint={`${formatCurrency(valorDespAtraso)} pendente · toque para ver`}
          icon={<AlertTriangle className="size-5" />}
          tone="destructive"
          onClick={() => navigate({ to: "/despesas", search: { status: "atrasado" } })}
        />
        <KpiCard
          label="Recebíveis em atraso"
          value={String(qtdRecAtraso)}
          hint={`${formatCurrency(valorRecAtraso)} pendente · toque para ver`}
          icon={<AlertTriangle className="size-5" />}
          tone="warning"
          onClick={() => navigate({ to: "/recebiveis", search: { status: "atrasado" } })}
        />
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

        <Card
          className="p-6 cursor-pointer transition-colors hover:border-primary/40"
          role="button"
          tabIndex={0}
          onClick={() => setCatDialogOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCatDialogOpen(true); } }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Despesas por Categoria</h3>
            <span className="text-xs text-muted-foreground">Ver detalhes</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={catData.slice(0, 5)} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {catData.slice(0, 5).map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
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

        <DespesasCategoriaDialog
          open={catDialogOpen}
          onOpenChange={setCatDialogOpen}
          despesas={despsAll as any}
          empresas={(empresas ?? []) as { id: string; nome: string }[]}
          colors={colors}
          initialPeriodo={{ from: dataIni, to: dataFim }}
          initialEmpresaId={empresaId}
        />
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


    </PageContainer>
  );
}
