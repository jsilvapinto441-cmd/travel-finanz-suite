/**
 * Núcleo de Backup & Restauração (somente servidor).
 * Todo o processamento acontece aqui; os server functions e o worker (cron)
 * apenas orquestram. O tenant é SEMPRE o `owner_id` recebido do chamador
 * autenticado — nunca um valor vindo do frontend.
 */

// Ordem de dependência (pais → filhos). Usada para inserir; invertida para apagar.
export const TABLES = [
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

export type TableName = (typeof TABLES)[number];

export const TABLE_LABEL: Record<string, string> = {
  profiles: "Perfil",
  contas_bancarias: "Contas bancárias",
  empresas: "Empresas",
  empresa_contas_bancarias: "Vínculos empresa/conta",
  missoes: "Missões",
  fornecedores: "Fornecedores",
  funcionarios: "Funcionários",
  prestadores_mei: "Prestadores MEI",
  consolidadoras: "Consolidadoras",
  contratos: "Contratos",
  recebiveis: "Recebíveis",
  despesas: "Despesas",
  registros_pagamento: "Registros de pagamento",
  movimentacoes_financeiras: "Movimentações financeiras",
  anexos: "Anexos",
};

// Tabelas com auto-referência (parent_id) — inserir pais antes dos filhos.
const SELF_REF: Partial<Record<TableName, string>> = {
  despesas: "parent_id",
  recebiveis: "parent_id",
};

// Colunas geradas pelo banco — não podem ser enviadas em INSERT/UPSERT.
const GENERATED_COLS: Partial<Record<TableName, string[]>> = {
  contratos: ["valor_saldo"],
};



const FORMAT_VERSION = 2;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 120 * 1024 * 1024;

type Row = Record<string, unknown>;

export type BackupPayload = {
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

export type JobLog = { t: string; nivel: "info" | "aviso" | "erro"; msg: string };

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function log(
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

/* ------------------------------------------------------------------ */
/* Jobs (progresso em tempo real)                                      */
/* ------------------------------------------------------------------ */

export type Job = { id: string; ownerId: string; logs: JobLog[] };

export async function criarJob(
  ownerId: string,
  tipo: "backup" | "restauracao" | "validacao",
  backupId: string | null,
  etapa: string,
): Promise<Job> {
  const db = await admin();
  const { data, error } = await db
    .from("backup_jobs")
    .insert({ owner_id: ownerId, tipo, backup_id: backupId, etapa, progresso: 0, status: "processando" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, ownerId, logs: [] };
}

export async function passo(job: Job | null, progresso: number, etapa: string, nivel: JobLog["nivel"] = "info") {
  if (!job) return;
  job.logs.push({ t: new Date().toISOString(), nivel, msg: etapa });
  if (job.logs.length > 400) job.logs.splice(0, job.logs.length - 400);
  try {
    const db = await admin();
    await db
      .from("backup_jobs")
      .update({ progresso: Math.max(0, Math.min(100, Math.round(progresso))), etapa, logs: job.logs as never })
      .eq("id", job.id);
  } catch {
    /* progresso é informativo */
  }
}

export async function finalizarJob(
  job: Job | null,
  status: "concluido" | "erro",
  extra: { erro?: string; resultado?: Record<string, unknown>; backupId?: string | null } = {},
) {
  if (!job) return;
  try {
    const db = await admin();
    await db
      .from("backup_jobs")
      .update({
        status,
        progresso: status === "concluido" ? 100 : undefined,
        erro: extra.erro ?? null,
        resultado: (extra.resultado ?? null) as never,
        ...(extra.backupId ? { backup_id: extra.backupId } : {}),
        logs: job.logs as never,
      })
      .eq("id", job.id);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Geração de backup                                                   */
/* ------------------------------------------------------------------ */

export async function gerarBackup(
  ownerId: string,
  tipo: "manual" | "seguranca" | "automatico",
  job: Job | null = null,
  faixa: [number, number] = [0, 100],
) {
  const db = await admin();
  const [ini, fim] = faixa;
  const pct = (f: number) => ini + (fim - ini) * f;

  const { data: registro, error: regErr } = await db
    .from("backups")
    .insert({ owner_id: ownerId, criado_por: ownerId, tipo, status: "processando" })
    .select()
    .single();
  if (regErr) throw new Error(regErr.message);

  if (job) await passo(job, pct(0.02), `Backup ${tipo} iniciado`);

  try {
    const tabelas: Record<string, Row[]> = {};
    const contagem: Record<string, number> = {};
    let totalRegistros = 0;

    for (let i = 0; i < TABLES.length; i++) {
      const t = TABLES[i]!;
      const col = t === "profiles" ? "id" : "owner_id";
      // Paginado: a API limita 1000 linhas por requisição; sem isso tabelas
      // grandes (despesas, pagamentos, movimentações) ficavam incompletas.
      const pageSize = 1000;
      const linhas: Row[] = [];
      for (let from = 0; ; from += pageSize) {
        const q = db.from(t).select("*") as unknown as {
          eq: (c: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              range: (a: number, b: number) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
            };
          };
        };
        const { data, error } = await q.eq(col, ownerId).order("id", { ascending: true }).range(from, from + pageSize - 1);
        if (error) throw new Error(`${t}: ${error.message}`);
        const page = (data ?? []) as Row[];
        linhas.push(...page);
        if (page.length < pageSize) break;
      }
      tabelas[t] = linhas;
      contagem[t] = tabelas[t].length;
      totalRegistros += tabelas[t].length;
      await passo(job, pct(0.05 + 0.55 * ((i + 1) / TABLES.length)), `${TABLE_LABEL[t] ?? t}: ${contagem[t]} registro(s)`);
    }

    // Arquivos: anexos do tenant + avatar do perfil
    const arquivos: BackupPayload["arquivos"] = [];
    let totalBytesArquivos = 0;

    const alvos: { bucket: string; path: string; nome: string }[] = [];
    for (const a of tabelas["anexos"] ?? []) {
      alvos.push({ bucket: "anexos", path: String(a["path"]), nome: String(a["nome"] ?? "arquivo") });
    }
    const avatar = (tabelas["profiles"]?.[0]?.["avatar_url"] ?? null) as string | null;
    if (avatar && !avatar.startsWith("http")) alvos.push({ bucket: "avatars", path: avatar, nome: "avatar" });

    await passo(job, pct(0.62), `Coletando ${alvos.length} arquivo(s) anexado(s)`);

    for (let i = 0; i < alvos.length; i++) {
      const alvo = alvos[i]!;
      try {
        const { data: blob, error } = await db.storage.from(alvo.bucket).download(alvo.path);
        if (error || !blob) {
          arquivos.push({ ...alvo, conteudo_b64: null, tamanho: 0 });
          await passo(job, pct(0.62 + 0.2 * ((i + 1) / Math.max(1, alvos.length))), `Arquivo indisponível: ${alvo.nome}`, "aviso");
          continue;
        }
        const buf = await blob.arrayBuffer();
        const cabe = buf.byteLength <= MAX_FILE_BYTES && totalBytesArquivos + buf.byteLength <= MAX_TOTAL_FILE_BYTES;
        if (cabe) totalBytesArquivos += buf.byteLength;
        arquivos.push({ ...alvo, conteudo_b64: cabe ? toBase64(buf) : null, tamanho: buf.byteLength });
        if (!cabe) await passo(job, pct(0.62 + 0.2 * ((i + 1) / alvos.length)), `Arquivo grande demais, registrado sem conteúdo: ${alvo.nome}`, "aviso");
        else if (alvos.length <= 40 || i % 5 === 0)
          await passo(job, pct(0.62 + 0.2 * ((i + 1) / alvos.length)), `Arquivo incluído: ${alvo.nome}`);
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

    await passo(job, pct(0.86), "Compactando e enviando o pacote de backup");

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

    await passo(job, pct(1), `Backup concluído · ${totalRegistros} registros · ${arquivos.length} arquivos`);
    await log(ownerId, "backup_create", registro.id, { tipo, totalRegistros, arquivos: arquivos.length });
    return final;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha desconhecida";
    await db.from("backups").update({ status: "erro", erro: msg }).eq("id", registro.id);
    await passo(job, pct(1), `Erro: ${msg}`, "erro");
    await log(ownerId, "backup_error", registro.id, { erro: msg });
    throw new Error(msg);
  }
}

/* ------------------------------------------------------------------ */
/* Importação de arquivo de backup baixado anteriormente               */
/* ------------------------------------------------------------------ */

export async function importarBackupUpload(
  ownerId: string,
  rawText: string,
  job: Job | null = null,
) {
  const db = await admin();

  await passo(job, 2, "Lendo arquivo enviado");
  let payload: BackupPayload;
  try {
    payload = validarPayload(JSON.parse(rawText), ownerId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Arquivo inválido";
    throw new Error(`Validação: ${msg}`);
  }

  const json = rawText;
  const bytes = new TextEncoder().encode(json);

  await passo(job, 10, "Registrando backup no histórico");

  const contagem: Record<string, number> = {};
  let totalRegistros = 0;
  for (const t of TABLES) {
    const n = (payload.tabelas[t] ?? []).length;
    contagem[t] = n;
    totalRegistros += n;
  }
  const arquivos = payload.arquivos ?? [];
  const comConteudo = arquivos.filter((a) => !!a.conteudo_b64).length;

  const { data: registro, error: regErr } = await db
    .from("backups")
    .insert({
      owner_id: ownerId,
      criado_por: ownerId,
      tipo: "upload",
      status: "processando",
      tabelas: contagem as never,
      total_registros: totalRegistros,
      total_arquivos: arquivos.length,
      observacoes: `Importado de arquivo · ${arquivos.length} arquivo(s) · ${comConteudo} com conteúdo`,
    })
    .select()
    .single();
  if (regErr) throw new Error(regErr.message);

  const path = `${ownerId}/${registro.id}.json`;
  await passo(job, 30, "Enviando pacote para o armazenamento seguro");
  const { error: upErr } = await db.storage
    .from("backups")
    .upload(path, bytes, { contentType: "application/json", upsert: true });
  if (upErr) {
    await db.from("backups").update({ status: "erro", erro: upErr.message }).eq("id", registro.id);
    throw new Error(upErr.message);
  }

  const { data: final, error: updErr } = await db
    .from("backups")
    .update({
      status: "concluido",
      path,
      tamanho_bytes: bytes.byteLength,
    })
    .eq("id", registro.id)
    .select()
    .single();
  if (updErr) throw new Error(updErr.message);

  await passo(job, 99, `Backup importado · ${totalRegistros} registros · ${arquivos.length} arquivo(s)`);
  await log(ownerId, "backup_upload", registro.id, {
    totalRegistros,
    arquivos: arquivos.length,
    comConteudo,
  });

  return final;
}

/* ------------------------------------------------------------------ */
/* Validação / leitura do pacote                                       */
/* ------------------------------------------------------------------ */

export function validarPayload(raw: unknown, ownerId: string): BackupPayload {
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

export async function carregarPacote(ownerId: string, backupId: string) {
  const db = await admin();
  const { data: b } = await db
    .from("backups")
    .select("id, owner_id, path, status, created_at, tipo")
    .eq("id", backupId)
    .maybeSingle();
  if (!b || b.owner_id !== ownerId) throw new Error("Backup não encontrado.");
  if (!b.path || b.status !== "concluido") throw new Error("Backup indisponível para restauração.");

  const { data: blob, error } = await db.storage.from("backups").download(b.path);
  if (error || !blob) throw new Error("Não foi possível ler o arquivo do backup.");
  const payload = validarPayload(JSON.parse(await blob.text()), ownerId);
  return { registro: b, payload };
}

export type DryRun = {
  ok: boolean;
  formato: number;
  geradoEm: string;
  tipo: string;
  compatibilidade: { formatoSuportado: boolean; mesmaConta: boolean; tabelasDesconhecidas: string[] };
  tabelas: { tabela: string; label: string; noBackup: number; atual: number; delta: number }[];
  totais: { backup: number; atual: number };
  arquivos: { total: number; comConteudo: number; semConteudo: number };
  avisos: string[];
};

export async function dryRun(ownerId: string, backupId: string): Promise<DryRun> {
  const db = await admin();
  const { registro, payload } = await carregarPacote(ownerId, backupId);

  const tabelas: DryRun["tabelas"] = [];
  let totalBackup = 0;
  let totalAtual = 0;

  for (const t of TABLES) {
    const noBackup = (payload.tabelas[t] ?? []).length;
    const col = t === "profiles" ? "id" : "owner_id";
    const q = db.from(t).select("*", { count: "exact", head: true }) as unknown as {
      eq: (c: string, v: string) => Promise<{ count: number | null }>;
    };
    const { count } = await q.eq(col, ownerId);
    const atual = count ?? 0;
    totalBackup += noBackup;
    totalAtual += atual;
    tabelas.push({ tabela: t, label: TABLE_LABEL[t] ?? t, noBackup, atual, delta: noBackup - atual });
  }

  const conhecidas = new Set<string>(TABLES as unknown as string[]);
  const tabelasDesconhecidas = Object.keys(payload.tabelas).filter((k) => !conhecidas.has(k));

  const arquivos = payload.arquivos ?? [];
  const comConteudo = arquivos.filter((a) => !!a.conteudo_b64).length;

  const avisos: string[] = [];
  if (totalAtual > totalBackup) {
    avisos.push(
      `Os dados atuais têm ${totalAtual - totalBackup} registro(s) a mais que o backup. Esses registros serão removidos.`,
    );
  }
  if (arquivos.length - comConteudo > 0) {
    avisos.push(`${arquivos.length - comConteudo} arquivo(s) foram registrados sem conteúdo e não serão recuperados.`);
  }
  if (tabelasDesconhecidas.length) {
    avisos.push(`Tabelas não reconhecidas serão ignoradas: ${tabelasDesconhecidas.join(", ")}.`);
  }
  if (!avisos.length) avisos.push("Nenhuma pendência encontrada. O backup é totalmente compatível.");

  return {
    ok: true,
    formato: payload.meta.formato,
    geradoEm: payload.meta.gerado_em,
    tipo: registro.tipo,
    compatibilidade: {
      formatoSuportado: payload.meta.formato <= FORMAT_VERSION,
      mesmaConta: payload.meta.owner_id === ownerId,
      tabelasDesconhecidas,
    },
    tabelas,
    totais: { backup: totalBackup, atual: totalAtual },
    arquivos: { total: arquivos.length, comConteudo, semConteudo: arquivos.length - comConteudo },
    avisos,
  };
}

/* ------------------------------------------------------------------ */
/* Restauração                                                         */
/* ------------------------------------------------------------------ */

export async function restaurar(ownerId: string, backupId: string, job: Job | null = null) {
  const db = await admin();

  await passo(job, 2, "Lendo e validando o pacote de backup");
  const { registro, payload } = await carregarPacote(ownerId, backupId);

  await passo(job, 5, "Criando backup de segurança do estado atual");
  const seguranca = await gerarBackup(ownerId, "seguranca", job, [5, 30]);

  const restaurado: Record<string, number> = {};

  await passo(job, 32, "Removendo dados atuais");
  const reversed = [...TABLES].reverse();
  for (let i = 0; i < reversed.length; i++) {
    const t = reversed[i]!;
    if (t === "profiles") continue;
    const { error } = await db.from(t).delete().eq("owner_id", ownerId);
    if (error) throw new Error(`Falha ao limpar ${t}: ${error.message}`);
    await passo(job, 32 + 18 * ((i + 1) / reversed.length), `Limpo: ${TABLE_LABEL[t] ?? t}`);
  }

  for (let i = 0; i < TABLES.length; i++) {
    const t = TABLES[i]!;
    const rows = (payload.tabelas[t] ?? []) as Row[];
    const prog = 50 + 35 * ((i + 1) / TABLES.length);
    if (!rows.length) {
      await passo(job, prog, `${TABLE_LABEL[t] ?? t}: nada a restaurar`);
      continue;
    }

    if (t === "profiles") {
      const perfil = rows[0];
      if (perfil) {
        const { id, created_at, ...resto } = perfil as Row & { id?: string; created_at?: string };
        void id;
        void created_at;
        await db.from("profiles").update(resto as never).eq("id", ownerId);
        restaurado[t] = 1;
      }
      await passo(job, prog, "Perfil restaurado");
      continue;
    }

    const selfRef = SELF_REF[t];
    const lotes = selfRef ? [rows.filter((r) => !r[selfRef]), rows.filter((r) => !!r[selfRef])] : [rows];

    for (const lote of lotes) {
      for (let k = 0; k < lote.length; k += 200) {
        const chunk = lote.slice(k, k + 200).map((r) => {
          const row: Row = { ...r, owner_id: ownerId };
          for (const col of GENERATED_COLS[t] ?? []) delete row[col];
          return row;
        });
        const { error } = await db.from(t).upsert(chunk as never, { onConflict: "id" });
        if (error) throw new Error(`Falha ao restaurar ${t}: ${error.message}`);
      }
    }

    // Remove registros atuais que não existem no backup. Lê os IDs atuais em
    // páginas e apaga em lotes, para não montar uma URL gigante quando a
    // tabela tem milhares de linhas.
    const idsBackup = new Set(rows.map((r) => String(r["id"])));
    const atuais: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: pg, error: lerErr } = await db
        .from(t)
        .select("id")
        .eq("owner_id", ownerId)
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (lerErr) throw new Error(`Falha ao normalizar ${t}: ${lerErr.message}`);
      const lista = (pg ?? []) as unknown as { id: string }[];
      for (const r of lista) atuais.push(String(r.id));
      if (lista.length < 1000) break;
    }
    const sobrando = atuais.filter((id) => !idsBackup.has(id));
    for (let k = 0; k < sobrando.length; k += 200) {
      const { error: pruneErr } = await db
        .from(t)
        .delete()
        .eq("owner_id", ownerId)
        .in("id", sobrando.slice(k, k + 200));
      if (pruneErr) throw new Error(`Falha ao normalizar ${t}: ${pruneErr.message}`);
    }

    restaurado[t] = rows.length;
    await passo(job, prog, `${TABLE_LABEL[t] ?? t}: ${rows.length} registro(s) restaurado(s)`);
  }

  let arquivosRestaurados = 0;
  const files = payload.arquivos ?? [];
  await passo(job, 86, `Recuperando ${files.length} arquivo(s)`);
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
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
    if (i % 5 === 0) await passo(job, 86 + 12 * ((i + 1) / files.length), `Arquivo recuperado: ${f.nome}`);
  }

  await db.from("backups").update({ restaurado_em: new Date().toISOString() }).eq("id", registro.id);
  await log(ownerId, "backup_restore", registro.id, {
    backup_seguranca: seguranca?.id ?? null,
    registros: restaurado,
    arquivos: arquivosRestaurados,
  });
  await passo(job, 99, `Restauração concluída · ${arquivosRestaurados} arquivo(s) recuperado(s)`);

  return {
    ok: true,
    backupSegurancaId: seguranca?.id ?? null,
    registros: restaurado,
    arquivos: arquivosRestaurados,
  };
}

/* ------------------------------------------------------------------ */
/* Retenção                                                            */
/* ------------------------------------------------------------------ */

/** Mantém apenas os N backups automáticos mais recentes; remove arquivos e histórico. */
export async function aplicarRetencao(ownerId: string, reterUltimos: number, job: Job | null = null) {
  const db = await admin();
  const { data, error } = await db
    .from("backups")
    .select("id, path, created_at")
    .eq("owner_id", ownerId)
    .eq("tipo", "automatico")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const excedentes = (data ?? []).slice(Math.max(1, reterUltimos));
  if (!excedentes.length) {
    await passo(job, 99, "Retenção: nenhum backup antigo para remover");
    return { removidos: 0 };
  }

  const paths = excedentes.map((b) => b.path).filter((p): p is string => !!p);
  if (paths.length) {
    const { error: rmErr } = await db.storage.from("backups").remove(paths);
    if (rmErr) await passo(job, 99, `Retenção: falha ao remover arquivos (${rmErr.message})`, "aviso");
  }
  const { error: delErr } = await db
    .from("backups")
    .delete()
    .in("id", excedentes.map((b) => b.id));
  if (delErr) throw new Error(delErr.message);

  await log(ownerId, "backup_retention", null, { removidos: excedentes.length, reter: reterUltimos });
  await passo(job, 99, `Retenção aplicada: ${excedentes.length} backup(s) antigo(s) removido(s)`);
  return { removidos: excedentes.length };
}

/* ------------------------------------------------------------------ */
/* Worker: execução automática agendada                                */
/* ------------------------------------------------------------------ */

function proximaExecucao(freq: string, horaUtc: number) {
  const d = new Date();
  d.setUTCHours(horaUtc, 0, 0, 0);
  while (d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + (freq === "diario" ? 1 : 7));
  return d.toISOString();
}

export async function executarAgendados() {
  const db = await admin();
  const agora = new Date().toISOString();
  const { data: agendas, error } = await db
    .from("backup_schedules")
    .select("*")
    .eq("ativo", true)
    .lte("proxima_execucao", agora);
  if (error) throw new Error(error.message);

  const resultados: { owner_id: string; ok: boolean; backup_id?: string; removidos?: number; erro?: string }[] = [];

  for (const a of agendas ?? []) {
    // Marca a próxima execução imediatamente para evitar disparo duplicado.
    await db
      .from("backup_schedules")
      .update({
        ultima_execucao: agora,
        proxima_execucao: proximaExecucao(a.frequencia, a.hora_utc),
      })
      .eq("id", a.id);

    const job = await criarJob(a.owner_id, "backup", null, "Backup automático agendado");
    try {
      const b = await gerarBackup(a.owner_id, "automatico", job, [0, 92]);
      const ret = await aplicarRetencao(a.owner_id, a.reter_ultimos, job);
      await finalizarJob(job, "concluido", {
        backupId: b?.id ?? null,
        resultado: { backup_id: b?.id, removidos: ret.removidos },
      });
      resultados.push({ owner_id: a.owner_id, ok: true, backup_id: b?.id, removidos: ret.removidos });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha desconhecida";
      await finalizarJob(job, "erro", { erro: msg });
      resultados.push({ owner_id: a.owner_id, ok: false, erro: msg });
    }
  }

  return { processados: resultados.length, resultados };
}
