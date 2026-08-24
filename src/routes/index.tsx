import { createFileRoute } from "@tanstack/react-router";
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
  component: SplashScreen,
});
