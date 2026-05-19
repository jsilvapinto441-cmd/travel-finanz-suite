import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/logs")({ component: Page });

function Page() {
  const { data } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => (await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  return (
    <PageContainer>
      <PageHeader title="Logs de Atividade" description="Histórico de acessos e alterações." />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">Nenhum log registrado.</TableCell></TableRow>
            ) : data?.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{formatDate(l.created_at)}</TableCell>
                <TableCell className="font-medium">{l.acao}</TableCell>
                <TableCell>{l.entidade ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageContainer>
  );
}
