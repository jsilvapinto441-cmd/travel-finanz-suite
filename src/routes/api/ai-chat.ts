import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LOVABLE_AI_BASE, lovableHeaders } from "@/lib/ai/gateway.server";

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  // Either plain text or OpenAI-style content parts (for images/PDF)
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "file"; file: { filename: string; file_data: string } }
      >;
};

const SYSTEM_PROMPT = `Você é o Assistente Financeiro IA do PRODUZ Hub — um copiloto especializado em finanças de agência de viagens. Fale sempre em português do Brasil, de forma clara, objetiva e profissional.

Você ajuda o usuário a:
- Interpretar planilhas (XLSX/CSV), PDFs e imagens de comprovantes/faturas.
- Identificar despesas e receitas, categorizar automaticamente e sugerir importação em lote.
- Cadastrar lançamentos individuais (despesas ou recebíveis).
- Explicar movimentações, gerar relatórios rápidos e localizar registros.

Contexto do sistema:
- Categorias de despesa disponíveis: aluguel, salarios, marketing, impostos, servicos, materiais, viagem, alimentacao, transporte, tecnologia, outros.
- Formato monetário: Real (BRL). Datas no formato ISO (YYYY-MM-DD) quando estruturar dados.
- Empresas: o usuário pode ter várias empresas cadastradas; sempre pergunte a qual empresa vincular quando não estiver claro.

Quando o usuário anexar um arquivo (planilha, PDF, imagem ou o conteúdo já vier no chat), analise, identifique lançamentos e responda com um resumo humano. NÃO invente valores nem lançamentos. Se algo estiver ambíguo, pergunte antes de sugerir importação.

Para importar em lote, oriente o usuário a clicar em "Analisar & importar" no anexo — a ação abrirá uma prévia editável. Não afirme ter salvo nada sem que o usuário tenha confirmado a importação.`;

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = authHeader.slice("Bearer ".length);

          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            },
          );
          const { data: userData, error: authErr } = await supabase.auth.getUser(token);
          if (authErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const body = (await request.json()) as {
            threadId: string;
            messages: IncomingMessage[];
            model?: string;
          };

          // Verify thread belongs to user
          const { data: thread } = await supabase
            .from("ai_threads")
            .select("id")
            .eq("id", body.threadId)
            .eq("owner_id", userId)
            .maybeSingle();
          if (!thread) return new Response("Thread not found", { status: 404 });

          // Persist the last user message (client sends the entire history)
          const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
          if (lastUser) {
            await supabase.from("ai_messages").insert({
              thread_id: body.threadId,
              owner_id: userId,
              role: "user",
              content: typeof lastUser.content === "string" ? lastUser.content : "[anexo]",
              parts: typeof lastUser.content === "string" ? null : (JSON.parse(JSON.stringify(lastUser.content)) as never),
            });
            // bump thread
            await supabase
              .from("ai_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", body.threadId);
          }

          const model = body.model ?? "google/gemini-3-flash-preview";
          const upstream = await fetch(`${LOVABLE_AI_BASE}/chat/completions`, {
            method: "POST",
            headers: lovableHeaders(),
            body: JSON.stringify({
              model,
              stream: true,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...body.messages,
              ],
            }),
          });

          if (!upstream.ok) {
            const errText = await upstream.text().catch(() => "");
            if (upstream.status === 429) {
              return new Response("Limite de uso atingido. Tente novamente em instantes.", {
                status: 429,
              });
            }
            if (upstream.status === 402) {
              return new Response(
                "Créditos de IA esgotados. Adicione créditos nas configurações do workspace.",
                { status: 402 },
              );
            }
            return new Response(`AI gateway error: ${errText || upstream.statusText}`, {
              status: 500,
            });
          }

          // Proxy the SSE stream to the client and capture full text to persist.
          const decoder = new TextDecoder();
          let assistantText = "";

          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              const reader = upstream.body!.getReader();
              let buf = "";
              try {
                while (true) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                  buf += decoder.decode(value, { stream: true });
                  // Extract text deltas for persistence
                  const lines = buf.split("\n");
                  buf = lines.pop() ?? "";
                  for (const line of lines) {
                    const t = line.trim();
                    if (!t.startsWith("data:")) continue;
                    const payload = t.slice(5).trim();
                    if (!payload || payload === "[DONE]") continue;
                    try {
                      const j = JSON.parse(payload);
                      const delta = j?.choices?.[0]?.delta?.content;
                      if (typeof delta === "string") assistantText += delta;
                    } catch {
                      /* ignore */
                    }
                  }
                }
              } finally {
                controller.close();
                // Persist assistant message (fire and forget)
                if (assistantText.trim().length > 0) {
                  await supabase.from("ai_messages").insert({
                    thread_id: body.threadId,
                    owner_id: userId,
                    role: "assistant",
                    content: assistantText,
                  });
                }
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (e) {
          console.error("[ai-chat] error", e);
          return new Response("Erro interno no assistente.", { status: 500 });
        }
      },
    },
  },
});
