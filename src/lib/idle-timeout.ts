import { useEffect, useRef } from "react";

/**
 * Faz logout automático após N minutos sem interação do usuário.
 * Monitora eventos comuns de atividade.
 */
export function useIdleTimeout(minutes: number, onIdle: () => void) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const ms = minutes * 60 * 1000;
    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(onIdle, ms);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [minutes, onIdle]);
}
