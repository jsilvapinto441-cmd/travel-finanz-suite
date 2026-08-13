import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Backup & Restauração — todo o processamento acontece no servidor.
 * O tenant é SEMPRE o `owner_id` derivado do token (context.userId),
 * nunca um valor enviado pelo frontend.
 */

// Ordem de dependência (pais → filhos). Usada para inserir; invertida para apagar.
const TABLES = [
  "profiles",
  "contas_bancarias",
  "empresas",
  "empresa_contas_bancarias",
  "missoes",
  "fornecedores",
  "funcionarios",
  "prestadores_mei",
  "consolidadoras",
  "contratos",
  "recebiveis",
  "despesas",
  "registros_pagamento",
  "movimentacoes_financeiras",
  "anexos",
] as const;

type TableName = (typeof TABLES)[number];

// Tabelas com auto-referência (parent_id) — inserir pais antes dos filhos.
const SELF_REF: Partial<Record<TableName, string>> = {
  despesas: "parent_id",
  recebiveis: "parent_id",
};

const FORMAT_VERSION = 2;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // arquivos maiores ficam registrados, mas sem conteúdo
const MAX_TOTAL_FILE_BYTES = 120 * 1024 * 1024;

type Row = Record<string, unknown>;

type BackupPayload = {
  meta: {
    formato: number;
    app: string;
    owner_id: string;
    gerado_em: string;
    total_registros: number;
    total_arquivos: number;
  };
  tabelas: Record<string, Row[]>;
  arquivos: { bucket: string; path: string; nome: string; conteudo_b64: string | null; tamanho: number }[];
};

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(
  userId: string,
  acao: string,
  entidade_id: string | null,
  detalhes: Record<string, unknown>,
) {
  try {
    const db = await admin();
    await db.from("activity_logs").insert({
      user_id: userId,
      acao,
      entidade: "backup",
      entidade_id,
      detalhes: detalhes as never,
    });
  } catch {
    /* auditoria nunca quebra o fluxo */
  }
}

/** Coleta todos os dados + arquivos do tenant e grava um JSON no bucket privado. */
async function gerarBackup(ownerId: string, tipo: "manual" | "seguranca" | "automatico") {
  const db = await admin();

  const { data: registro, error: regErr } = await db
    .from("backups")
    .insert({ owner_id: ownerId, criado_por: ownerId, tipo, status: "processando" })
    .select()
    .single();
  if (regErr) throw new Error(regErr.message);

  try {
    const tabelas: Record<string, Row[]> = {};
    const contagem: Record<string, number> = {};
    let totalRegistros = 0;

    for (const t of TABLES) {
      const col = t === "profiles" ? "id" : "owner_id";
      const { data, error } = await db.from(t).select("*").eq(col, ownerId);
      if (error) throw new Error(`${t}: ${error.message}`);
      tabelas[t] = (data ?? []) as Row[];
      contagem[t] = tabelas[t].length;
      totalRegistros += tabelas[t].length;
    }

    // Arquivos: anexos do tenant + avatar do perfil
    const arquivos: BackupPayload["arquivos"] = [];
    let totalBytesArquivos = 0;

    const alvos: { bucket: string; path: string; nome: string }[] = [];
    for (const a of tabelas["anexos"] ?? []) {
      alvos.push({ bucket: "anexos", path: String(a["path"]), nome: String(a["nome"] ?? "arquivo") });
    }
    const avatar = (tabelas["profiles"]?.[0]?.["avatar_url"] ?? null) as string | null;
    if (avatar && !avatar.startsWith("http")) {
      alvos.push({ bucket: "avatars", path: avatar, nome: "avatar" });
    }

    for (const alvo of alvos) {
      try {
        const { data: blob, error } = await db.storage.from(alvo.bucket).download(alvo.path);
        if (error || !blob) {
          arquivos.push({ ...alvo, conteudo_b64: null, tamanho: 0 });
          continue;
        }
        const buf = await blob.arrayBuffer();
        const cabe = buf.byteLength <= MAX_FILE_BYTES && totalBytesArquivos + buf.byteLength <= MAX_TOTAL_FILE_BYTES;
        if (cabe) totalBytesArquivos += buf.byteLength;
        arquivos.push({
          ...alvo,
          conteudo_b64: cabe ? toBase64(buf) : null,
          tamanho: buf.byteLength,
        });
      } catch {
        arquivos.push({ ...alvo, conteudo_b64: null, tamanho: 0 });
      }
    }

    const payload: BackupPayload = {
      meta: {
        formato: FORMAT_VERSION,
        app: "rotas",
        owner_id: ownerId,
        gerado_em: new Date().toISOString(),
        total_registros: totalRegistros,
        total_arquivos: arquivos.length,
      },
      tabelas,
      arquivos,
    };

    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    const path = `${ownerId}/${registro.id}.json`;

    const { error: upErr } = await db.storage
      .from("backups")
      .upload(path, bytes, { contentType: "application/json", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: final, error: updErr } = await db
      .from("backups")
      .update({
        status: "concluido",
        path,
        tamanho_bytes: bytes.byteLength,
        total_registros: totalRegistros,
        total_arquivos: arquivos.length,
        tabelas: contagem as never,
      })
      .eq("id", registro.id)
      .select()
      .single();
    if (updErr) throw new Error(updErr.message);

    await log(ownerId, "backup_create", registro.id, { tipo, totalRegistros, arquivos: arquivos.length });
    return final;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha desconhecida";
    await db.from("backups").update({ status: "erro", erro: msg }).eq("id", registro.id);
    await log(ownerId, "backup_error", registro.id, { erro: msg });
    throw new Error(msg);
  }
}

export const criarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await gerarBackup(context.userId, "manual");
  });

