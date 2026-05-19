import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ReactNode } from "react";

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
