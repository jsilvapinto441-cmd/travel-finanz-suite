import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label, value, hint, icon, tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "gold";
}) {
  const toneClass = {
    default: "from-primary/8 to-transparent",
    success: "from-success/12 to-transparent",
    warning: "from-warning/15 to-transparent",
    destructive: "from-destructive/12 to-transparent",
    gold: "from-gold/15 to-transparent",
  }[tone];

  const iconTone = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/12 text-destructive",
    gold: "bg-gold/20 text-gold-foreground",
  }[tone];

  return (
    <Card className={cn("relative overflow-hidden p-5 bg-gradient-to-br", toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </div>
          <div
            className="font-display font-bold mt-2 leading-tight break-words tabular-nums text-[clamp(1.125rem,2.2vw,1.5rem)]"
            style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            {value}
          </div>
          {hint && <div className="text-xs text-muted-foreground mt-1 break-words">{hint}</div>}
        </div>
        {icon && (
          <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", iconTone)}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
