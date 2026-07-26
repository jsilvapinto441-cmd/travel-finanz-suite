import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/audit";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
    const { data: prof } = await supabase
      .from("profiles")
      .select("empresa_nome, avatar_url")
      .eq("id", uid)
      .maybeSingle();
    setBrandName((prof as any)?.empresa_nome);
    setBrandLogo((prof as any)?.avatar_url);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer to avoid blocking the auth callback
        setTimeout(() => { loadUserData(s.user.id); }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadUserData(session.user.id);
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
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