export const listarBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("backups")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const baixarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: b } = await db
      .from("backups")
      .select("id, owner_id, path, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!b || b.owner_id !== context.userId) throw new Error("Backup não encontrado.");
    if (!b.path || b.status !== "concluido") throw new Error("Backup indisponível para download.");

    const { data: signed, error } = await db.storage.from("backups").createSignedUrl(b.path, 120, {
      download: `rotas-backup-${b.id}.json`,
    });
    if (error || !signed) throw new Error("Falha ao gerar link seguro.");
    await log(context.userId, "backup_download", b.id, {});
    return { url: signed.signedUrl };
  });

export const excluirBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: b } = await db
      .from("backups")
      .select("id, owner_id, path")
      .eq("id", data.id)
      .maybeSingle();
    if (!b || b.owner_id !== context.userId) throw new Error("Backup não encontrado.");
    if (b.path) await db.storage.from("backups").remove([b.path]);
    const { error } = await db.from("backups").delete().eq("id", b.id);
    if (error) throw new Error(error.message);
    await log(context.userId, "backup_delete", b.id, {});
    return { ok: true };
  });

function validarPayload(raw: unknown, ownerId: string): BackupPayload {
  if (!raw || typeof raw !== "object") throw new Error("Arquivo de backup inválido.");
  const p = raw as BackupPayload;
  if (!p.meta || p.meta.app !== "rotas") throw new Error("Backup não pertence ao sistema Rotas.");
  if (typeof p.meta.formato !== "number" || p.meta.formato > FORMAT_VERSION) {
    throw new Error("Versão de backup incompatível com esta aplicação.");
  }
  if (p.meta.owner_id !== ownerId) throw new Error("Este backup pertence a outra conta.");
  if (!p.tabelas || typeof p.tabelas !== "object") throw new Error("Backup sem dados.");
  for (const t of TABLES) {
    if (p.tabelas[t] && !Array.isArray(p.tabelas[t])) throw new Error(`Dados corrompidos em ${t}.`);
  }
  if (p.arquivos && !Array.isArray(p.arquivos)) throw new Error("Lista de arquivos corrompida.");
  return p;
}

