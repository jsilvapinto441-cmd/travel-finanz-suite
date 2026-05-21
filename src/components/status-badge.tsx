import { Badge } from "@/components/ui/badge";

const map: Record<string, { label: string; cls: string }> = {
  em_aberto: { label: "Em aberto", cls: "bg-primary/15 text-primary border-primary/30" },
  pago: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  atrasado: { label: "Vencido", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  vencido: { label: "Vencido", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  parcial: { label: "Pago parcial", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  pago_parcial: { label: "Pago parcial", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
  ativo: { label: "Ativo", cls: "bg-success/15 text-success border-success/30" },
  inativo: { label: "Inativo", cls: "bg-muted text-muted-foreground border-border" },
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground border-border" },
  em_analise: { label: "Em análise", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  aguardando_pagamento: { label: "Aguardando pagamento", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  concluido: { label: "Concluído", cls: "bg-primary/12 text-primary border-primary/30" },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg = map[status ?? ""] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>;
}
