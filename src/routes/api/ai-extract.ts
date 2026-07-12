import { createFileRoute } from "@tanstack/react-router";
import { LOVABLE_AI_BASE, lovableHeaders } from "@/lib/ai/gateway.server";

// Extract structured records for ANY module supported by the system.
// Returns { module, summary, items: [...] } where `module` identifies the target
// module (or "misto" when several are present).

const MODULES = [
  "despesas",
  "recebiveis",
  "fornecedores",
  "funcionarios",
  "empresas",
  "bancos",
  "missoes",
  "contratos",
  "misto",
] as const;

const CATEGORIAS_DESPESA = [
  "impostos",
  "funcionarios",
  "aluguel",
  "luz",
  "condominio",
  "telefone",
  "parcelamento_simples",
  "avulso",
  "fornecedor",
  "outros",
] as const;

const EXTRACT_INSTRUCTION = `Você é o extrator do Assistente Financeiro da plataforma Rotas.
Analise TODO o conteúdo (todas as linhas, todas as páginas, todas as abas) e identifique o MÓDULO destino mais provável, além de TODOS os registros contidos.

Módulos possíveis: ${JSON.stringify(MODULES)}.

Responda SOMENTE com JSON válido (sem markdown), no formato:

{
  "module": <um dos módulos acima>,
  "confidence": 0.0-1.0,
  "summary": "resumo humano em 1-2 frases",
  "questions": ["perguntas ao usuário quando houver ambiguidade"],
  "items": [ ... registros ... ]
}

Formato dos items conforme o module:

despesas: { "descricao": string, "valor": number, "categoria": ${JSON.stringify(CATEGORIAS_DESPESA)} | null, "data_vencimento": "YYYY-MM-DD" | null, "fornecedor_nome": string | null, "observacoes": string | null }
recebiveis: { "pagador": string, "valor_total": number, "parcelas": number|null, "data_vencimento": "YYYY-MM-DD" | null, "categoria": string | null, "observacoes": string | null }
fornecedores: { "nome": string, "cnpj": string | null, "email": string | null, "telefone": string | null, "responsavel": string | null, "observacoes": string | null }
funcionarios: { "nome": string, "cargo": string | null, "salario": number | null, "data_admissao": "YYYY-MM-DD" | null }
empresas: { "nome": string, "cnpj": string | null, "razao_social": string | null }
bancos: { "banco": string, "agencia": string | null, "conta": string | null, "digito": string | null, "tipo": string | null, "titular": string | null, "documento": string | null, "chave_pix": string | null, "saldo_inicial": number | null }
missoes: { "nome": string, "descricao": string | null, "observacoes": string | null }
contratos: { "cliente": string, "valor": number, "valor_entrada": number|null, "parcelas": number|null, "dia_vencimento": number|null, "data_inicio": "YYYY-MM-DD" | null, "destino": string | null, "observacoes": string | null }

Se o arquivo contiver registros de MÚLTIPLOS módulos, use module="misto" e coloque em items objetos do tipo:
{ "__module": "<modulo>", ...campos daquele módulo }

Regras críticas:
- Leia o documento COMPLETO. Nunca use só as primeiras linhas.
- Aceite qualquer período (2022, 2023, 2024, 2025, 2026…).
- Reconheça sinônimos: Valor/Preço/Total/Pagamento/Recebimento/Montante; Data/Vencimento/Emissão/Pagamento.
- Valores em number com ponto decimal, positivos.
- Ignore linhas de total, subtotal, cabeçalho repetido, rodapé e comentários.
- Se algo estiver ambíguo, adicione uma pergunta em "questions" em vez de inventar.
- Nunca invente registros. Se não houver dados claros, retorne items: [].`;

export const Route = createFileRoute("/api/ai-extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as {
          text?: string;
          hint?: string; // usuário pode dizer para qual módulo é
          file?: { filename: string; mime: string; base64: string };
        };

        const userContent: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
          | { type: "file"; file: { filename: string; file_data: string } }
        > = [{ type: "text", text: EXTRACT_INSTRUCTION }];

        if (body.hint) {
          userContent.push({
            type: "text",
            text: `Dica do usuário sobre o módulo: ${body.hint}`,
          });
        }
        if (body.text) {
          userContent.push({ type: "text", text: `Conteúdo:\n\n${body.text}` });
        }
        if (body.file) {
          const dataUrl = `data:${body.file.mime};base64,${body.file.base64}`;
          if (body.file.mime.startsWith("image/")) {
            userContent.push({ type: "image_url", image_url: { url: dataUrl } });
          } else {
            userContent.push({
              type: "file",
              file: { filename: body.file.filename, file_data: dataUrl },
            });
          }
        }

        const res = await fetch(`${LOVABLE_AI_BASE}/chat/completions`, {
          method: "POST",
          headers: lovableHeaders(),
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Você é um extrator de dados para os módulos de um sistema financeiro (Bancos, Empresas, Missões, Contratos, Recebíveis, Despesas, Funcionários, Fornecedores). Responda SEMPRE apenas com JSON válido.",
              },
              { role: "user", content: userContent },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          if (res.status === 429)
            return new Response("Limite de uso atingido.", { status: 429 });
          if (res.status === 402)
            return new Response("Créditos de IA esgotados.", { status: 402 });
          return new Response(`Falha na extração: ${t || res.statusText}`, {
            status: 500,
          });
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = {
            module: "misto",
            summary: "Não foi possível estruturar.",
            items: [],
          };
        }
        return Response.json(parsed);
      },
    },
  },
});
