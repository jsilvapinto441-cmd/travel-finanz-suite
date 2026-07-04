import { createFileRoute } from "@tanstack/react-router";
import { LOVABLE_AI_BASE, lovableHeaders } from "@/lib/ai/gateway.server";

// Extract structured financial entries from arbitrary input (text, PDF or image).
// Returns { kind: "despesas" | "recebiveis" | "misto", items: [...] }

const CATEGORIAS = [
  "aluguel",
  "salarios",
  "marketing",
  "impostos",
  "servicos",
  "materiais",
  "viagem",
  "alimentacao",
  "transporte",
  "tecnologia",
  "outros",
] as const;

const EXTRACT_INSTRUCTION = `Analise o conteúdo e extraia TODOS os lançamentos financeiros identificáveis.
Devolva SOMENTE JSON válido, sem markdown, no formato:

{
  "kind": "despesas" | "recebiveis" | "misto",
  "summary": "resumo humano em uma frase",
  "items": [
    {
      "tipo": "despesa" | "receita",
      "descricao": "string",
      "valor": 0.00,
      "data_vencimento": "YYYY-MM-DD" | null,
      "categoria": ${JSON.stringify(CATEGORIAS)} | null,
      "pagador_ou_fornecedor": "string" | null,
      "forma_pagamento": "string" | null,
      "status": "em_aberto" | "pago" | "atrasado" | "parcial" | null,
      "observacoes": "string" | null
    }
  ]
}

Regras:
- Valores sempre em número (ponto decimal), positivos.
- Se não conseguir identificar a data, use null.
- Se não tiver certeza da categoria, use "outros".
- Não invente lançamentos: se o conteúdo não contém dados financeiros claros, retorne items: [].`;

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
          file?: { filename: string; mime: string; base64: string };
        };

        const userContent: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
          | { type: "file"; file: { filename: string; file_data: string } }
        > = [{ type: "text", text: EXTRACT_INSTRUCTION }];

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
                content: "Você é um extrator financeiro. Responda SEMPRE apenas com JSON válido.",
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
          return new Response(`Falha na extração: ${t || res.statusText}`, { status: 500 });
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { kind: "misto", summary: "Não foi possível estruturar.", items: [] };
        }
        return Response.json(parsed);
      },
    },
  },
});
