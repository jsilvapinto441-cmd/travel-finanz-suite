import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fetchAllRows } from "@/lib/fetch-all";

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
  // Quando true, o usuário confirmou explicitamente a importação mesmo com duplicidades.
  confirmDuplicates: z.boolean().optional(),
});

type Duplicate = {
  index: number;        // índice no array items enviado
  key: string;          // chave que casou
  existingId: string;   // id do registro já existente no banco
  reason: string;       // descrição legível
};

function normKey(...parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => (p === null || p === undefined ? "" : String(p).trim().toLowerCase()))
    .join("|");
}

/**
 * Detecta duplicidades comparando os itens a serem importados com registros
 * já existentes no banco (escopo do usuário via RLS). Retorna a lista de
 * duplicatas prováveis por índice do array `items`.
 */
async function detectDuplicates(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  module: ImportModule,
  items: Record<string, unknown>[],
  empresa_id: string | null,
): Promise<Duplicate[]> {
  const dups: Duplicate[] = [];

  switch (module) {
    case "despesas": {
      const existing = await fetchAllRows<Record<string, unknown>>((from, to) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("despesas")
          .select("id, descricao, valor, data_vencimento, empresa_id")
          .order("id", { ascending: true })
          .range(from, to),
      );
      const map = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        map.set(
          normKey(r.descricao as string, Number(r.valor).toFixed(2), r.data_vencimento as string, r.empresa_id as string),
          r.id as string,
        );
      }
      items.forEach((i, idx) => {
        const k = normKey(str(i.descricao), num(i.valor).toFixed(2), date(i.data_vencimento), empresa_id);
        const id = map.get(k);
        if (id) dups.push({ index: idx, key: k, existingId: id, reason: "Mesma descrição, valor e vencimento" });
      });
      break;
    }
    case "recebiveis": {
      const existing = await fetchAllRows<Record<string, unknown>>((from, to) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("recebiveis")
          .select("id, pagador, valor_total, data_vencimento, empresa_id")
          .order("id", { ascending: true })
          .range(from, to),
      );
      const map = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        map.set(
          normKey(r.pagador as string, Number(r.valor_total).toFixed(2), r.data_vencimento as string, r.empresa_id as string),
          r.id as string,
        );
      }
      items.forEach((i, idx) => {
        const valor = num(i.valor_total ?? i.valor);
        const k = normKey(str(i.pagador), valor.toFixed(2), date(i.data_vencimento), empresa_id);
        const id = map.get(k);
        if (id) dups.push({ index: idx, key: k, existingId: id, reason: "Mesmo pagador, valor e vencimento" });
      });
      break;
    }
    case "fornecedores": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("fornecedores")
        .select("id, nome, cnpj");
      const byCnpj = new Map<string, string>();
      const byNome = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        if (r.cnpj) byCnpj.set(normKey(r.cnpj as string), r.id as string);
        if (r.nome) byNome.set(normKey(r.nome as string), r.id as string);
      }
      items.forEach((i, idx) => {
        const cnpj = str(i.cnpj);
        const nome = str(i.nome);
        const id = (cnpj && byCnpj.get(normKey(cnpj))) || (nome && byNome.get(normKey(nome)));
        if (id) dups.push({ index: idx, key: normKey(cnpj, nome), existingId: id, reason: cnpj ? "CNPJ já cadastrado" : "Nome já cadastrado" });
      });
      break;
    }
    case "funcionarios": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("funcionarios")
        .select("id, nome, cpf");
      const byCpf = new Map<string, string>();
      const byNome = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        if (r.cpf) byCpf.set(normKey(r.cpf as string), r.id as string);
        if (r.nome) byNome.set(normKey(r.nome as string), r.id as string);
      }
      items.forEach((i, idx) => {
        const cpf = str(i.cpf);
        const nome = str(i.nome);
        const id = (cpf && byCpf.get(normKey(cpf))) || (nome && byNome.get(normKey(nome)));
        if (id) dups.push({ index: idx, key: normKey(cpf, nome), existingId: id, reason: cpf ? "CPF já cadastrado" : "Nome já cadastrado" });
      });
      break;
    }
    case "empresas": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("empresas")
        .select("id, nome, cnpj");
      const byCnpj = new Map<string, string>();
      const byNome = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        if (r.cnpj) byCnpj.set(normKey(r.cnpj as string), r.id as string);
        if (r.nome) byNome.set(normKey(r.nome as string), r.id as string);
      }
      items.forEach((i, idx) => {
        const cnpj = str(i.cnpj);
        const nome = str(i.nome);
        const id = (cnpj && byCnpj.get(normKey(cnpj))) || (nome && byNome.get(normKey(nome)));
        if (id) dups.push({ index: idx, key: normKey(cnpj, nome), existingId: id, reason: cnpj ? "CNPJ já cadastrado" : "Nome já cadastrado" });
      });
      break;
    }
    case "bancos": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("contas_bancarias")
        .select("id, banco, agencia, conta");
      const map = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        map.set(normKey(r.banco as string, r.agencia as string, r.conta as string), r.id as string);
      }
      items.forEach((i, idx) => {
        const k = normKey(str(i.banco), str(i.agencia), str(i.conta));
        const id = map.get(k);
        if (id) dups.push({ index: idx, key: k, existingId: id, reason: "Banco/agência/conta já cadastrado" });
      });
      break;
    }
    case "missoes": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("missoes")
        .select("id, nome");
      const map = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        if (r.nome) map.set(normKey(r.nome as string), r.id as string);
      }
      items.forEach((i, idx) => {
        const k = normKey(str(i.nome));
        const id = map.get(k);
        if (id) dups.push({ index: idx, key: k, existingId: id, reason: "Missão com mesmo nome" });
      });
      break;
    }
    case "contratos": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("contratos")
        .select("id, cliente, valor, data_inicio, empresa_id");
      const map = new Map<string, string>();
      for (const r of (existing ?? []) as Array<Record<string, unknown>>) {
        map.set(
          normKey(r.cliente as string, Number(r.valor).toFixed(2), r.data_inicio as string, r.empresa_id as string),
          r.id as string,
        );
      }
      items.forEach((i, idx) => {
        const k = normKey(str(i.cliente), num(i.valor).toFixed(2), date(i.data_inicio), empresa_id);
        const id = map.get(k);
        if (id) dups.push({ index: idx, key: k, existingId: id, reason: "Mesmo cliente, valor e data inicial" });
      });
      break;
    }
  }

  return dups;
}

