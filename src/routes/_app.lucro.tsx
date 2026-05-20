import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/lucro")({ component: Page });

type LucroEmpresa = {
  empresa_id: string; nome: string; cor: string | null;
  receita_realizada: number; receita_prevista: number;
  despesa_realizada: number; despesa_prevista: number;
  lucro_realizado: number; lucro_projetado: number;
};
type LucroContrato = {
  contrato_id: string; empresa_id: string | null; cliente: string; numero: string | null;
  valor_contrato: number;
  receita_realizada: number; receita_prevista: number;
  despesa_realizada: number; despesa_prevista: number;
  lucro_realizado: number; lucro_projetado: number;
};

function Page() {
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { order: (col: string) => Promise<{ data: unknown }> };
    };
  };
  const { data: empresas = [] } = useQuery({
    queryKey: ["lucro-por-empresa"],
    queryFn: async () => {
      const { data } = await db.from("lucro_por_empresa").select("*").order("nome");
      return (data ?? []) as LucroEmpresa[];
    },
  });
  const { data: contratos = [] } = useQuery({
    queryKey: ["lucro-por-contrato"],
    queryFn: async () => {
      const { data } = await db.from("lucro_por_contrato").select("*").order("cliente");
      return (data ?? []) as LucroContrato[];
    },
  });

  return (
    <PageContainer>
      <PageHeader title="Lucros" description="Lucro realizado (pago/recebido) e projetado (incluindo previstos) por empresa e contrato." />
      <Tabs defaultValue="empresas">
        <TabsList>
          <TabsTrigger value="empresas">Por Empresa</TabsTrigger>
          <TabsTrigger value="contratos">Por Contrato</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Lucro Realizado</TableHead>
                  <TableHead className="text-right">Lucro Projetado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((e) => (
                  <TableRow key={e.empresa_id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <span className="size-2.5 rounded-full" style={{ background: e.cor ?? "#0d7a5f" }} />
                        {e.nome}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(e.receita_realizada)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(e.despesa_realizada)}</TableCell>
                    <TableCell className={"text-right font-semibold " + (e.lucro_realizado >= 0 ? "text-primary" : "text-destructive")}>
                      <span className="inline-flex items-center gap-1">
                        {e.lucro_realizado >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        {formatCurrency(e.lucro_realizado)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(e.lucro_projetado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="contratos">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Lucro Real.</TableHead>
                  <TableHead className="text-right">Lucro Proj.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => (
                  <TableRow key={c.contrato_id}>
                    <TableCell className="font-medium">
                      {c.cliente} {c.numero && <span className="text-xs text-muted-foreground">#{c.numero}</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(c.valor_contrato)}</TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(c.receita_realizada)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(c.despesa_realizada)}</TableCell>
                    <TableCell className={"text-right font-semibold " + (c.lucro_realizado >= 0 ? "text-primary" : "text-destructive")}>
                      {formatCurrency(c.lucro_realizado)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(c.lucro_projetado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
