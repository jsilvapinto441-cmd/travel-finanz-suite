// Marca do sistema. Nome padrão "Rotas". Empresa do usuário substitui em relatórios/exports.
import { useEffect, useState } from "react";

export const SYSTEM_NAME = "Rotas";

const BRAND_KEY = "rotas.brand_name";
const LOGO_KEY = "rotas.brand_logo";
const EVT = "rotas:brand-changed";

export function getBrandName(): string {
  if (typeof window === "undefined") return SYSTEM_NAME;
  return localStorage.getItem(BRAND_KEY) || SYSTEM_NAME;
}

export function setBrandName(name?: string | null) {
  if (typeof window === "undefined") return;
  if (name && name.trim()) localStorage.setItem(BRAND_KEY, name.trim());
  else localStorage.removeItem(BRAND_KEY);
  window.dispatchEvent(new Event(EVT));
}

export function getBrandLogo(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOGO_KEY);
}

export function setBrandLogo(url?: string | null) {
  if (typeof window === "undefined") return;
  if (url) localStorage.setItem(LOGO_KEY, url);
  else localStorage.removeItem(LOGO_KEY);
  window.dispatchEvent(new Event(EVT));
}

export function useBrand() {
  const [state, setState] = useState<{ name: string; logo: string | null }>(
    { name: SYSTEM_NAME, logo: null },
  );
  useEffect(() => {
    const sync = () => setState({ name: getBrandName(), logo: getBrandLogo() });
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return state;
}

