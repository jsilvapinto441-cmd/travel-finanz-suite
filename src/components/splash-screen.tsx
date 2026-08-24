import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import rotasLogo from "@/assets/rotas-logo-transparent.png.asset.json";

const ENTER_MS = 1200;
const EXIT_MS = 2700;
const TOTAL_MS = 3000;

export function SplashScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const holdTimer = setTimeout(() => setPhase("hold"), ENTER_MS);
    const exitTimer = setTimeout(() => setPhase("exit"), EXIT_MS);
    const redirectTimer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const target = data.session ? "/dashboard" : "/login";
      navigate({ to: target });
    }, TOTAL_MS);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div
      className="splash-screen"
      role="progressbar"
      aria-busy="true"
      aria-label="Carregando Rotas"
    >
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-ring" aria-hidden="true" />

      <div className={`splash-logo-wrap ${mounted ? "mounted" : ""} ${phase}`}>
        <div className="splash-logo-3d">
          <img
            src={rotasLogo.url}
            alt="Rotas"
            className="splash-logo"
            width="320"
            height="120"
          />
          <div className="splash-logo-shine" aria-hidden="true" />
        </div>
      </div>

      <div className={`splash-tagline ${phase}`}>
        Gestão Administrativa e Financeira
      </div>

      <div className="splash-progress" aria-hidden="true">
        <div className={`splash-progress-bar ${phase}`} />
      </div>
    </div>
  );
}
