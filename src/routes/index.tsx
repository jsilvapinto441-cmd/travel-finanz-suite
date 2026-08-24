import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SplashScreen } from "@/components/splash-screen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rotas" },
      { name: "description", content: "Sistema interno de gestão financeira e operacional Rotas." },
      { property: "og:title", content: "Rotas" },
      { property: "og:description", content: "Sistema interno de gestão financeira e operacional Rotas." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SplashScreen,
});
