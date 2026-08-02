import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TextField, SelectField, TextAreaField } from "@/components/form-fields";
import { ExportButton } from "@/components/export-button";
import { useContasBancarias, contaLabel } from "@/lib/bancos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { X, Landmark, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/empresas")({ component: Page });

export type Socio = {
  nome: string;
  cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
};

type Empresa = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  cor: string | null;
  ativo: boolean;
  conta_bancaria_id: string | null;
  endereco: string | null;
  socios: Socio[] | null;
};

type Vinculo = { empresa_id: string; conta_bancaria_id: string };

const MAX_SOCIOS = 3;

const parseSocios = (v: unknown): Socio[] =>
  Array.isArray(v) ? (v as Socio[]).filter((s) => s && typeof s === "object") : [];

function Page() {
  const qc = useQueryClient();
  const [detalhe, setDetalhe] = useState<Empresa | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-export"],
    queryFn: async () =>
      (await supabase
        .from("empresas")
        .select("id,nome,razao_social,cnpj,cor,ativo,conta_bancaria_id,endereco,socios")
        .order("nome")).data ?? [],
    staleTime: 30_000,
  });

  const { data: contas = [] } = useContasBancarias();
  const contaMap = new Map(contas.map((c) => [c.id, contaLabel(c)]));

  const { data: vinculos = [] } = useQuery({
    queryKey: ["empresa-contas-vinculos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_contas_bancarias" as any)
        .select("empresa_id, conta_bancaria_id");
      return (data ?? []) as unknown as Vinculo[];
    },
    staleTime: 10_000,
  });

  const contasPorEmpresa = new Map<string, string[]>();
  for (const v of vinculos) {
    const arr = contasPorEmpresa.get(v.empresa_id) ?? [];
    arr.push(v.conta_bancaria_id);
    contasPorEmpresa.set(v.empresa_id, arr);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Empresas"
        description="Gerencie as empresas do grupo. Vincule uma ou várias contas bancárias já cadastradas no módulo Bancos."
        actions={
          <ExportButton<Empresa>
            title="Empresas"
            filename="empresas"
            rows={empresas as Empresa[]}
            columns={[
              { header: "Nome", accessor: "nome" },
              { header: "Razão Social", accessor: "razao_social" },
              { header: "CNPJ", accessor: "cnpj" },
              { header: "Endereço", accessor: (r) => r.endereco || "—" },
              {
                header: "Sócios",
                accessor: (r) =>
                  parseSocios(r.socios)
                    .map((s) => [s.nome, s.cargo].filter(Boolean).join(" - "))
                    .join(" | ") || "—",
              },
              {
                header: "Contas Bancárias",
                accessor: (r) =>
                  (contasPorEmpresa.get(r.id) ?? [])
                    .map((cid) => contaMap.get(cid))
                    .filter(Boolean)
                    .join(" | ") || "—",
              },
              { header: "Status", accessor: (r) => (r.ativo ? "Ativa" : "Inativa") },
            ]}
          />
        }
      />
      <DataTable<Empresa>
        table="empresas"
        title="Empresa"
        searchFields={["nome", "cnpj"]}
        orderBy="nome"
        ascending
        columns={[
          {
            key: "cor",
            label: "",
            render: (r) => (
              <span
                className="inline-block size-3 rounded-full"
                style={{ background: r.cor ?? "#0d7a5f" }}
              />
            ),
            className: "w-8",
          },
          {
            key: "nome",
            label: "Nome",
            render: (r) => (
              <button
                type="button"
                onClick={() => setDetalhe(r)}
                className="font-medium text-left text-primary hover:underline"
                title="Ver detalhes da empresa"
              >
                {r.nome}
              </button>
            ),
          },
          { key: "razao_social", label: "Razão Social" },
          { key: "cnpj", label: "CNPJ" },
          {
            key: "contas",
            label: "Contas Bancárias",
            render: (r) => {
              const ids = contasPorEmpresa.get(r.id) ?? [];
              if (!ids.length) return <span className="text-muted-foreground">—</span>;
              return (
                <div className="flex flex-wrap gap-1">
                  {ids.map((cid) => (
                    <Badge key={cid} variant="secondary" className="text-[10px]">
                      {contaMap.get(cid) ?? "?"}
                    </Badge>
                  ))}
                </div>
              );
            },
          },
        ]}
        renderForm={({ values, setValues }) => (
          <EmpresaForm
            values={values}
            setValues={setValues}
            initialContas={values.id ? contasPorEmpresa.get(values.id) ?? [] : []}
          />
        )}
        onAfterSave={async (id, values) => {
          const selecionadas: string[] = (values as any).__contas ?? [];
          // Buscar vínculos atuais
          const { data: atuais } = await supabase
            .from("empresa_contas_bancarias" as any)
            .select("id, conta_bancaria_id")
            .eq("empresa_id", id);
          const atuaisIds = new Set(((atuais ?? []) as any[]).map((r) => r.conta_bancaria_id));
          const novasIds = new Set(selecionadas);

          const paraRemover = ((atuais ?? []) as any[]).filter(
            (r) => !novasIds.has(r.conta_bancaria_id),
          );
          const paraInserir = selecionadas.filter((cid) => !atuaisIds.has(cid));

          if (paraRemover.length) {
            const ids = paraRemover.map((r) => r.id);
            const { error } = await supabase
              .from("empresa_contas_bancarias" as any)
              .delete()
              .in("id", ids);
            if (error) toast.error("Erro ao remover conta vinculada: " + error.message);
          }
          if (paraInserir.length) {
            const rows = paraInserir.map((cid) => ({ empresa_id: id, conta_bancaria_id: cid }));
            const { error } = await supabase
              .from("empresa_contas_bancarias" as any)
              .insert(rows);
            if (error) toast.error("Erro ao vincular conta: " + error.message);
          }

          // Sincroniza conta_bancaria_id "principal" (primeira selecionada) para compat
          const principal = selecionadas[0] ?? null;
          if (principal !== ((values as any).conta_bancaria_id ?? null)) {
            await supabase.from("empresas").update({ conta_bancaria_id: principal }).eq("id", id);
          }

          qc.invalidateQueries({ queryKey: ["empresa-contas-vinculos"] });
          qc.invalidateQueries({ queryKey: ["contas-bancarias-empresa"] });
          qc.invalidateQueries({ queryKey: ["empresas-export"] });
        }}
      />

      <EmpresaDetalhesDialog
        empresa={detalhe}
        onClose={() => setDetalhe(null)}
        contas={(detalhe ? contasPorEmpresa.get(detalhe.id) ?? [] : []).map(
          (cid) => contaMap.get(cid) ?? "—",
        )}
      />
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function EmpresaDetalhesDialog({
  empresa,
  contas,
  onClose,
}: {
  empresa: Empresa | null;
  contas: string[];
  onClose: () => void;
}) {
  const socios = parseSocios(empresa?.socios);
  return (
    <Dialog open={!!empresa} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block size-3 rounded-full"
              style={{ background: empresa?.cor ?? "#0d7a5f" }}
            />
            {empresa?.nome}
          </DialogTitle>
          <DialogDescription>Detalhes cadastrais da empresa.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Info label="Razão Social" value={empresa?.razao_social} />
          <Info label="CNPJ" value={empresa?.cnpj} />
          <div className="col-span-2">
            <Info label="Endereço" value={empresa?.endereco} />
          </div>
          <Info label="Status" value={empresa?.ativo ? "Ativa" : "Inativa"} />
          <div className="col-span-2">
            <Info
              label="Contas Bancárias"
              value={
                contas.length ? (
                  <div className="flex flex-wrap gap-1">
                    {contas.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                ) : null
              }
            />
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4 text-primary" /> Sócios
          </div>
          {socios.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum sócio cadastrado.</p>
          ) : (
            socios.map((s, i) => (
              <div key={i} className="rounded border border-border/50 p-2 text-sm">
                <div className="font-medium">{s.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {[s.cargo, s.telefone, s.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmpresaForm({
  values,
  setValues,
  initialContas,
}: {
  values: any;
  setValues: (v: any) => void;
  initialContas: string[];
}) {
  const { data: contas = [] } = useContasBancarias({ ativas: true });
  const [selecionadas, setSelecionadas] = useState<string[]>(
    (values.__contas as string[] | undefined) ?? initialContas,
  );
  const [addingId, setAddingId] = useState<string>("");

  // Hidrata no primeiro render por empresa
  useEffect(() => {
    if (!values.__contas) {
      setValues({ ...values, __contas: initialContas });
      setSelecionadas(initialContas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.id]);

  const sync = (next: string[]) => {
    setSelecionadas(next);
    setValues({ ...values, __contas: next });
  };

  const disponiveis = contas.filter((c) => !selecionadas.includes(c.id));

  return (
    <div className="grid grid-cols-2 gap-4">
      <TextField
        label="Nome"
        value={values.nome}
        onChange={(v) => setValues({ ...values, nome: v })}
        required
      />
      <TextField
        label="Cor"
        value={values.cor ?? "#0d7a5f"}
        onChange={(v) => setValues({ ...values, cor: v })}
        type="color"
      />
      <TextField
        label="Razão Social"
        value={values.razao_social}
        onChange={(v) => setValues({ ...values, razao_social: v })}
      />
      <TextField
        label="CNPJ"
        value={values.cnpj}
        onChange={(v) => setValues({ ...values, cnpj: v })}
      />

      <div className="col-span-2">
        <TextAreaField
          label="Endereço"
          value={values.endereco}
          onChange={(v) => setValues({ ...values, endereco: v })}
        />
      </div>

      <SociosBlock values={values} setValues={setValues} />



      <div className="col-span-2 space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Landmark className="size-4 text-primary" />
          Contas Bancárias Vinculadas
        </div>
        <p className="text-xs text-muted-foreground">
          Selecione contas já cadastradas no módulo Bancos. Uma empresa pode ter várias contas
          vinculadas.
        </p>

        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {selecionadas.length === 0 && (
            <span className="text-xs text-muted-foreground italic">Nenhuma conta vinculada</span>
          )}
          {selecionadas.map((cid) => {
            const c = contas.find((x) => x.id === cid);
            return (
              <Badge key={cid} variant="secondary" className="gap-1 pr-1 py-1">
                <span className="text-xs">{c ? contaLabel(c) : cid}</span>
                <button
                  type="button"
                  className="ml-1 rounded hover:bg-destructive/20 p-0.5"
                  onClick={() => sync(selecionadas.filter((x) => x !== cid))}
                  aria-label="Remover conta"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SelectField
              label="Adicionar conta"
              value={addingId || "__none__"}
              onChange={(v) => setAddingId(v === "__none__" ? "" : v)}
              options={[
                { value: "__none__", label: disponiveis.length ? "Selecione…" : "Nenhuma conta disponível" },
                ...disponiveis.map((c) => ({ value: c.id, label: contaLabel(c) })),
              ]}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!addingId}
            onClick={() => {
              if (!addingId) return;
              sync([...selecionadas, addingId]);
              setAddingId("");
            }}
          >
            <Plus className="size-4 mr-1" /> Vincular
          </Button>
        </div>
      </div>
    </div>
  );
}

function SociosBlock({ values, setValues }: { values: any; setValues: (v: any) => void }) {
  const socios = parseSocios(values.socios);

  const update = (next: Socio[]) => setValues({ ...values, socios: next });
  const setField = (i: number, key: keyof Socio, v: string) =>
    update(socios.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)));

  return (
    <div className="col-span-2 space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-primary" /> Sócios
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={socios.length >= MAX_SOCIOS}
          onClick={() => update([...socios, { nome: "", cargo: "", telefone: "", email: "" }])}
        >
          <Plus className="size-4 mr-1" /> Adicionar sócio
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Até {MAX_SOCIOS} sócios por empresa.</p>

      {socios.length === 0 && (
        <span className="text-xs text-muted-foreground italic">Nenhum sócio cadastrado</span>
      )}

      {socios.map((s, i) => (
        <div key={i} className="rounded border border-border/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Sócio {i + 1}</span>
            <button
              type="button"
              className="rounded p-1 hover:bg-destructive/20"
              aria-label="Remover sócio"
              onClick={() => update(socios.filter((_, idx) => idx !== i))}
            >
              <X className="size-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Nome" value={s.nome ?? ""} onChange={(v) => setField(i, "nome", v)} />
            <TextField label="Cargo" value={s.cargo ?? ""} onChange={(v) => setField(i, "cargo", v)} />
            <TextField label="Telefone" value={s.telefone ?? ""} onChange={(v) => setField(i, "telefone", v)} />
            <TextField label="E-mail" value={s.email ?? ""} onChange={(v) => setField(i, "email", v)} />
          </div>
        </div>
      ))}
    </div>
  );
}
