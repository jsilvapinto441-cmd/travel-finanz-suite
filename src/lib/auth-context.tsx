import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/audit";
import { toast } from "sonner";
import { setBrandName, setBrandLogo } from "@/lib/brand";

type AppRole = "admin" | "financeiro" | "viewer";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

const SESSION_STORAGE_KEY = "produz.active_session_id";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function forceLogout(reason: string) {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    // Limpa quaisquer chaves supabase persistidas
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k.startsWith("supabase."))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {}
  try { await supabase.auth.signOut(); } catch {}
  toast.error(reason, { duration: 8000 });
  // Redireciona para login
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // ---- Sessão única por usuário ------------------------------------------
  const claimSession = async (userId: string) => {
    const sid = generateSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, sid);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    await supabase.from("user_active_sessions").upsert(
      { user_id: userId, session_id: sid, user_agent: ua, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    return sid;
  };

  const validateSession = async (userId: string) => {
    const localSid = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!localSid) {
      await forceLogout("Sua sessão foi encerrada porque sua conta foi acessada em outro dispositivo.");
      return false;
    }
    const { data } = await supabase
      .from("user_active_sessions")
      .select("session_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data || data.session_id !== localSid) {
      await forceLogout("Sua sessão foi encerrada porque sua conta foi acessada em outro dispositivo.");
      return false;
    }
    return true;
  };

  const subscribeToSessionChanges = (userId: string) => {
    // Limpa canal antigo
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`user_active_session:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_active_sessions", filter: `user_id=eq.${userId}` },
        (payload) => {
          const localSid = localStorage.getItem(SESSION_STORAGE_KEY);
          const newRow = (payload.new ?? {}) as { session_id?: string };
          if (payload.eventType === "DELETE") {
            forceLogout("Sua sessão foi encerrada porque sua conta foi acessada em outro dispositivo.");
            return;
          }
          if (newRow.session_id && localSid && newRow.session_id !== localSid) {
            forceLogout("Sua sessão foi encerrada porque sua conta foi acessada em outro dispositivo.");
          }
        },
      )
      .subscribe();
    channelRef.current = ch;
  };
  // ------------------------------------------------------------------------

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        const uid = s.user.id;
        // Defer para não bloquear o callback do auth
        setTimeout(async () => {
          const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
          setRoles((data ?? []).map((r) => r.role as AppRole));
          const { data: prof } = await supabase.from("profiles").select("empresa_nome, avatar_url").eq("id", uid).maybeSingle();
          setBrandName((prof as any)?.empresa_nome);
          setBrandLogo((prof as any)?.avatar_url);

          if (event === "SIGNED_IN") {
            // Novo login → invalida sessões anteriores gerando novo session_id
            await claimSession(uid);
            currentUserIdRef.current = uid;
            subscribeToSessionChanges(uid);
          } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
            // Valida sessão atual
            await validateSession(uid);
          }
        }, 0);
      } else {
        setRoles([]);
        currentUserIdRef.current = null;
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const uid = session.user.id;
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        setRoles((data ?? []).map((r) => r.role as AppRole));
        const { data: prof } = await supabase.from("profiles").select("empresa_nome, avatar_url").eq("id", uid).maybeSingle();
        setBrandName((prof as any)?.empresa_nome);
        setBrandLogo((prof as any)?.avatar_url);

        // Se já existe session_id local, valida; senão, reivindica (primeiro carregamento após login)
        const localSid = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!localSid) {
          await claimSession(uid);
        } else {
          const ok = await validateSession(uid);
          if (!ok) { setLoading(false); return; }
        }
        currentUserIdRef.current = uid;
        subscribeToSessionChanges(uid);
      }
      setLoading(false);
    });

    // Revalida quando a aba volta ao foco
    const onVisibility = () => {
      if (document.visibilityState === "visible" && currentUserIdRef.current) {
        validateSession(currentUserIdRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const canEdit = !!session?.user;

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        roles,
        loading,
        isAdmin,
        canEdit,
        signOut: async () => {
          try {
            const uid = session?.user?.id;
            if (uid) {
              // Remove registro para não confundir próximo login
              await supabase.from("user_active_sessions").delete().eq("user_id", uid);
            }
          } catch {}
          try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
          await audit("logout", "auth");
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
