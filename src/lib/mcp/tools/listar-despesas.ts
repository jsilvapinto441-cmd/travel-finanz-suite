import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "listar_despesas",
  title: "Listar despesas",
  description:
    "Lista despesas do Rotas com filtros de empresa, missão, status e período de vencimento.",
  inputSchema: {
    empresa_id: z.string().uuid().optional(),
    missao_id: z.string().uuid().optional(),
    status: z.enum(["em_aberto", "pago_parcial", "pago", "cancelado"]).optional(),
    data_inicio: z.string().date().optional().describe("Vencimento a partir de (YYYY-MM-DD)."),
    data_fim: z.string().date().optional().describe("Vencimento até (YYYY-MM-DD)."),
    limite: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("despesas")
      .select(
        "id, descricao, categoria, valor, valor_pago, status, data_vencimento, data_pagamento, numero_parcela, parcelas, empresa_id, missao_id",
      )
      .order("data_vencimento", { ascending: true })
      .limit(input.limite ?? 50);
    if (input.empresa_id) q = q.eq("empresa_id", input.empresa_id);
    if (input.missao_id) q = q.eq("missao_id", input.missao_id);
    if (input.status) q = q.eq("status", input.status);
    if (input.data_inicio) q = q.gte("data_vencimento", input.data_inicio);
    if (input.data_fim) q = q.lte("data_vencimento", input.data_fim);
    const { data, error } = await q;
    if (error) return fail(error.message);
    const total = (data ?? []).reduce((s, d) => s + Number(d.valor ?? 0), 0);
    const pago = (data ?? []).reduce((s, d) => s + Number(d.valor_pago ?? 0), 0);
    return ok({ registros: data, total, pago, a_pagar: total - pago });
  },
});
