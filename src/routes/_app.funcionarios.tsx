import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, CurrencyField, SelectField, Field } from "@/components/form-fields";
import { useEmpresas, nomeById } from "@/lib/lookups";
import { formatCurrency } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Users, Wallet, UserCheck, UserX } from "lucide-react";
import { calcFGTS, calcINSS, custoTotalFuncionario, folhaTotal } from "@/lib/folha";
import { useEffect } from "react";

export const Route = createFileRoute("/_app/funcionarios")({ component: Page });

type T = {
  id: string;
  empresa_id: string | null;
  nome: string;
  cargo: string | null;
  data_admissao: string | null;
  salario: number;
  vale_transporte: number;
  alimentacao: number;
  fgts: number;
  inss: number;
  custos_adicionais: number;
  encargos_auto: boolean;
  ativo: boolean;
};

function Page() {
  const { data: empresas } = useEmpresas();

  const { data: todos } = useQuery({
    queryKey: ["funcionarios-resumo"],
    queryFn: async () =>
      (await supabase
        .from("funcionarios")
        .select("id,ativo,salario,vale_transporte,alimentacao,fgts,inss,custos_adicionais")
      ).data ?? [],
    staleTime: 30_000,
  });

  const ativos = (todos ?? []).filter((f: any) => f.ativo);
  const inativos = (todos ?? []).filter((f: any) => !f.ativo);
  const folha = folhaTotal(todos as any);

  return (
    <PageContainer>
      <PageHeader
        title="Funcionários"
        description="Folha de pagamento — cálculo automático de encargos e integração com o Financeiro."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Wallet className="size-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Folha mensal</div>
            <div className="font-display text-xl font-semibold">{formatCurrency(folha)}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
            <UserCheck className="size-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Ativos</div>
            <div className="font-display text-xl font-semibold">{ativos.length}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
            <UserX className="size-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Inativos</div>
            <div className="font-display text-xl font-semibold">{inativos.length}</div>
          </div>
        </Card>
      </div>

      <DataTable<T>
        table="funcionarios"
        title="Funcionário"
        searchFields={["nome", "cargo"]}
        orderBy="nome"
        ascending
        defaultValues={{
          ativo: true,
          encargos_auto: true,
          salario: 0,
          alimentacao: 0,
          vale_transporte: 0,
          fgts: 0,
          inss: 0,
          custos_adicionais: 0,
        } as any}
        columns={[
          {
            key: "nome",
            label: "Nome",
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.nome}</span>
                {!r.ativo && <Badge variant="outline" className="text-xs">Inativo</Badge>}
              </div>
            ),
          },
          { key: "cargo", label: "Cargo", render: (r) => r.cargo ?? "—" },
          { key: "empresa", label: "Empresa", render: (r) => nomeById(empresas, r.empresa_id) },
          { key: "salario", label: "Salário", render: (r) => formatCurrency(r.salario) },
          {
            key: "encargos",
            label: "Encargos",
            render: (r) => (
              <span className="text-muted-foreground text-xs">
                FGTS {formatCurrency(r.fgts)} · INSS {formatCurrency(r.inss)}
              </span>
            ),
          },
          {
            key: "custo",
            label: "Custo mensal",
            render: (r) => (
              <span className="font-semibold text-primary">
                {formatCurrency(custoTotalFuncionario(r))}
              </span>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) =>
              r.ativo ? (
                <Badge className="bg-success/15 text-success border-success/30">Ativo</Badge>
              ) : (
                <Badge variant="outline">Inativo</Badge>
              ),
          },
        ]}
        renderForm={({ values, setValues }) => (
          <FuncionarioForm values={values} setValues={setValues} empresas={empresas ?? []} />
        )}
      />
    </PageContainer>
  );
}

function FuncionarioForm({
  values,
  setValues,
  empresas,
}: {
  values: Partial<T>;
  setValues: React.Dispatch<React.SetStateAction<Partial<T>>>;
  empresas: { id: string; nome: string }[];
}) {
  const autoEncargos = values.encargos_auto ?? true;

  // Recalcula encargos automaticamente quando o salário muda (e auto está ligado)
  useEffect(() => {
    if (!autoEncargos) return;
    const s = Number(values.salario ?? 0);
    const fgts = calcFGTS(s);
    const inss = calcINSS(s);
    if (Number(values.fgts ?? 0) !== fgts || Number(values.inss ?? 0) !== inss) {
      setValues((v) => ({ ...v, fgts, inss }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.salario, autoEncargos]);

  const custoTotal = custoTotalFuncionario(values as any);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Nome"
          value={values.nome}
          onChange={(v) => setValues({ ...values, nome: v })}
          required
        />
        <TextField
          label="Cargo"
          value={values.cargo}
          onChange={(v) => setValues({ ...values, cargo: v })}
        />
        <SelectField
          label="Empresa"
          value={values.empresa_id ?? ""}
          onChange={(v) => setValues({ ...values, empresa_id: v })}
          options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
        />
        <TextField
          label="Data de admissão"
          type="date"
          value={values.data_admissao}
          onChange={(v) => setValues({ ...values, data_admissao: v })}
        />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
          Salário e benefícios
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CurrencyField
            label="Salário base"
            value={values.salario}
            onChange={(v) => setValues({ ...values, salario: v })}
          />
          <CurrencyField
            label="Vale alimentação"
            value={values.alimentacao}
            onChange={(v) => setValues({ ...values, alimentacao: v })}
          />
          <CurrencyField
            label="Vale transporte"
            value={values.vale_transporte}
            onChange={(v) => setValues({ ...values, vale_transporte: v })}
          />
          <CurrencyField
            label="Custos adicionais"
            value={values.custos_adicionais}
            onChange={(v) => setValues({ ...values, custos_adicionais: v })}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Encargos
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Editar manualmente</span>
            <Switch
              checked={!autoEncargos}
              onCheckedChange={(checked) => {
                const manual = !!checked;
                setValues((v) => {
                  const next = { ...v, encargos_auto: !manual } as Partial<T>;
                  if (!manual) {
                    const s = Number(v.salario ?? 0);
                    next.fgts = calcFGTS(s);
                    next.inss = calcINSS(s);
                  }
                  return next;
                });
              }}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={autoEncargos ? "opacity-60 pointer-events-none" : ""}>
            <CurrencyField
              label="FGTS (8%)"
              value={values.fgts}
              onChange={(v) => setValues({ ...values, fgts: v })}
            />
          </div>
          <div className={autoEncargos ? "opacity-60 pointer-events-none" : ""}>
            <CurrencyField
              label="INSS (progressivo)"
              value={values.inss}
              onChange={(v) => setValues({ ...values, inss: v })}
            />
          </div>
        </div>
        {autoEncargos && (
          <p className="text-xs text-muted-foreground mt-2">
            FGTS e INSS estão sendo calculados automaticamente a partir do salário base.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Custo mensal total
          </div>
          <div className="font-display text-2xl font-semibold text-primary">
            {formatCurrency(custoTotal)}
          </div>
        </div>
        <Field label="Status">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={values.ativo ?? true}
              onCheckedChange={(checked) => setValues({ ...values, ativo: !!checked })}
            />
            <span>{values.ativo ?? true ? "Ativo" : "Inativo"}</span>
          </label>
        </Field>
      </div>
    </div>
  );
}
