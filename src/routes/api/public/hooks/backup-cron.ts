import { createFileRoute } from "@tanstack/react-router";

/**
 * Worker de backups automáticos. Chamado periodicamente pelo agendador do banco.
 * Autenticação: header `apikey` com a chave pública do projeto.
 */
export const Route = createFileRoute("/api/public/hooks/backup-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { executarAgendados } = await import("@/lib/backup-core.server");
          const r = await executarAgendados();
          return new Response(JSON.stringify({ success: true, ...r }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha desconhecida";
          console.error("[backup-cron]", msg);
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
