import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "listar_missoes",
  title: "Listar missões",
  description: "Lista as missões cadastradas no Rotas.",
  inputSchema: {
    busca: z.string().trim().min(1).optional().describe("Filtra pelo nome da missão."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let q = supabaseForUser(ctx)
      .from("missoes")
      .select("id, nome, descricao, status")
      .order("nome");
    if (busca) q = q.ilike("nome", `%${busca}%`);
    const { data, error } = await q;
    return error ? fail(error.message) : ok(data);
  },
});
