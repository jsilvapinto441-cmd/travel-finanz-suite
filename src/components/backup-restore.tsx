import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  criarBackup, listarBackups, baixarBackup, excluirBackup, restaurarBackup,
  obterAgendamento, salvarAgendamento,
} from "@/lib/backup.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DatabaseBackup, Download, Loader2, RotateCcw, ShieldCheck, Trash2, Clock,
} from "lucide-react";
import { toast } from "sonner";

function formatSize(n: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const TIPO_LABEL: Record<string, string> = {
  manual: "Manual",
  automatico: "Automático",
  seguranca: "Segurança (pré-restauração)",
};

export function BackupRestore() {
  const qc = useQueryClient();
  const fnCriar = useServerFn(criarBackup);
  const fnListar = useServerFn(listarBackups);
  const fnBaixar = useServerFn(baixarBackup);
  const fnExcluir = useServerFn(excluirBackup);
  const fnRestaurar = useServerFn(restaurarBackup);
  const fnAgenda = useServerFn(obterAgendamento);
  const fnSalvarAgenda = useServerFn(salvarAgendamento);

  const [restaurarId, setRestaurarId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const { data: backups, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => fnListar(),
  });

  const { data: agenda } = useQuery({ queryKey: ["backup-schedule"], queryFn: () => fnAgenda() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["backups"] });

  const criar = useMutation({
    mutationFn: () => fnCriar(),
    onSuccess: () => { invalidate(); toast.success("Backup criado com sucesso"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixar = useMutation({
    mutationFn: (id: string) => fnBaixar({ data: { id } }),
    onSuccess: (r) => { window.open(r.url, "_blank"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => fnExcluir({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Backup excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restaurar = useMutation({
    mutationFn: (id: string) => fnRestaurar({ data: { id, confirmacao: "RESTAURAR" as const } }),
    onSuccess: (r) => {
      setRestaurarId(null);
      setConfirmText("");
      invalidate();
      qc.invalidateQueries();
      toast.success(`Restauração concluída · ${r.arquivos} arquivo(s) recuperado(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarAgenda2 = useMutation({
    mutationFn: (v: { ativo: boolean; frequencia: "diario" | "semanal"; hora_utc: number; reter_ultimos: number }) =>
      fnSalvarAgenda({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-schedule"] });
      toast.success("Agendamento salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ultimo = (backups ?? []).find((b) => b.status === "concluido");

  return (
    <div className="space-y-4">
      {/* Último backup + ação principal */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <DatabaseBackup className="size-4 text-primary" /> Backup e Restauração
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Cópia completa dos seus dados (empresas, missões, contratos, recebíveis, despesas,
              cadastros, movimentações) e dos arquivos anexados.
            </p>
            <p className="text-sm mt-3">
              {ultimo ? (
                <>
                  Último backup: <span className="font-medium">{formatDate(ultimo.created_at)}</span>{" "}
                  <span className="text-muted-foreground">
                    · {formatSize(ultimo.tamanho_bytes)} · {ultimo.total_registros} registros ·{" "}
                    {ultimo.total_arquivos} arquivos
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Nenhum backup realizado ainda.</span>
              )}
            </p>
          </div>
          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending}
            className="w-full sm:w-auto shrink-0"
          >
            {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
            <span className="ml-2">Realizar novo backup</span>
          </Button>
        </div>
      </Card>

      {/* Histórico */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-display font-semibold mb-4">Histórico de backups</h3>
        {isLoading ? (
          <div className="py-8 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !backups?.length ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum backup no histórico.</div>
        ) : (
          <ul className="space-y-2">
            {backups.map((b) => (
              <li key={b.id} className="rounded-md border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{formatDate(b.created_at)}</span>
                    <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[b.tipo] ?? b.tipo}</Badge>
                    <Badge
                      variant={b.status === "concluido" ? "secondary" : b.status === "erro" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {b.status === "concluido" ? "Concluído" : b.status === "erro" ? "Erro" : "Processando"}
                    </Badge>
                    {b.restaurado_em && (
                      <Badge variant="outline" className="text-[10px]">Restaurado em {formatDate(b.restaurado_em)}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground break-words">
                    {formatSize(b.tamanho_bytes)} · {b.total_registros} registros · {b.total_arquivos} arquivos
                    {b.erro ? ` · ${b.erro}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm" variant="outline" className="flex-1 sm:flex-none"
                    disabled={b.status !== "concluido" || baixar.isPending}
                    onClick={() => baixar.mutate(b.id)}
                  >
                    <Download className="size-3.5" /><span className="ml-1.5">Baixar</span>
                  </Button>
                  <Button
                    size="sm" variant="outline" className="flex-1 sm:flex-none"
                    disabled={b.status !== "concluido"}
                    onClick={() => { setRestaurarId(b.id); setConfirmText(""); }}
                  >
                    <RotateCcw className="size-3.5" /><span className="ml-1.5">Restaurar</span>
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => excluir.mutate(b.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Agendamento */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-display font-semibold mb-1 flex items-center gap-2">
          <Clock className="size-4 text-primary" /> Backups automáticos
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Defina a frequência desejada. A rotina automática usa esta configuração.
        </p>
        <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <div className="flex items-center gap-2">
            <Switch
              checked={!!agenda?.ativo}
              onCheckedChange={(v) =>
                salvarAgenda2.mutate({
                  ativo: v,
                  frequencia: (agenda?.frequencia as "diario" | "semanal") ?? "semanal",
                  hora_utc: agenda?.hora_utc ?? 6,
                  reter_ultimos: agenda?.reter_ultimos ?? 10,
                })
              }
            />
            <Label className="text-sm">Ativado</Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frequência</Label>
            <Select
              value={agenda?.frequencia ?? "semanal"}
              onValueChange={(v) =>
                salvarAgenda2.mutate({
                  ativo: !!agenda?.ativo,
                  frequencia: v as "diario" | "semanal",
                  hora_utc: agenda?.hora_utc ?? 6,
                  reter_ultimos: agenda?.reter_ultimos ?? 10,
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diário</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hora (UTC)</Label>
            <Input
              type="number" min={0} max={23} defaultValue={agenda?.hora_utc ?? 6}
              onBlur={(e) =>
                salvarAgenda2.mutate({
                  ativo: !!agenda?.ativo,
                  frequencia: (agenda?.frequencia as "diario" | "semanal") ?? "semanal",
                  hora_utc: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                  reter_ultimos: agenda?.reter_ultimos ?? 10,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Manter últimos</Label>
            <Input
              type="number" min={1} max={60} defaultValue={agenda?.reter_ultimos ?? 10}
              onBlur={(e) =>
                salvarAgenda2.mutate({
                  ativo: !!agenda?.ativo,
                  frequencia: (agenda?.frequencia as "diario" | "semanal") ?? "semanal",
                  hora_utc: agenda?.hora_utc ?? 6,
                  reter_ultimos: Math.min(60, Math.max(1, Number(e.target.value) || 10)),
                })
              }
            />
          </div>
        </div>
        {agenda?.proxima_execucao && (
          <p className="text-xs text-muted-foreground mt-3">
            Próxima execução prevista: {formatDate(agenda.proxima_execucao)}
          </p>
        )}
      </Card>

      {/* Confirmação de restauração */}
      <Dialog open={!!restaurarId} onOpenChange={(o) => { if (!o) { setRestaurarId(null); setConfirmText(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Confirmar restauração
            </DialogTitle>
            <DialogDescription>
              Todos os dados atuais da sua conta serão substituídos pelo conteúdo deste backup.
              Um backup de segurança do estado atual será criado automaticamente antes de continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Digite <span className="font-mono font-semibold">RESTAURAR</span> para confirmar</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} placeholder="RESTAURAR" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRestaurarId(null)}>Cancelar</Button>
            <Button
              disabled={confirmText !== "RESTAURAR" || restaurar.isPending}
              onClick={() => restaurarId && restaurar.mutate(restaurarId)}
            >
              {restaurar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              <span className="ml-2">Restaurar agora</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
