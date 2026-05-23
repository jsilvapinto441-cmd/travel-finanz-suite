import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, Trash2, UserCog } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { listUsers, deleteUser, setUserRole } from "@/lib/admin-users.functions";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/admin")({ component: Page });

function Page() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchUsers = useServerFn(listUsers);
  const removeUser = useServerFn(deleteUser);
  const changeRole = useServerFn(setUserRole);

  const [toDelete, setToDelete] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/" });
    }
  }, [loading, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

  const delMutation = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "financeiro" | "viewer" }) =>
      changeRole({ data: v }),
    onSuccess: () => {
      toast.success("Permissão atualizada.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !isAdmin) return null;

  const users = data ?? [];
  const totalAdmins = users.filter((u) => u.roles.includes("admin")).length;

  return (
    <PageContainer>
      <PageHeader
        title="Administração"
        description="Gerencie usuários, permissões e acessos ao sistema."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <UserCog className="size-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Total de usuários</div>
              <div className="text-2xl font-display font-semibold">{users.length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="size-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Administradores</div>
              <div className="text-2xl font-display font-semibold">{totalAdmins}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Sua conta</div>
          <div className="text-sm font-medium truncate">{user?.email}</div>
          <Badge variant="outline" className="mt-1">Administrador</Badge>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Permissão</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.id === user?.id;
                const currentRole = (u.roles[0] ?? "viewer") as "admin" | "financeiro" | "viewer";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.nome ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={currentRole}
                        onValueChange={(role) =>
                          roleMutation.mutate({ userId: u.id, role: role as any })
                        }
                        disabled={isSelf || roleMutation.isPending}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="financeiro">Financeiro</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.ultimo_login ? formatDate(u.ultimo_login) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(u.criado_em)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf}
                        onClick={() => setToDelete({ id: u.id, email: u.email })}
                        title={isSelf ? "Você não pode excluir sua própria conta" : "Excluir usuário"}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o login de <strong>{toDelete?.email}</strong>.
              Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && delMutation.mutate(toDelete.id)}
              disabled={delMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
