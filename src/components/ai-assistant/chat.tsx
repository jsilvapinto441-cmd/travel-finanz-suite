import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Paperclip,
  Mic,
  Send,
  Loader2,
  MessageSquarePlus,
  Trash2,
  Sparkles,
  Square,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  listThreads,
  createThread,
  deleteThread,
  getThreadMessages,
  renameThread,
} from "@/lib/ai-assistant.functions";
import {
  ImportPreviewDialog,
  type ImportItem,
} from "@/components/ai-assistant/import-preview";
import type { ImportModule } from "@/lib/ai-assistant.functions";
import {
  fileToBase64,
  parseSpreadsheetToText,
  startAudioRecorder,
  type AudioRecorderHandle,
} from "@/components/ai-assistant/utils";
import logo from "@/assets/produz-logo-white.png";

type UIMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentLabel?: string;
};

const SUGGESTIONS = [
  { icon: "📥", label: "Importar planilha financeira", prompt: "Quero importar uma planilha financeira. O que posso enviar?" },
  { icon: "💸", label: "Cadastrar despesa", prompt: "Quero cadastrar uma nova despesa." },
  { icon: "💰", label: "Cadastrar receita", prompt: "Quero registrar uma nova receita." },
  { icon: "📄", label: "Ler PDF", prompt: "Vou anexar um PDF para você analisar." },
  { icon: "🎤", label: "Enviar áudio", prompt: "Vou gravar um áudio explicando o que preciso." },
  { icon: "📊", label: "Gerar relatório", prompt: "Me dê um resumo das despesas do mês atual." },
];

