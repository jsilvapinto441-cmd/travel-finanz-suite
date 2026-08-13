import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({ component: Page });

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const profiles = (await supabase.from("profiles").select("*").order("nome")).data ?? [];
      const roles = (await supabase.from("user_roles").select("*")).data ?? [];
      return profiles.map((p) => ({ ...p, role: roles.find((r) => r.user_id === p.id)?.role ?? "viewer" }));
    },
    enabled: isAdmin,
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
      toast.success("Permissão atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader title="Configurações" description="Gerencie usuários, permissões e backups." />
      <div className="space-y-4">
        <BackupRestore />
        {isAdmin ? (
          <Card className="p-4 sm:p-6">
            <h3 className="font-display font-semibold mb-4">Usuários do Sistema</h3>
            <div className="space-y-2">
              {profiles?.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 p-3 rounded-md border sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  </div>
                  <Select value={p.role} onValueChange={(v) => updateRole.mutate({ userId: p.id, role: v })}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center text-muted-foreground text-sm">
            Gerenciamento de usuários disponível apenas para administradores.
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

