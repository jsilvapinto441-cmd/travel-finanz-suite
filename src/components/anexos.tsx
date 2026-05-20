import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, Loader2, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

// Whitelist de extensões aceitas (faturas, contratos, comprovantes)
const ALLOWED_EXT = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "gif",
  "doc", "docx", "xls", "xlsx", "csv", "txt", "odt", "ods",
]);

// Blacklist explícita de executáveis e scripts
const BLOCKED_EXT = new Set([
  "exe","bat","cmd","com","msi","scr","ps1","sh","bash","zsh",
  "js","mjs","cjs","ts","jsx","tsx","html","htm","svg","php","py","rb","jar","apk","dmg","app",
]);

type Anexo = {
  id: string; entidade: string; entidade_id: string;
  path: string; nome: string; mime: string | null; tamanho: number | null;
  user_id: string | null; created_at: string;
};

function formatSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE) return `${file.name}: excede 20MB`;
  if (file.size === 0) return `${file.name}: arquivo vazio`;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ext) return `${file.name}: extensão obrigatória`;
  if (BLOCKED_EXT.has(ext)) return `${file.name}: tipo de arquivo bloqueado`;
  if (!ALLOWED_EXT.has(ext)) return `${file.name}: extensão .${ext} não permitida`;
  return null;
}


export function useAnexosCount(entidade: string, entidade_id: string) {
  return useQuery({
    queryKey: ["anexos-count", entidade, entidade_id],
    queryFn: async () => {
      const { count } = await supabase
        .from("anexos").select("id", { count: "exact", head: true })
        .eq("entidade", entidade).eq("entidade_id", entidade_id);
      return count ?? 0;
    },
  });
}

export function AnexosCell({ entidade, entidade_id }: { entidade: string; entidade_id: string }) {
  const { data: count } = useAnexosCount(entidade, entidade_id);
  return (
    <AnexosManager entidade={entidade} entidade_id={entidade_id}>
      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
        <Paperclip className="size-3.5" />
        {count ?? 0}
      </Button>
    </AnexosManager>
  );
}

export function AnexosManager({
  entidade, entidade_id, children,
}: { entidade: string; entidade_id: string; children: React.ReactNode }) {
  const qc = useQueryClient();
  const { canEdit, isAdmin, user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: anexos, isLoading } = useQuery({
    queryKey: ["anexos", entidade, entidade_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anexos").select("*")
        .eq("entidade", entidade).eq("entidade_id", entidade_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Anexo[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${entidade}/${entidade_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("anexos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("anexos").insert({
        entidade, entidade_id, path, nome: file.name,
        mime: file.type, tamanho: file.size, user_id: user?.id,
      });
      if (dbErr) {
        await supabase.storage.from("anexos").remove([path]);
        throw dbErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anexos", entidade, entidade_id] });
      qc.invalidateQueries({ queryKey: ["anexos-count", entidade, entidade_id] });
      toast.success("Anexo enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (a: Anexo) => {
      await supabase.storage.from("anexos").remove([a.path]);
      const { error } = await supabase.from("anexos").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anexos", entidade, entidade_id] });
      qc.invalidateQueries({ queryKey: ["anexos-count", entidade, entidade_id] });
      toast.success("Anexo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(a: Anexo) {
    const { data, error } = await supabase.storage.from("anexos")
      .createSignedUrl(a.path, 60);
    if (error || !data) { toast.error("Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: máx 20MB`); continue; }
      await upload.mutateAsync(f);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <h4 className="font-display font-semibold text-sm">Anexos</h4>
            <p className="text-xs text-muted-foreground">Faturas, contratos, comprovantes</p>
          </div>
          {canEdit && (
            <>
              <input ref={inputRef} type="file" multiple className="hidden"
                onChange={(e) => handleFiles(e.target.files)} />
              <Button size="sm" onClick={() => inputRef.current?.click()}
                disabled={uploading} className="gradient-emerald text-primary-foreground h-8">
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                <span className="ml-1.5 text-xs">Enviar</span>
              </Button>
            </>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></div>
          ) : !anexos?.length ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Nenhum anexo</div>
          ) : (
            <ul className="divide-y">
              {anexos.map((a) => (
                <li key={a.id} className="p-3 flex items-center gap-2 hover:bg-muted/30">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <button onClick={() => download(a)}
                      className="text-sm font-medium truncate block w-full text-left hover:underline">
                      {a.nome}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {formatSize(a.tamanho)} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => download(a)}>
                    <Download className="size-3.5" />
                  </Button>
                  {(isAdmin || a.user_id === user?.id) && (
                    <Button size="icon" variant="ghost"
                      className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => remove.mutate(a)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
