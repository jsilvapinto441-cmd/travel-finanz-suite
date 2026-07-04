import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Enum categoria_despesa do banco
const CATEGORIAS_DESPESA = [
  "impostos",
  "funcionarios",
  "aluguel",
  "luz",
  "condominio",
  "telefone",
  "parcelamento_simples",
  "avulso",
  "fornecedor",
  "outros",
] as const;
type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

// ----- Threads CRUD -----
export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_threads")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ title: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_threads")
      .insert({ title: data.title ?? "Nova conversa" })
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_threads")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select("id, role, content, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listEmpresasQuick = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("empresas")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ----- Módulos suportados pelo Assistente -----
export const IMPORT_MODULES = [
  "despesas",
  "recebiveis",
  "fornecedores",
  "funcionarios",
  "empresas",
  "bancos",
  "missoes",
  "contratos",
] as const;
export type ImportModule = (typeof IMPORT_MODULES)[number];

function toCategoriaDespesa(v: unknown): CategoriaDespesa {
  if (typeof v !== "string") return "outros";
  const norm = v.toLowerCase().trim();
  return (CATEGORIAS_DESPESA as readonly string[]).includes(norm)
    ? (norm as CategoriaDespesa)
    : "outros";
}
function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function date(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  // aceita YYYY-MM-DD, DD/MM/YYYY etc.
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
  if (iso) return iso[0];
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Aceita items livres — validação por módulo é feita no handler.
const ImportPayload = z.object({
  module: z.enum(IMPORT_MODULES),
  empresa_id: z.string().uuid().nullable().optional(),
  items: z.array(z.record(z.string(), z.unknown())).min(1),
});

export const executeImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportPayload.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const empresa_id = data.empresa_id ?? null;
    const errors: string[] = [];
    let inserted = 0;

    async function insertMany(table: string, rows: Record<string, unknown>[]) {
      if (!rows.length) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ins, error } = await (supabase.from(table as any) as any)
        .insert(rows)
        .select("id");
      if (error) {
        errors.push(`${table}: ${error.message}`);
        return;
      }
      inserted += ins?.length ?? 0;
    }

    switch (data.module) {
      case "despesas": {
        const rows = data.items
          .map((i) => ({
            empresa_id,
            descricao: str(i.descricao) ?? "Lançamento",
            valor: num(i.valor),
            categoria: toCategoriaDespesa(i.categoria),
            data_vencimento: date(i.data_vencimento),
            observacoes: str(i.observacoes),
          }))
          .filter((r) => r.valor > 0);
        await insertMany("despesas", rows);
        break;
      }
      case "recebiveis": {
        const rows = data.items.map((i) => {
          const valor = num(i.valor_total ?? i.valor);
          const parcelas = Math.max(1, Math.floor(num(i.parcelas, 1)));
          return {
            empresa_id,
            pagador: str(i.pagador) ?? "Cliente",
            valor_total: valor,
            valor_parcela: parcelas > 1 ? Math.round((valor / parcelas) * 100) / 100 : valor,
            parcelas,
            data_vencimento: date(i.data_vencimento),
            categoria: str(i.categoria),
            observacoes: str(i.observacoes),
          };
        }).filter((r) => r.valor_total > 0);
        await insertMany("recebiveis", rows);
        break;
      }
      case "fornecedores": {
        const rows = data.items
          .map((i) => ({
            nome: str(i.nome) ?? "",
            cnpj: str(i.cnpj),
            email: str(i.email),
            telefone: str(i.telefone),
            responsavel: str(i.responsavel),
            observacoes: str(i.observacoes),
          }))
          .filter((r) => r.nome);
        await insertMany("fornecedores", rows);
        break;
      }
      case "funcionarios": {
        const rows = data.items
          .map((i) => ({
            empresa_id,
            nome: str(i.nome) ?? "",
            cargo: str(i.cargo),
            salario: num(i.salario),
            data_admissao: date(i.data_admissao),
          }))
          .filter((r) => r.nome);
        await insertMany("funcionarios", rows);
        break;
      }
      case "empresas": {
        const rows = data.items
          .map((i) => ({
            nome: str(i.nome) ?? "",
            cnpj: str(i.cnpj),
            razao_social: str(i.razao_social),
          }))
          .filter((r) => r.nome);
        await insertMany("empresas", rows);
        break;
      }
      case "bancos": {
        const rows = data.items
          .map((i) => ({
            banco: str(i.banco) ?? "",
            agencia: str(i.agencia),
            conta: str(i.conta),
            digito: str(i.digito),
            tipo: str(i.tipo) ?? "corrente",
            titular: str(i.titular),
            documento: str(i.documento),
            chave_pix: str(i.chave_pix),
            saldo_inicial: num(i.saldo_inicial, 0),
          }))
          .filter((r) => r.banco);
        await insertMany("contas_bancarias", rows);
        break;
      }
      case "missoes": {
        const rows = data.items
          .map((i) => ({
            nome: str(i.nome) ?? "",
            descricao: str(i.descricao),
            observacoes: str(i.observacoes),
          }))
          .filter((r) => r.nome);
        await insertMany("missoes", rows);
        break;
      }
      case "contratos": {
        const rows = data.items
          .map((i) => ({
            empresa_id,
            cliente: str(i.cliente) ?? "",
            valor: num(i.valor),
            valor_entrada: num(i.valor_entrada, 0),
            parcelas: Math.max(1, Math.floor(num(i.parcelas, 1))),
            dia_vencimento: Math.max(1, Math.min(31, Math.floor(num(i.dia_vencimento, 10)))),
            data_inicio: date(i.data_inicio),
            destino: str(i.destino),
            observacoes: str(i.observacoes),
          }))
          .filter((r) => r.cliente);
        await insertMany("contratos", rows);
        break;
      }
    }

    return { inserted, errors, module: data.module };
  });
