import { useState } from "react";
import { SelectField } from "@/components/form-fields";
import { useEmpresas } from "@/lib/lookups";
import { Building2 } from "lucide-react";

export function EmpresaFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: empresas } = useEmpresas();

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <Building2 className="size-4 text-muted-foreground shrink-0" />
      <SelectField
        label=""
        value={value === "" ? "__all__" : value}
        onChange={(v) => onChange(v === "__all__" ? "" : v)}
        options={[
          { value: "__all__", label: "Todas as empresas" },
          ...(empresas ?? []).map((e) => ({ value: e.id, label: e.nome })),
        ]}
      />
    </div>
  );
}
