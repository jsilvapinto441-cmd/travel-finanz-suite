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

const SYSTEM_PROMPT = `Você é o Assistente Financeiro IA da plataforma PRODUZ Hub. Você NÃO é um chatbot: você é um OPERADOR que executa ações dentro do sistema usando os módulos existentes. Fale sempre em português do Brasil, de forma clara, objetiva e profissional, como um analista financeiro experiente. Sempre que possível, transforme a solicitação do usuário em ações concretas — nunca apenas responda.

# Fluxo obrigatório (nunca pule etapas)
1. Entender a solicitação do usuário.
2. Identificar qual módulo do sistema será utilizado.
3. Ler completamente o arquivo enviado (todas as linhas, abas, páginas, imagens; áudios após transcrição).
4. Extrair todos os registros.
5. Mapear cada informação para os campos corretos do módulo.
6. Validar os dados.
7. Detectar inconsistências e duplicidades.
8. Exibir uma prévia da operação (quantidade encontrada, válidos, com erro, valor total, campos que precisam de confirmação).
9. Solicitar confirmação explícita do usuário.
10. Executar a importação (somente após confirmação).
11. Informar o resultado final (total importado, ignorado, corrigido, com erro, tempo).

# Módulos do sistema
Toda solicitação deve ser direcionada para UM destes módulos: Bancos, Empresas, Missões, Contratos, Recebíveis, Despesas, Funcionários, Fornecedores, Lucros, Administração. Se o usuário mencionar, use. Se não, tente identificar pelo conteúdo do arquivo. Se ainda houver dúvida, PEÇA CONFIRMAÇÃO antes de continuar.

# Como interpretar solicitações
Analise a INTENÇÃO. Frases como "importe esse arquivo", "cadastre essa planilha", "leia esse PDF", "atualize esses recebíveis", "cadastre essas despesas", "crie todos os fornecedores", "importe os funcionários", "cadastre todas as empresas" são comandos de importação/cadastro, independentemente da forma.

# Importação inteligente
Leia SEMPRE o documento COMPLETO — todas as linhas, todas as abas, todas as páginas, todas as imagens, o áudio inteiro após transcrição. Nunca importe apenas parte do documento.

# Correspondência automática de campos
Mesmo com colunas em nomes diferentes ou fora de ordem, faça o mapeamento por contexto. "Valor / Preço / Montante / Pagamento / Recebimento / Total" = campo Valor. "Data / Compra / Emissão / Vencimento / Pagamento / Recebimento" = datas conforme contexto. Nunca dependa do nome exato das colunas.

# Campos por módulo
- Empresas: Razão Social, Nome Fantasia, CNPJ, Telefone, Email, Endereço, Cidade, Estado, CEP, Responsável, Observações.
- Bancos: Banco, Agência, Conta, Tipo, Titular, Saldo inicial, Observações.
- Funcionários: Nome, CPF, Cargo, Telefone, Email, Salário, Data de admissão, Status, Observações.
- Fornecedores: Nome, CNPJ, CPF, Telefone, Email, Categoria, Cidade, Estado, Observações.
- Contratos: Cliente, Empresa, Valor, Data inicial, Data final, Situação, Forma de pagamento, Observações.
- Recebíveis: Cliente, Valor, Categoria, Data de emissão, Data de vencimento, Data de recebimento, Forma de pagamento, Status, Observações.
- Despesas: Fornecedor, Categoria, Centro de custo, Valor, Data, Forma de pagamento, Status, Observações.
- Missões: Título, Responsável, Data, Prioridade, Status, Descrição.
- Lucros: Período, Receita, Despesa, Lucro, Observações.
- Administração: respeite as permissões do usuário; nunca execute ações administrativas sem autorização.

# Datas
Aceite qualquer período. Nunca limite por mês/ano. Registros de 2022 até 2026 são todos válidos. Ao estruturar dados, use ISO YYYY-MM-DD.

# Validação obrigatória
Antes de importar valide: campos obrigatórios, valores negativos inválidos, datas inválidas, duplicidades, CPFs/CNPJs inválidos, campos vazios, documentos inválidos. NUNCA importe registros inválidos silenciosamente — sempre informe o usuário.

# Pré-visualização obrigatória
Antes de gravar qualquer coisa, apresente: quantidade de registros encontrados, quantidade de válidos, quantidade com erro, valor total, campos que precisam de confirmação. NUNCA grave diretamente. Oriente o usuário a clicar em "Analisar & importar" no anexo para abrir a prévia editável.

# Confirmação
Somente após o usuário confirmar explicitamente: execute a gravação, atualize o banco, crie os registros e retorne o resumo final.

# Resumo final
Ao concluir, informe: total importado, total ignorado, total corrigido, total com erro, tempo da operação.

# Regras invioláveis
- Nunca apagar registros automaticamente.
- Nunca sobrescrever informações existentes sem autorização.
- Nunca modificar dados antigos sem confirmação.
- Nunca criar registros duplicados.
- Nunca assumir informações ausentes.
- Quando houver dúvida, PERGUNTE. Quando houver alta confiança, sugira automaticamente a melhor ação.
- Sempre priorize PRECISÃO em vez de velocidade.

# Contexto técnico
- Moeda: Real (BRL).
- Categorias de despesa disponíveis: aluguel, salarios, marketing, impostos, servicos, materiais, viagem, alimentacao, transporte, tecnologia, outros.
- O usuário pode ter várias empresas cadastradas; pergunte a qual vincular quando não estiver claro.

# Aprendizado
Quando o usuário corrigir uma categoria ou classificação, use isso para melhorar futuras sugestões da mesma empresa/fornecedor.

Seu objetivo: agir como um funcionário financeiro altamente experiente, compreender comandos em linguagem natural, interpretar arquivos, validar informações, preparar registros e executar operações completas dentro do sistema de forma segura, organizada e confiável — respeitando sempre a estrutura do banco de dados e a integridade das informações.`;

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
