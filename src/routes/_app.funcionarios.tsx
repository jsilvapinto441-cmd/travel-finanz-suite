import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, CurrencyField, SelectField } from "@/components/form-fields";
import { useEmpresas, nomeById } from "@/lib/lookups";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_app/funcionarios")({ component: Page });

type T = {
  id: string; empresa_id: string | null; nome: string; cargo: string | null;
  salario: number; vale_transporte: number; alimentacao: number; fgts: number;
  inss: number; custos_adicionais: number; ativo: boolean;
};

function Page() {
  const { data: empresas } = useEmpresas();
  return (
    <PageContainer>
      <PageHeader title="Funcionários" description="Folha de pagamento e custos por colaborador." />
      <DataTable<T>
        table="funcionarios" title="Funcionário" searchFields={["nome", "cargo"]} orderBy="nome" ascending
        columns={[
          { key: "nome", label: "Nome", render: (r) => <span className="font-medium">{r.nome}</span> },
          { key: "cargo", label: "Cargo" },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          { key: "salario", label: "Salário", render: (r) => formatCurrency(r.salario) },
          { key: "custo", label: "Custo total", render: (r) => (
            <span className="font-semibold text-primary">
              {formatCurrency(Number(r.salario) + Number(r.vale_transporte) + Number(r.alimentacao) + Number(r.fgts) + Number(r.inss) + Number(r.custos_adicionais))}
            </span>
          ) },
        ]}
        renderForm={({ values, setValues }) => (
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nome" value={values.nome} onChange={(v) => setValues({ ...values, nome: v })} required />
            <TextField label="Cargo" value={values.cargo} onChange={(v) => setValues({ ...values, cargo: v })} />
            <SelectField label="Empresa" value={values.empresa_id ?? ""} onChange={(v) => setValues({ ...values, empresa_id: v })}
              options={(empresas ?? []).map((e) => ({ value: e.id, label: e.nome }))} />
            <CurrencyField label="Salário" value={values.salario} onChange={(v) => setValues({ ...values, salario: v })} />
            <CurrencyField label="Vale Transporte" value={values.vale_transporte} onChange={(v) => setValues({ ...values, vale_transporte: v })} />
            <CurrencyField label="Alimentação" value={values.alimentacao} onChange={(v) => setValues({ ...values, alimentacao: v })} />
            <CurrencyField label="FGTS" value={values.fgts} onChange={(v) => setValues({ ...values, fgts: v })} />
            <CurrencyField label="INSS" value={values.inss} onChange={(v) => setValues({ ...values, inss: v })} />
            <CurrencyField label="Custos Adicionais" value={values.custos_adicionais} onChange={(v) => setValues({ ...values, custos_adicionais: v })} />
          </div>
        )}
      />
    </PageContainer>
  );
}
