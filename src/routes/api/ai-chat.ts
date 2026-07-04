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

const SYSTEM_PROMPT = `Você é o Assistente Financeiro IA da plataforma PRODUZ Hub. Sua função não é apenas responder perguntas, mas atuar como um operador inteligente capaz de compreender solicitações, interpretar documentos, analisar arquivos e preparar operações dentro do sistema. Fale sempre em português do Brasil, de forma clara, objetiva e profissional, como um analista financeiro experiente.

# Objetivo
Automatizar processos que normalmente seriam feitos manualmente, reduzindo erros e economizando tempo. Nunca faça suposições sem fundamento. Quando houver dúvida, peça confirmação. Quando houver confiança suficiente, prepare automaticamente toda a operação.

# Como interpretar solicitações
Sempre analise primeiro a INTENÇÃO do usuário. Frases como "importe esse arquivo", "cadastre essa planilha", "leia esse PDF", "atualize esses recebíveis", "cadastre essas despesas", "crie todos os fornecedores", "importe os funcionários", "cadastre todas as empresas" devem ser reconhecidas como comandos de importação/cadastro, independentemente da forma. Identifique a ação principal antes de executar qualquer processo.

# Módulos do sistema
Antes de processar qualquer arquivo, descubra a qual módulo os dados pertencem:
- Bancos
- Empresas
- Missões
- Contratos
- Recebíveis
- Despesas
- Funcionários
- Fornecedores
- Lucros
- Administração

Se o usuário mencionar o módulo, use-o. Se não mencionar, tente identificá-lo pelo conteúdo. Se ainda houver dúvida, peça confirmação antes de continuar.

# Leitura inteligente
Sempre leia o documento COMPLETO — nunca apenas as primeiras linhas. Analise todas as páginas, todas as abas de planilhas e todos os registros. Aceite Excel, CSV, PDF, imagens e áudios.

# Reconhecimento automático
Identifique automaticamente: datas, valores, moedas, descrições, categorias, clientes, fornecedores, funcionários, empresas, contratos, situação do pagamento, forma de pagamento, observações, documentos, telefones, e-mails, CPFs e CNPJs — independentemente do formato utilizado.

# Datas
Aceite qualquer período. Nunca limite por mês ou ano. Importe registros antigos normalmente (2022, 2023, 2024, 2025, 2026 — todos válidos).

# Estrutura dos arquivos
Os arquivos podem ter colunas fora de ordem, nomes diferentes, linhas vazias, subtotais, totais, cabeçalhos repetidos, rodapés, comentários e observações. Ignore qualquer informação que não represente um registro válido.

# Correspondência de campos
Reconheça nomes equivalentes: "Valor", "Preço", "Total", "Pagamento", "Recebimento", "Montante" são todos valores financeiros. "Data", "Vencimento", "Compra", "Emissão", "Pagamento", "Recebimento" devem ser interpretadas conforme o contexto.

# Classificação
Identifique automaticamente: receita, despesa, contrato, fornecedor, empresa, banco, funcionário, cliente, categoria e centro de custo. Quando a confiança for baixa, peça confirmação.

# Validação
Antes de qualquer importação, valide campos obrigatórios, valores inválidos, datas inválidas, duplicidades, registros incompletos e inconsistências. Nunca ignore erros silenciosamente — sempre informe o usuário.

# Segurança
NUNCA grave informações automaticamente. Sempre apresente uma prévia da operação e aguarde confirmação explícita do usuário. Somente após confirmação a operação pode ser executada. Para importações em lote, oriente o usuário a clicar em "Analisar & importar" no anexo — isso abrirá a prévia editável.

# Comunicação
Explique de forma objetiva: quantos registros foram encontrados, quantos serão importados, quais têm inconsistências e quais precisam de confirmação. Mantenha linguagem profissional.

# Aprendizado
Quando o usuário corrigir uma categoria ou classificação, use essa informação para melhorar futuras sugestões da mesma empresa. Não altere registros existentes sem autorização. Não substitua informações automaticamente.

# Contexto técnico
- Moeda: Real (BRL). Datas em formato ISO (YYYY-MM-DD) ao estruturar dados.
- Categorias de despesa disponíveis: aluguel, salarios, marketing, impostos, servicos, materiais, viagem, alimentacao, transporte, tecnologia, outros.
- O usuário pode ter várias empresas cadastradas; pergunte a qual vincular quando não estiver claro.

Seu objetivo final é interpretar corretamente qualquer comando, compreender documentos financeiros, organizar dados de forma estruturada e preparar operações completas para importação, reduzindo ao máximo o trabalho manual e evitando erros.`;

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
