import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarEmpresas from "./tools/listar-empresas";
import listarMissoes from "./tools/listar-missoes";
import listarDespesas from "./tools/listar-despesas";
import listarRecebiveis from "./tools/listar-recebiveis";
import resumoFinanceiro from "./tools/resumo-financeiro";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rotas-mcp",
  title: "Rotas — Gestão Administrativa e Financeira",
  version: "0.1.0",
  instructions:
    "Ferramentas do Rotas para consultar empresas, missões, despesas, recebíveis e resumos financeiros do usuário autenticado. Use `listar_empresas` e `listar_missoes` para obter IDs antes de filtrar despesas ou recebíveis.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarEmpresas, listarMissoes, listarDespesas, listarRecebiveis, resumoFinanceiro],
});
