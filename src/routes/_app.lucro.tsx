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

function Page() {
  const { data: empresas } = useQuery({
    queryKey: ["lucro-empresas"],
    queryFn: async () => (await supabase.from("empresas").select("*").order("nome")).data ?? [],
  });
  const { data: contratos } = useQuery({
    queryKey: ["lucro-contratos"],
    queryFn: async () => (await supabase.from("contratos").select("*")).data ?? [],
  });
  const { data: recebiveis } = useQuery({
    queryKey: ["lucro-recebiveis"],
    queryFn: async () => (await supabase.from("recebiveis").select("*")).data ?? [],
  });
  const { data: despesas } = useQuery({
    queryKey: ["lucro-despesas"],
    queryFn: async () => (await supabase.from("despesas").select("*")).data ?? [],
  });

  const recPaid = (id: string | null, key: "contrato_id" | "empresa_id") =>
    (recebiveis ?? []).filter((r) => r[key] === id && r.status === "pago")
      .reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
  const expPaid = (id: string | null, key: "contrato_id" | "empresa_id") =>
    (despesas ?? []).filter((r) => r[key] === id && r.status === "pago")
      .reduce((s, r) => s + Number(r.valor ?? 0), 0);

  return (
    <PageContainer>
      <PageHeader title="Lucros" description="Análise de lucro por contrato e por empresa." />
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
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Lucro Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas?.map((e) => {
                  const r = recPaid(e.id, "empresa_id");
                  const d = expPaid(e.id, "empresa_id");
                  const lucro = r - d;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <span className="size-2.5 rounded-full" style={{ background: e.cor ?? "#0d7a5f" }} />
                          {e.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-success">{formatCurrency(r)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(d)}</TableCell>
                      <TableCell className={"text-right font-semibold " + (lucro >= 0 ? "text-primary" : "text-destructive")}>
                        <span className="inline-flex items-center gap-1">
                          {lucro >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          {formatCurrency(lucro)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                  <TableHead className="text-right">Lucro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos?.map((c) => {
                  const r = recPaid(c.id, "contrato_id");
                  const d = expPaid(c.id, "contrato_id");
                  const lucro = r - d;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.cliente} {c.numero && <span className="text-xs text-muted-foreground">#{c.numero}</span>}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.valor)}</TableCell>
                      <TableCell className="text-right text-success">{formatCurrency(r)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(d)}</TableCell>
                      <TableCell className={"text-right font-semibold " + (lucro >= 0 ? "text-primary" : "text-destructive")}>
                        {formatCurrency(lucro)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