export const restaurarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), confirmacao: z.literal("RESTAURAR") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ownerId = context.userId;
    const db = await admin();

    const { data: b } = await db
      .from("backups")
      .select("id, owner_id, path, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!b || b.owner_id !== ownerId) throw new Error("Backup não encontrado.");
    if (!b.path || b.status !== "concluido") throw new Error("Backup indisponível para restauração.");

    const { data: blob, error: dlErr } = await db.storage.from("backups").download(b.path);
    if (dlErr || !blob) throw new Error("Não foi possível ler o arquivo do backup.");
    const payload = validarPayload(JSON.parse(await blob.text()), ownerId);

    // Backup de segurança do estado atual ANTES de qualquer alteração
    const seguranca = await gerarBackup(ownerId, "seguranca");

    const restaurado: Record<string, number> = {};

    // 1) Limpa dados atuais do tenant (filhos → pais). `profiles` nunca é apagado.
    for (const t of [...TABLES].reverse()) {
      if (t === "profiles") continue;
      const { error } = await db.from(t).delete().eq("owner_id", ownerId);
      if (error) throw new Error(`Falha ao limpar ${t}: ${error.message}`);
    }

    // 2) Reinsere na ordem de dependência
    for (const t of TABLES) {
      const rows = (payload.tabelas[t] ?? []) as Row[];
      if (!rows.length) continue;

      if (t === "profiles") {
        const perfil = rows[0];
        if (perfil) {
          const { id, created_at, ...resto } = perfil as Row & { id?: string; created_at?: string };
          void created_at;
          await db.from("profiles").update(resto as never).eq("id", ownerId);
          restaurado[t] = 1;
        }
        continue;
      }

      const selfRef = SELF_REF[t];
      const lotes = selfRef
        ? [rows.filter((r) => !r[selfRef]), rows.filter((r) => !!r[selfRef])]
        : [rows];

      for (const lote of lotes) {
        for (let i = 0; i < lote.length; i += 200) {
          const chunk = lote.slice(i, i + 200).map((r) => ({ ...r, owner_id: ownerId }));
          const { error } = await db.from(t).upsert(chunk as never, { onConflict: "id" });
          if (error) throw new Error(`Falha ao restaurar ${t}: ${error.message}`);
        }
      }

      // Remove registros criados por gatilhos que não existem no backup
      const ids = rows.map((r) => String(r["id"]));
      const { error: pruneErr } = await db
        .from(t)
        .delete()
        .eq("owner_id", ownerId)
        .not("id", "in", `(${ids.join(",")})`);
      if (pruneErr) throw new Error(`Falha ao normalizar ${t}: ${pruneErr.message}`);

      restaurado[t] = rows.length;
    }

    // 3) Arquivos
    let arquivosRestaurados = 0;
    for (const f of payload.arquivos ?? []) {
      if (!f.conteudo_b64) continue;
      try {
        const bytes = fromBase64(f.conteudo_b64);
        const { error } = await db.storage
          .from(f.bucket)
          .upload(f.path, bytes, { upsert: true, contentType: "application/octet-stream" });
        if (!error) arquivosRestaurados++;
      } catch {
        /* arquivo individual não interrompe a restauração */
      }
    }

    await db.from("backups").update({ restaurado_em: new Date().toISOString() }).eq("id", b.id);
    await log(ownerId, "backup_restore", b.id, {
      backup_seguranca: seguranca?.id ?? null,
      registros: restaurado,
      arquivos: arquivosRestaurados,
    });

    return {
      ok: true,
      backupSegurancaId: seguranca?.id ?? null,
      registros: restaurado,
      arquivos: arquivosRestaurados,
    };
  });

/** Agendamento (estrutura pronta para execução automática diária/semanal). */
export const obterAgendamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("backup_schedules").select("*").maybeSingle();
    return data ?? null;
  });

export const salvarAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ativo: z.boolean(),
        frequencia: z.enum(["diario", "semanal"]),
        hora_utc: z.number().int().min(0).max(23),
        reter_ultimos: z.number().int().min(1).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const proxima = new Date();
    proxima.setUTCHours(data.hora_utc, 0, 0, 0);
    if (proxima.getTime() <= Date.now()) {
      proxima.setUTCDate(proxima.getUTCDate() + (data.frequencia === "diario" ? 1 : 7));
    }
    const { data: row, error } = await context.supabase
      .from("backup_schedules")
      .upsert(
        {
          owner_id: context.userId,
          ativo: data.ativo,
          frequencia: data.frequencia,
          hora_utc: data.hora_utc,
          reter_ultimos: data.reter_ultimos,
          proxima_execucao: data.ativo ? proxima.toISOString() : null,
        },
        { onConflict: "owner_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