export function AssistantChat({
  onClose,
  onProcessingChange,
}: {
  onClose?: () => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const qc = useQueryClient();
  const listT = useServerFn(listThreads);
  const createT = useServerFn(createThread);
  const deleteT = useServerFn(deleteThread);
  const getMsgs = useServerFn(getThreadMessages);


  const threadsQ = useQuery({ queryKey: ["ai-threads"], queryFn: () => listT() });
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Auto-select first or create one
  useEffect(() => {
    if (!threadsQ.data) return;
    if (activeThreadId) return;
    if (threadsQ.data.length > 0) {
      setActiveThreadId(threadsQ.data[0].id);
    }
  }, [threadsQ.data, activeThreadId]);

  const createMut = useMutation({
    mutationFn: async () => createT({ data: { title: "Nova conversa" } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["ai-threads"] });
      setActiveThreadId(t.id);
    },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteT({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-threads"] });
      setActiveThreadId(null);
    },
  });

  const [showThreads, setShowThreads] = useState(false);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar text-sidebar-foreground">
        <img src={logo} alt="PRODUZ" className="h-7 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Assistente Financeiro IA
          </div>
          <div className="text-[11px] text-sidebar-foreground/60 truncate">
            Importa arquivos, cadastra receitas e despesas, executa tarefas.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setShowThreads((v) => !v)}
            title="Conversas"
          >
            <MessageSquarePlus className="size-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={onClose}
              title="Fechar"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Thread list overlay */}
      {showThreads && (
        <div className="border-b border-border bg-muted/30 max-h-56 overflow-y-auto">
          <div className="p-2 space-y-1">
            <Button
              variant="default"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                createMut.mutate();
                setShowThreads(false);
              }}
            >
              <MessageSquarePlus className="size-4 mr-2" /> Nova conversa
            </Button>
            {(threadsQ.data ?? []).map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent",
                  activeThreadId === t.id && "bg-accent",
                )}
                onClick={() => {
                  setActiveThreadId(t.id);
                  setShowThreads(false);
                }}
              >
                <span className="flex-1 truncate">{t.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Excluir esta conversa?")) deleteMut.mutate(t.id);
                  }}
                  aria-label="Excluir"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {(threadsQ.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground p-2">
                Nenhuma conversa ainda.
              </div>
            )}
          </div>
        </div>
      )}

      {activeThreadId ? (
        <ChatThreadView
          key={activeThreadId}
          threadId={activeThreadId}
          getMessages={(id) => getMsgs({ data: { threadId: id } })}
          onProcessingChange={onProcessingChange}
        />
      ) : (

        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <div className="text-sm text-muted-foreground mb-3">
              Nenhuma conversa selecionada.
            </div>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
              Iniciar nova conversa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatThreadView({
  threadId,
  getMessages,
  onProcessingChange,
}: {
  threadId: string;
  getMessages: (id: string) => Promise<Array<{ id: string; role: string; content: string }>>;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const qc = useQueryClient();
  const renameT = useServerFn(renameThread);
  const [messages, setMessages] = useState<UIMsg[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [attached, setAttached] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null); // status label
  const isProcessingInternal = busy || streaming || !!processing;
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<AudioRecorderHandle | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    onProcessingChange?.(isProcessingInternal);
  }, [isProcessingInternal, onProcessingChange]);

  useEffect(() => {
    return () => onProcessingChange?.(false);
  }, [onProcessingChange]);


  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewModule, setPreviewModule] = useState<ImportModule>("despesas");
  const [previewItems, setPreviewItems] = useState<ImportItem[]>([]);
  const [previewSummary, setPreviewSummary] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    setLoadingInitial(true);
    getMessages(threadId)
      .then((rows) => {
        if (!alive) return;
        setMessages(
          rows.map((r) => ({
            id: r.id,
            role: r.role === "user" ? "user" : "assistant",
            content: r.content,
          })),
        );
      })
      .catch((e) => toast.error(`Erro ao carregar mensagens: ${(e as Error).message}`))
      .finally(() => alive && setLoadingInitial(false));
    return () => {
      alive = false;
    };
  }, [threadId, getMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, busy]);

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? `Bearer ${token}` : "";
  }, []);

  const sendMessage = useCallback(
    async (text: string, attachmentLabel?: string) => {
      if (!text.trim() && !attachmentLabel) return;
      const userMsg: UIMsg = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
        attachmentLabel,
      };
      const asstMsg: UIMsg = {
        id: `local-${Date.now()}-a`,
        role: "assistant",
        content: "",
      };
      const isFirstMessage = messages.length === 0;
      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setInput("");
      setBusy(true);
      setStreaming(true);

      // Auto-título no primeiro envio (como ChatGPT): usa a mensagem do usuário.
      if (isFirstMessage && text.trim()) {
        const rawTitle = text.trim().replace(/\s+/g, " ");
        const title = rawTitle.length > 50 ? rawTitle.slice(0, 50) + "…" : rawTitle;
        renameT({ data: { id: threadId, title } })
          .then(() => qc.invalidateQueries({ queryKey: ["ai-threads"] }))
          .catch(() => {});
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const auth = await authHeader();
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ threadId, messages: history }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `Erro ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
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
              if (typeof delta === "string" && delta.length > 0) {
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    ...copy[copy.length - 1],
                    content: copy[copy.length - 1].content + delta,
                  };
                  return copy;
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        toast.error(`Falha: ${(e as Error).message}`);
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && !last.content) {
            copy[copy.length - 1] = {
              ...last,
              content: "_Ocorreu um erro. Tente novamente._",
            };
          }
          return copy;
        });
      } finally {
        setBusy(false);
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, threadId, authHeader, renameT, qc],
  );

  const stopStreaming = () => abortRef.current?.abort();

  const handleAttach = async (file: File) => {
    setAttached(file);
    toast.info(`${file.name} anexado. Descreva o que fazer ou clique em Analisar & importar.`);
  };

  const runExtractOnAttachment = async () => {
    if (!attached) return;
    setProcessing("Analisando documento…");
    try {
      const auth = await authHeader();
      let payload: Record<string, unknown> = {};

      const lower = attached.name.toLowerCase();
      if (
        lower.endsWith(".xlsx") ||
        lower.endsWith(".xls") ||
        lower.endsWith(".csv") ||
        attached.type === "text/csv"
      ) {
        const text = await parseSpreadsheetToText(attached);
        payload = { text };
      } else if (attached.type.startsWith("image/") || attached.type === "application/pdf") {
        const base64 = await fileToBase64(attached);
        payload = {
          file: { filename: attached.name, mime: attached.type, base64 },
        };
      } else {
        // fallback: read as text
        try {
          const text = await attached.text();
          payload = { text };
        } catch {
          throw new Error("Tipo de arquivo não suportado para extração.");
        }
      }

      const res = await fetch("/api/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Erro ${res.status}`);
      }
      const data = (await res.json()) as {
        module?: ImportModule | "misto";
        summary?: string;
        questions?: string[];
        items?: ImportItem[];
      };
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        toast.warning("Nenhum registro identificado no arquivo.");
        return;
      }
      // "misto" cai como despesas no default e o usuário pode trocar no seletor.
      const mod: ImportModule =
        data.module && data.module !== "misto" ? data.module : "despesas";
      setPreviewModule(mod);
      setPreviewItems(items);
      setPreviewSummary(data.summary);
      setPreviewOpen(true);
    } catch (e) {
      toast.error(`Falha ao analisar: ${(e as Error).message}`);
    } finally {
      setProcessing(null);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      const handle = recorderRef.current;
      if (!handle) return;
      setRecording(false);
      setProcessing("Transcrevendo áudio…");
      try {
        const blob = await handle.stop();
        const fd = new FormData();
        fd.append("file", blob, "audio.webm");
        const auth = await authHeader();
        const res = await fetch("/api/ai-transcribe", {
          method: "POST",
          headers: { Authorization: auth },
          body: fd,
        });
        if (!res.ok) throw new Error(await res.text());
        const { text } = (await res.json()) as { text?: string };
        setInput((prev) => (prev ? `${prev} ${text ?? ""}` : (text ?? "")));
        textareaRef.current?.focus();
      } catch (e) {
        toast.error(`Falha na transcrição: ${(e as Error).message}`);
      } finally {
        setProcessing(null);
        recorderRef.current = null;
      }
    } else {
      try {
        recorderRef.current = await startAudioRecorder();
        setRecording(true);
        toast.info("Gravando áudio… clique novamente para parar.");
      } catch (e) {
        toast.error(`Microfone indisponível: ${(e as Error).message}`);
      }
    }
  };

  const showSuggestions = useMemo(() => messages.length === 0 && !loadingInitial, [messages, loadingInitial]);

  return (
    <>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingInitial && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando conversa…
          </div>
        )}

        {showSuggestions && (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-sm font-semibold">Como posso ajudar?</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie mensagens, planilhas, PDFs, imagens ou áudios. Posso
                classificar lançamentos e importar após sua confirmação.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  className="text-left border border-border rounded-md px-3 py-2 text-sm hover:border-primary hover:bg-accent transition-colors"
                >
                  <span className="mr-2">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
              )}
            >
              {m.attachmentLabel && (
                <div className="text-[11px] opacity-80 mb-1 flex items-center gap-1">
                  <Paperclip className="size-3" /> {m.attachmentLabel}
                </div>
              )}
              {m.role === "assistant" ? (
                m.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Pensando…
                  </div>
                )
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          </div>
        ))}

        {processing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {processing}
          </div>
        )}
      </div>

      {/* Attachment banner */}
      {attached && (
        <div className="border-t border-border bg-muted/40 px-3 py-2 flex items-center gap-2 text-sm">
          {attached.type.startsWith("image/") ? (
            <ImageIcon className="size-4 text-primary" />
          ) : attached.name.match(/\.(xlsx|xls|csv)$/i) ? (
            <FileSpreadsheet className="size-4 text-primary" />
          ) : (
            <FileText className="size-4 text-primary" />
          )}
          <span className="flex-1 truncate">{attached.name}</span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            onClick={runExtractOnAttachment}
            disabled={!!processing}
          >
            Analisar & importar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() =>
              sendMessage(input || `Analise este arquivo: ${attached.name}`, attached.name)
            }
            disabled={busy}
          >
            Enviar ao chat
          </Button>
          <button
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setAttached(null)}
            aria-label="Remover anexo"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border bg-background p-3">
        <div className="flex items-end gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,.pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAttach(f);
                e.target.value = "";
              }}
            />
            <Button variant="ghost" size="icon" asChild className="h-9 w-9" title="Anexar">
              <span>
                <Paperclip className="size-4" />
              </span>
            </Button>
          </label>
          <Button
            variant={recording ? "destructive" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={toggleRecording}
            title={recording ? "Parar gravação" : "Gravar áudio"}
          >
            {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Descreva o que precisa… (Enter para enviar)"
            className="min-h-[42px] max-h-40 resize-none flex-1"
            disabled={busy}
          />
          {streaming ? (
            <Button size="icon" variant="destructive" className="h-9 w-9" onClick={stopStreaming} title="Parar">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={() => sendMessage(input)}
              disabled={busy || !input.trim()}
              title="Enviar"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        module={previewModule}
        items={previewItems}
        summary={previewSummary}
        onConfirmed={(r) => {
          setAttached(null);
          sendMessage(
            `Importação confirmada: ${r.inserted} registro(s) cadastrado(s) em ${r.module}.`,
          );
        }}
      />
    </>
  );
}
