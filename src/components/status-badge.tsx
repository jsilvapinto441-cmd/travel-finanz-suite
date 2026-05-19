import { Badge } from "@/components/ui/badge";

const map: Record<string, { label: string; cls: string }> = {
  em_aberto: { label: "Em aberto", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
  pago: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  atrasado: { label: "Atrasado", cls: "bg-destructive/12 text-destructive border-destructive/30" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
  ativo: { label: "Ativo", cls: "bg-success/15 text-success border-success/30" },
  inativo: { label: "Inativo", cls: "bg-muted text-muted-foreground border-border" },
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground border-border" },
  concluido: { label: "Concluído", cls: "bg-primary/12 text-primary border-primary/30" },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg = map[status ?? ""] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>;
}
