import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import { StatusBadge } from "@/components/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { compareVencimento } from "@/lib/sort-vencimento";
import { formatCurrency, formatDate } from "@/lib/format";
import { useFornecedores } from "@/lib/lookups";
import { ArrowLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type DespesaCategoriaRow = {
  id: string;
  descricao: string | null;
  categoria: string | null;
  valor: number | string | null;
  status: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor_pago?: number | string | null;
  registros_pagamento?: { data_pagamento: string | null; valor: number | string | null }[] | null;
  empresa_id: string | null;
  fornecedor_id?: string | null;
};

/** Total efetivamente pago: usa os pagamentos registrados e cai para valor_pago. */
function totalPago(d: DespesaCategoriaRow): number {
  const regs = d.registros_pagamento ?? [];
  if (regs.length > 0) return regs.reduce((s, p) => s + Number(p.valor ?? 0), 0);
  return Number(d.valor_pago ?? 0);
}

/**
 * Data do pagamento exibida: mantém a data da despesa quando existe (comportamento atual)
 * e, para pagamentos parciais (onde a despesa não recebe data), usa o último pagamento registrado.
 */
function dataPagamentoEfetiva(d: DespesaCategoriaRow): string | null {
  if (d.data_pagamento) return d.data_pagamento;
  const datas = (d.registros_pagamento ?? [])
    .map((p) => p.data_pagamento)
    .filter((x): x is string => Boolean(x))
    .sort();
  return datas.length ? datas[datas.length - 1] : null;
}

export function categoriaLabel(c: string | null | undefined) {
  if (!c) return "—";
  const s = c.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Ordem = "valor_desc" | "valor_asc" | "az" | "za";

const PAGE_SIZE = 50;

export function DespesasCategoriaDialog({
  open,
  onOpenChange,
  despesas,
  empresas,
  colors,
  initialPeriodo,
  initialEmpresaId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  despesas: DespesaCategoriaRow[];
  empresas: { id: string; nome: string }[];
  colors: string[];
  initialPeriodo?: { from?: string; to?: string };
  initialEmpresaId?: string;
}) {
  const [dataIni, setDataIni] = useState(initialPeriodo?.from ?? "");
  const [dataFim, setDataFim] = useState(initialPeriodo?.to ?? "");
  const [empresaId, setEmpresaId] = useState(initialEmpresaId ?? "all");
  const [categoriaSel, setCategoriaSel] = useState("all");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("valor_desc");
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [limite, setLimite] = useState(PAGE_SIZE);

  const { data: fornecedores } = useFornecedores();
  const fornecedorNome = (id: string | null | undefined) =>
    (fornecedores as { id: string; nome: string }[] | undefined)?.find((f) => f.id === id)?.nome ?? "—";
  const empresaNome = (id: string | null | undefined) =>
    empresas.find((e) => e.id === id)?.nome ?? "—";

  const filtradas = useMemo(() => {
    return (despesas ?? []).filter((d) => {
      if (d.status === "cancelado") return false;
      const venc = (d.data_vencimento ?? "").slice(0, 10);
      if (dataIni && (!venc || venc < dataIni)) return false;
      if (dataFim && (!venc || venc > dataFim)) return false;
      if (empresaId !== "all" && d.empresa_id !== empresaId) return false;
      if (categoriaSel !== "all" && (d.categoria ?? "") !== categoriaSel) return false;
      return true;
    });
  }, [despesas, dataIni, dataFim, empresaId, categoriaSel]);

  const todasCategorias = useMemo(
    () => [...new Set((despesas ?? []).map((d) => d.categoria ?? "outros"))].sort(),
    [despesas],
  );

  const totalGeral = useMemo(
    () => filtradas.reduce((s, d) => s + Number(d.valor ?? 0), 0),
    [filtradas],
  );

  const categorias = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    for (const d of filtradas) {
      const key = d.categoria ?? "outros";
      const cur = map.get(key) ?? { valor: 0, qtd: 0 };
      cur.valor += Number(d.valor ?? 0);
      cur.qtd += 1;
      map.set(key, cur);
    }
    let list = [...map.entries()].map(([name, v]) => ({
      name,
      label: categoriaLabel(name),
      valor: v.valor,
      qtd: v.qtd,
      pct: totalGeral > 0 ? (v.valor / totalGeral) * 100 : 0,
    }));
    const q = busca.trim().toLowerCase();
    if (q) list = list.filter((c) => c.label.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (ordem === "valor_desc") return b.valor - a.valor;
      if (ordem === "valor_asc") return a.valor - b.valor;
      if (ordem === "az") return a.label.localeCompare(b.label, "pt-BR");
      return b.label.localeCompare(a.label, "pt-BR");
    });
    return list;
  }, [filtradas, busca, ordem, totalGeral]);

  const detalheRows = useMemo(() => {
    if (!detalhe) return [];
    return filtradas
      .filter((d) => (d.categoria ?? "outros") === detalhe)
      .sort((a, b) => compareVencimento(a.data_vencimento, b.data_vencimento));
  }, [filtradas, detalhe]);

  const pieData = categorias.slice().sort((a, b) => b.valor - a.valor);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setDetalhe(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-5xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display">Despesas por Categoria</DialogTitle>
          <DialogDescription>
            Análise completa das despesas agrupadas por categoria.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Período inicial</Label>
            <DatePicker value={dataIni} onChange={setDataIni} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Período final</Label>
            <DatePicker value={dataFim} onChange={setDataFim} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue className="truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={categoriaSel} onValueChange={setCategoriaSel}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue className="truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {todasCategorias.map((c) => (
                  <SelectItem key={c} value={c}>{categoriaLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-3 sm:p-4 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total do período</p>
            <p className="text-lg sm:text-xl font-semibold mt-1 truncate">{formatCurrency(totalGeral)}</p>
          </Card>
          <Card className="p-3 sm:p-4 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Categorias</p>
            <p className="text-lg sm:text-xl font-semibold mt-1">{categorias.length}</p>
          </Card>
          <Card className="p-3 sm:p-4 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Despesas consideradas</p>
            <p className="text-lg sm:text-xl font-semibold mt-1">{filtradas.length}</p>
          </Card>
        </div>

        {detalhe ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setDetalhe(null); setLimite(PAGE_SIZE); }}>
                <ArrowLeft className="size-4 mr-1" /> Voltar
              </Button>
              <span className="font-medium truncate min-w-0 max-w-full">{categoriaLabel(detalhe)}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {detalheRows.length} lançamento(s)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <Button
                  key={c.name}
                  size="sm"
                  variant={c.name === detalhe ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => { setDetalhe(c.name); setLimite(PAGE_SIZE); }}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border max-w-full">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-left p-2">Fornecedor</th>
                    <th className="text-right p-2">Valor</th>
                    <th className="text-left p-2">Vencimento</th>
                    <th className="text-left p-2">Pagamento</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Empresa</th>
                  </tr>
                </thead>
                <tbody>
                  {detalheRows.slice(0, limite).map((d) => (
                    <tr key={d.id} className="border-t border-border/60">
                      <td className="p-2 max-w-[180px] truncate">{d.descricao ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{categoriaLabel(d.categoria)}</td>
                      <td className="p-2 max-w-[140px] truncate">{fornecedorNome(d.fornecedor_id)}</td>
                      <td className="p-2 text-right font-medium whitespace-nowrap">{formatCurrency(Number(d.valor ?? 0))}</td>
                      <td className="p-2 whitespace-nowrap">{formatDate(d.data_vencimento)}</td>
                      <td className="p-2 whitespace-nowrap">{formatDate(d.data_pagamento)}</td>
                      <td className="p-2 whitespace-nowrap"><StatusBadge status={d.status} /></td>
                      <td className="p-2 max-w-[140px] truncate">{empresaNome(d.empresa_id)}</td>
                    </tr>
                  ))}
                  {detalheRows.length === 0 && (
                    <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhuma despesa.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {detalheRows.length > limite && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setLimite((l) => l + PAGE_SIZE)}>
                  Carregar mais ({detalheRows.length - limite} restantes)
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-[300px] sm:h-[360px] max-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="valor"
                    nameKey="label"
                    innerRadius="45%"
                    outerRadius="78%"
                    paddingAngle={2}
                    onClick={(e: any) => { setDetalhe(e?.payload?.name ?? null); setLimite(PAGE_SIZE); }}
                  >
                    {pieData.map((c, i) => (
                      <Cell key={c.name} fill={colors[i % colors.length]} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar categoria..."
                  className="pl-8"
                />
              </div>
              <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
                <SelectTrigger className="w-full sm:w-[220px] min-w-0">
                  <SelectValue className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor_desc">Maior valor</SelectItem>
                  <SelectItem value="valor_asc">Menor valor</SelectItem>
                  <SelectItem value="az">Ordem alfabética (A-Z)</SelectItem>
                  <SelectItem value="za">Ordem alfabética (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-right p-2">Valor</th>
                    <th className="text-right p-2">% do Total</th>
                    <th className="text-right p-2">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((c, i) => (
                    <tr
                      key={c.name}
                      onClick={() => { setDetalhe(c.name); setLimite(PAGE_SIZE); }}
                      className="border-t border-border/60 cursor-pointer hover:bg-muted/40"
                    >
                      <td className="p-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                          {c.label}
                        </span>
                      </td>
                      <td className="p-2 text-right font-medium">{formatCurrency(c.valor)}</td>
                      <td className="p-2 text-right">{c.pct.toFixed(1)}%</td>
                      <td className="p-2 text-right">{c.qtd}</td>
                    </tr>
                  ))}
                  {categorias.length === 0 && (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhuma categoria encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