/**
 * Endpoint separado para o front-end conferir duplicidades ANTES de importar,
 * usado pela prévia editável.
 */
export const checkDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        module: z.enum(IMPORT_MODULES),
        empresa_id: z.string().uuid().nullable().optional(),
        items: z.array(z.record(z.string(), z.unknown())).min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const duplicates = await detectDuplicates(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context.supabase as any,
      data.module,
      data.items,
      data.empresa_id ?? null,
    );
    return { duplicates };
  });

export const executeImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportPayload.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const empresa_id = data.empresa_id ?? null;
    const errors: string[] = [];
    let inserted = 0;

    // 1) Detecção de duplicidades — bloqueia se não confirmadas
    const duplicates = await detectDuplicates(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      data.module,
      data.items,
      empresa_id,
    );
    if (duplicates.length > 0 && !data.confirmDuplicates) {
      return {
        inserted: 0,
        errors: [],
        module: data.module,
        needsConfirmation: true as const,
        duplicates,
        message: `Foram encontrados ${duplicates.length} possíveis duplicados. Revise e confirme para importar mesmo assim.`,
      };
    }

    // Se o usuário confirmou, ainda assim removemos os índices duplicados
    // para não gravar em cima — a política é NUNCA sobrescrever automaticamente.
    // O usuário precisa remover manualmente as linhas na prévia se quiser
    // reimportar. Aqui apenas ignoramos os índices duplicados por segurança.
    const dupIdx = new Set(duplicates.map((d) => d.index));
    const items = data.confirmDuplicates
      ? data.items // confiança total — usuário assumiu o risco
      : data.items.filter((_, idx) => !dupIdx.has(idx));

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
        const rows = items
          .map((i) => ({
            empresa_id,
            descricao: str(i.descricao) ?? "Lançamento",
            valor: num(i.valor),
            categoria: toCategoriaDespesa(i.categoria),
            data_vencimento: date(i.data_vencimento),
            frequencia: (str(i.frequencia) as string) ?? "unico",
            parcelas: Math.max(1, Math.floor(num(i.parcelas, 1))),
            observacoes: str(i.observacoes),
          }))
          .filter((r) => r.valor > 0);
        // Inserção linha-a-linha para que os triggers de geração de parcelas,
        // status, movimentações e sincronização de valor_pago rodem por registro
        // (mesmo caminho do formulário manual).
        for (const row of rows) await insertMany("despesas", [row]);
        break;
      }
      case "recebiveis": {
        const rows = items.map((i) => {
          const valor = num(i.valor_total ?? i.valor);
          const parcelas = Math.max(1, Math.floor(num(i.parcelas, 1)));
          return {
            empresa_id,
            pagador: str(i.pagador) ?? "Cliente",
            valor_total: valor,
            valor_parcela: parcelas > 1 ? Math.round((valor / parcelas) * 100) / 100 : valor,
            parcelas,
            frequencia: (str(i.frequencia) as string) ?? "unico",
            data_vencimento: date(i.data_vencimento),
            categoria: str(i.categoria),
            numero_fatura: str(i.numero_fatura),
            observacoes: str(i.observacoes),
          };
        }).filter((r) => r.valor_total > 0);
        for (const row of rows) await insertMany("recebiveis", [row]);
        break;
      }
      case "fornecedores": {
        const rows = items
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
        const rows = items
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
        const rows = items
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
        const rows = items
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
        const rows = items
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
        const rows = items
          .map((i) => ({
            empresa_id,
            cliente: str(i.cliente) ?? "",
            valor: num(i.valor),
            valor_entrada: num(i.valor_entrada, 0),
            parcelas: Math.max(1, Math.floor(num(i.parcelas, 1))),
            frequencia: (str(i.frequencia) as string) ?? "mensal",
            dia_vencimento: Math.max(1, Math.min(31, Math.floor(num(i.dia_vencimento, 10)))),
            data_inicio: date(i.data_inicio),
            destino: str(i.destino),
            observacoes: str(i.observacoes),
          }))
          .filter((r) => r.cliente);
        // Contratos disparam geração automática de recebíveis via trigger.
        for (const row of rows) await insertMany("contratos", [row]);
        break;
      }
    }


    return {
      inserted,
      errors,
      module: data.module,
      duplicatesSkipped: data.confirmDuplicates ? 0 : duplicates.length,
      duplicates: data.confirmDuplicates ? [] : duplicates,
    };
  });
