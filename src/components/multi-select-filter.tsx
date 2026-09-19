import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown, X } from "lucide-react";

export type MultiSelectOption = { value: string; label: string };

export function MultiSelectFilter({
  label,
  placeholder = "Todos",
  options,
  value,
  onChange,
  icon,
  className = "",
  selectedLabel = "selecionadas",
  allLabel = "Selecionar todas",
}: {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  icon?: React.ReactNode;
  className?: string;
  selectedLabel?: string;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? value[0]
        : `${value.length} ${selectedLabel}`;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between font-normal sm:min-w-[200px]"
          >
            <span className="truncate">
              {label ? <span className="text-muted-foreground mr-1">{label}:</span> : null}
              {summary}
            </span>
            <ChevronDown className="size-4 opacity-60 ml-2 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-1 w-56">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label ?? "Selecionar"}
            </span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="size-3" /> Limpar
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {options.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 text-sm text-left border-b border-border mb-1"
              >
                <Checkbox checked={value.length === 0} className="pointer-events-none" />
                <span className="flex-1 truncate">{allLabel}</span>
                {value.length === 0 && <Check className="size-3.5 text-primary" />}
              </button>
            )}
            {options.map((o) => {
              const checked = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 text-sm text-left"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="flex-1 truncate">{o.label}</span>
                  {checked && <Check className="size-3.5 text-primary" />}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                Nenhuma opção
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
