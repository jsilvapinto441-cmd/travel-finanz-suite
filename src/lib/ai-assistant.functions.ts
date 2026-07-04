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
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), title: z.string().min(1) }).parse(i))
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

const ItemSchema = z.object({
  tipo: z.enum(["despesa", "receita"]),
  descricao: z.string().min(1),
  valor: z.number().nonnegative(),
  data_vencimento: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  pagador_ou_fornecedor: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

function toCategoriaDespesa(v: string | null | undefined): CategoriaDespesa {
  if (!v) return "outros";
  const norm = v.toLowerCase().trim();
  return (CATEGORIAS_DESPESA as readonly string[]).includes(norm)
    ? (norm as CategoriaDespesa)
    : "outros";
}

export const executeImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        empresa_id: z.string().uuid().nullable().optional(),
        items: z.array(ItemSchema).min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const despesas = data.items
      .filter((i) => i.tipo === "despesa")
      .map((i) => ({
        empresa_id: data.empresa_id ?? null,
        descricao: i.descricao,
        valor: i.valor,
        categoria: toCategoriaDespesa(i.categoria ?? null),
        data_vencimento: i.data_vencimento ?? null,
        observacoes: i.observacoes ?? null,
      }));
    const recebiveis = data.items
      .filter((i) => i.tipo === "receita")
      .map((i) => ({
        empresa_id: data.empresa_id ?? null,
        pagador: (i.pagador_ou_fornecedor ?? "").trim() || i.descricao,
        valor_total: i.valor,
        valor_parcela: i.valor,
        parcelas: 1,
        data_vencimento: i.data_vencimento ?? null,
        categoria: i.categoria ?? null,
        observacoes: i.observacoes ?? null,
      }));

    let despesasCount = 0;
    let recebiveisCount = 0;
    if (despesas.length) {
      const { data: ins, error } = await context.supabase
        .from("despesas")
        .insert(despesas)
        .select("id");
      if (error) throw new Error(`Despesas: ${error.message}`);
      despesasCount = ins?.length ?? 0;
    }
    if (recebiveis.length) {
      const { data: ins, error } = await context.supabase
        .from("recebiveis")
        .insert(recebiveis)
        .select("id");
      if (error) throw new Error(`Recebíveis: ${error.message}`);
      recebiveisCount = ins?.length ?? 0;
    }
    return { despesas: despesasCount, recebiveis: recebiveisCount };
  });

