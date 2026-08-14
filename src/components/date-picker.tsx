import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MIN_DATE_OBJ,
  MAX_DATE_OBJ,
  MIN_YEAR,
  MAX_YEAR,
  DATE_RANGE_MESSAGE,
  isoToDate,
  dateToIso,
  validateDateString,
} from "@/lib/date-validation";

export interface DatePickerProps {
  value?: string | null;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  id?: string;
  "aria-label"?: string;
}

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function DatePicker({
  value,
  onChange,
  required,
  placeholder = "dd/mm/aaaa",
  className,
  invalid,
  id,
  ...rest
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = isoToDate(value ?? "");
  const isValid = validateDateString(value ?? "").ok;
  const showInvalid = invalid || !isValid;

  // Mês/ano de abertura: valor atual (se dentro do intervalo) ou hoje (clamp).
  const today = new Date();
  const clampedToday =
    today < MIN_DATE_OBJ ? MIN_DATE_OBJ : today > MAX_DATE_OBJ ? MAX_DATE_OBJ : today;
  const defaultMonth =
    selected && selected >= MIN_DATE_OBJ && selected <= MAX_DATE_OBJ
      ? selected
      : clampedToday;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={showInvalid || undefined}
          aria-label={rest["aria-label"]}
          className={cn(
            "w-full justify-start text-left font-normal min-w-0",
            !selected && "text-muted-foreground",
            showInvalid && "border-destructive focus-visible:ring-destructive",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className="truncate min-w-0">
            {selected ? fmt.format(selected) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={defaultMonth}
          startMonth={MIN_DATE_OBJ}
          endMonth={MAX_DATE_OBJ}
          captionLayout="dropdown"
          disabled={{ before: MIN_DATE_OBJ, after: MAX_DATE_OBJ }}
          onSelect={(d) => {
            if (!d) {
              if (!required) onChange("");
              return;
            }
            if (d < MIN_DATE_OBJ || d > MAX_DATE_OBJ) return;
            onChange(dateToIso(d));
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="px-3 pb-3 text-[11px] text-muted-foreground">
          Intervalo permitido: {MIN_YEAR}–{MAX_YEAR}.
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DATE_RANGE_MESSAGE };
