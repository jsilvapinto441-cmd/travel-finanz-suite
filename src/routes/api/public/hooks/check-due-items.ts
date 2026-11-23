import { createFileRoute } from "@tanstack/react-router";

/**
 * check-due-items: avisos diários de vencimentos. Chamado pelo agendador às 11:00 UTC
 * (segredo gerenciado no header Authorization) ou manualmente (header `apikey`).
 * Repetir a chamada não duplica avisos: o histórico impede reenvio no mesmo dia.
 */
export const Route = createFileRoute("/api/public/hooks/check-due-items")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) {
          const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
          const denied = await authenticateCronRequest(request);
          if (denied) return Response.json({ error: "Não autorizado" }, { status: 401 });
        }
        try {
          const { checkDueItems } = await import("@/lib/due-items.server");
          const r = await checkDueItems();
          return Response.json({ success: true, usuarios_processados: r.usuarios, pushes_enviados: r.pushes, erros: r.erros });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha desconhecida";
          console.error("[check-due-items]", msg);
          return Response.json({ success: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
