import { useEffect } from "react";
import { BUILD_ID } from "@/lib/build-id";

/**
 * Detecção de versão SEM reload automático.
 *
 * Motivo: reloads automáticos fechavam modais/drawers/abas abertas no meio do
 * uso (qualquer divergência momentânea de build derrubava o estado da tela).
 *
 * Hoje apenas registramos no console quando há nova versão disponível.
 * O navegador carrega a versão nova naturalmente no próximo refresh/navegação
 * do usuário (HTML é servido com no-cache pelo proxy do Lovable e os assets
 * têm hash do Vite).
 */
export function useAutoUpdate() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    console.info(`[version] Build ${BUILD_ID}`);
  }, []);
}
