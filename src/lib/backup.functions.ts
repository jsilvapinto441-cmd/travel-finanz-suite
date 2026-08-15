import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Wrappers finos: toda a lógica vive em `backup-core.server.ts`.
 * O tenant é SEMPRE `context.userId`, nunca um valor vindo do frontend.
 */

export const criarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const core = await import("./backup-core.server");
    const job = await core.criarJob(context.userId, "backup", null, "Backup manual iniciado");
    try {
      const b = await core.gerarBackup(context.userId, "manual", job, [0, 98]);
      await core.finalizarJob(job, "concluido", { backupId: b?.id ?? null, resultado: { backup_id: b?.id } });
      return { jobId: job.id, backup: b };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao gerar backup";
      await core.finalizarJob(job, "erro", { erro: msg });
      throw new Error(msg);
    }
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

/** Job em execução (ou o último finalizado) — alimenta a barra de progresso. */
export const jobAtual = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("backup_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

export const baixarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const core = await import("./backup-core.server");
    const db = await core.admin();
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
    await core.log(context.userId, "backup_download", b.id, {});
    return { url: signed.signedUrl };
  });

export const excluirBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const core = await import("./backup-core.server");
    const db = await core.admin();
    const { data: b } = await db
      .from("backups")
      .select("id, owner_id, path")
      .eq("id", data.id)
      .maybeSingle();
    if (!b || b.owner_id !== context.userId) throw new Error("Backup não encontrado.");
    if (b.path) await db.storage.from("backups").remove([b.path]);
    const { error } = await db.from("backups").delete().eq("id", b.id);
    if (error) throw new Error(error.message);
    await core.log(context.userId, "backup_delete", b.id, {});
    return { ok: true };
  });

/** Pré-validação (dry-run) antes de confirmar a restauração. */
export const validarRestauracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const core = await import("./backup-core.server");
    return await core.dryRun(context.userId, data.id);
  });

export const restaurarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), confirmacao: z.literal("RESTAURAR") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const core = await import("./backup-core.server");
    const job = await core.criarJob(context.userId, "restauracao", data.id, "Restauração iniciada");
    try {
      const r = await core.restaurar(context.userId, data.id, job);
      await core.finalizarJob(job, "concluido", { resultado: r as unknown as Record<string, unknown> });
      return { ...r, jobId: job.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na restauração";
      await core.finalizarJob(job, "erro", { erro: msg });
      throw new Error(msg);
    }
  });

/** Aplica a retenção manualmente (mesma regra usada pelo worker automático). */
export const limparAntigos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const core = await import("./backup-core.server");
    const { data: ag } = await context.supabase.from("backup_schedules").select("reter_ultimos").maybeSingle();
    return await core.aplicarRetencao(context.userId, ag?.reter_ultimos ?? 10);
  });

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
