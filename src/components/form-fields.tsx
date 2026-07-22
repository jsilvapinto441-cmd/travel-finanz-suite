import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ReactNode, useState, useEffect, useRef } from "react";
import { validateDateString, MIN_DATE, MAX_DATE } from "@/lib/date-validation";


export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}

export function TextField({
  label, value, onChange, type = "text", required, placeholder,
}: {
  label: string; value: any; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        required={required} placeholder={placeholder} />
    </Field>
  );
}

export function NumberField({
  label, value, onChange, step = "0.01", required, min, max,
}: { label: string; value: any; onChange: (v: number) => void; step?: string; required?: boolean; min?: number; max?: number }) {
  const [text, setText] = useState<string>(() => (value === null || value === undefined || value === "" ? "" : String(value)));

  useEffect(() => {
    const incoming = value === null || value === undefined || value === "" ? "" : String(value);
    const currentNum = text === "" || text === "-" ? NaN : Number(text);
    const incomingNum = incoming === "" ? NaN : Number(incoming);
    if (incoming !== text && !(Number.isFinite(currentNum) && Number.isFinite(incomingNum) && currentNum === incomingNum)) {
      setText(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function sanitize(raw: string): string {
    if (raw === "" || raw === "-") return raw;
    // Allow only digits, one optional leading minus, and one decimal separator
    let s = raw.replace(",", ".");
    const negative = s.startsWith("-");
    s = s.replace(/-/g, "");
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    s = s.replace(/[^\d.]/g, "");
    // Strip leading zeros from integer part (but keep "0." for decimals)
    const [intPart, decPart] = s.split(".");
    let cleanedInt = intPart.replace(/^0+/, "");
    if (cleanedInt === "" && (decPart !== undefined || intPart !== "")) cleanedInt = decPart !== undefined ? "0" : "";
    s = decPart !== undefined ? `${cleanedInt}.${decPart}` : cleanedInt;
    return (negative ? "-" : "") + s;
  }

  function handleChange(raw: string) {
    const clean = sanitize(raw);
    setText(clean);
    if (clean === "" || clean === "-" || clean === "." || clean === "-.") {
      onChange(required ? 0 : (NaN as unknown as number));
      return;
    }
    const n = Number(clean);
    if (Number.isFinite(n)) onChange(n);
  }

  function handleBlur() {
    if (text === "" || text === "-" || text === "." || text === "-.") {
      if (required) { setText("0"); onChange(0); }
      return;
    }
    const n = Number(text);
    if (!Number.isFinite(n)) { if (required) { setText("0"); onChange(0); } return; }
    let v = n;
    if (typeof min === "number" && v < min) v = min;
    if (typeof max === "number" && v > max) v = max;
    setText(String(v));
    onChange(v);
  }

  return (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onFocus={(e) => { if (text === "0") { setText(""); } e.target.select(); }}
        required={required}
        min={min}
        max={max}
      />
    </Field>
  );
}

export function TextAreaField({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
    </Field>
  );
}

const BRL_DECIMAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCentsToBRL(cents: number): string {
  return "R$ " + BRL_DECIMAL.format(cents / 100);
}

function numberToCents(n: number | string | null | undefined): number {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
}

export function CurrencyField({
  label, value, onChange, required,
}: { label: string; value: any; onChange: (v: number) => void; required?: boolean }) {
  const [display, setDisplay] = useState(() => formatCentsToBRL(numberToCents(value)));

  useEffect(() => {
    const incoming = numberToCents(value);
    const current = Math.round((Number(display.replace(/[^\d]/g, "")) || 0));
    if (incoming !== current) {
      setDisplay(formatCentsToBRL(incoming));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 15);
    const cents = digits === "" ? 0 : Number(digits);
    setDisplay(formatCentsToBRL(cents));
    onChange(cents / 100);
  }

  return (
    <Field label={label}>
      <Input
        inputMode="numeric"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        required={required}
      />
    </Field>
  );
}

export function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label: string; value: any; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder ?? "Selecionar..."} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}
