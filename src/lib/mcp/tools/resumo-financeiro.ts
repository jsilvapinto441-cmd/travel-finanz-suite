import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro",
  description:
    "Retorna totais consolidados de recebíveis e despesas de um período, com lucro estimado.",
  inputSchema: {
    data_inicio: z.string().date().describe("Início do período (YYYY-MM-DD)."),
    data_fim: z.string().date().describe("Fim do período (YYYY-MM-DD)."),
    empresa_id: z.string().uuid().optional(),
    missao_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ data_inicio, data_fim, empresa_id, missao_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);

    let dq = sb
      .from("despesas")
      .select("valor, valor_pago, status")
      .gte("data_vencimento", data_inicio)
      .lte("data_vencimento", data_fim);
    let rq = sb
      .from("recebiveis")
      .select("valor_parcela, valor_pago, status")
      .gte("data_vencimento", data_inicio)
      .lte("data_vencimento", data_fim);
    if (empresa_id) { dq = dq.eq("empresa_id", empresa_id); rq = rq.eq("empresa_id", empresa_id); }
    if (missao_id) { dq = dq.eq("missao_id", missao_id); rq = rq.eq("missao_id", missao_id); }

    const [desp, receb] = await Promise.all([dq, rq]);
    if (desp.error) return fail(desp.error.message);
    if (receb.error) return fail(receb.error.message);

    const totalDespesas = (desp.data ?? []).reduce((s, d) => s + Number(d.valor ?? 0), 0);
    const pagoDespesas = (desp.data ?? []).reduce((s, d) => s + Number(d.valor_pago ?? 0), 0);
    const totalRecebiveis = (receb.data ?? []).reduce((s, r) => s + Number(r.valor_parcela ?? 0), 0);
    const recebido = (receb.data ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);

    return ok({
      periodo: { data_inicio, data_fim },
      despesas: {
        total: totalDespesas,
        pago: pagoDespesas,
        a_pagar: totalDespesas - pagoDespesas,
        registros: desp.data?.length ?? 0,
      },
      recebiveis: {
        total: totalRecebiveis,
        recebido,
        a_receber: totalRecebiveis - recebido,
        registros: receb.data?.length ?? 0,
      },
      lucro_previsto: totalRecebiveis - totalDespesas,
      lucro_realizado: recebido - pagoDespesas,
    });
  },
});
