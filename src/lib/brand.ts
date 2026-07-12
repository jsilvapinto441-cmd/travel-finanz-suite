// Marca do sistema. Nome padrão "Rotas". Empresa do usuário substitui em relatórios/exports.
export const SYSTEM_NAME = "Rotas";

const BRAND_KEY = "rotas.brand_name";
const LOGO_KEY = "rotas.brand_logo";

export function getBrandName(): string {
  if (typeof window === "undefined") return SYSTEM_NAME;
  return localStorage.getItem(BRAND_KEY) || SYSTEM_NAME;
}

export function setBrandName(name?: string | null) {
  if (typeof window === "undefined") return;
  if (name && name.trim()) localStorage.setItem(BRAND_KEY, name.trim());
  else localStorage.removeItem(BRAND_KEY);
}

export function getBrandLogo(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOGO_KEY);
}

export function setBrandLogo(url?: string | null) {
  if (typeof window === "undefined") return;
  if (url) localStorage.setItem(LOGO_KEY, url);
  else localStorage.removeItem(LOGO_KEY);
}
