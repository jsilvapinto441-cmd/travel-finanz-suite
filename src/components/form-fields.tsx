import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ReactNode, useState, useEffect } from "react";

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
  label, value, onChange, step = "0.01", required,
}: { label: string; value: any; onChange: (v: number) => void; step?: string; required?: boolean }) {
  return (
    <Field label={label}>
      <Input type="number" step={step} value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        required={required} />
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
