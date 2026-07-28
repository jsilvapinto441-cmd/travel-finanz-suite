import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "listar_empresas",
  title: "Listar empresas",
  description: "Lista as empresas cadastradas no Rotas.",
  inputSchema: {
    apenas_ativas: z.boolean().optional().describe("Retornar somente empresas ativas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ apenas_ativas }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("empresas")
      .select("id, nome, razao_social, cnpj, ativo")
      .order("nome");
    if (apenas_ativas) q = q.eq("ativo", true);
    const { data, error } = await q;
    return error ? fail(error.message) : ok(data);
  },
});
