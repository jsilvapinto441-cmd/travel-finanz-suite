/** Regras puras da régua de avisos de vencimento (sem acesso a banco). */
export type Etapa = "antecipado" | "vespera" | "hoje" | "atrasado" | "atraso_continuo";
export type TipoItem = "recebivel" | "despesa";
export interface ItemAviso { id: string; vencimento: string; valor: number; etapa: Etapa }

/** Data de hoje (AAAA-MM-DD) no fuso America/Sao_Paulo. */
export function hojeSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtc(d: string): number {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, dd ?? 1);
}

export function addDias(d: string, n: number): string {
  return new Date(toUtc(d) + n * 86400000).toISOString().slice(0, 10);
}

/** Diferença em dias: vencimento − hoje. */
export function diasAte(vencimento: string, hoje: string): number {
  return Math.round((toUtc(vencimento) - toUtc(hoje)) / 86400000);
}

/** Etapa do item hoje, ou null se não entra na régua. */
export function classificarEtapa(vencimento: string, hoje: string): Etapa | null {
  const d = diasAte(vencimento, hoje);
  if (d === 3) return "antecipado";
  if (d === 1) return "vespera";
  if (d === 0) return "hoje";
  if (d === -1) return "atrasado";
  if (d < -1) return "atraso_continuo";
  return null;
}

export const STATUS_FORA_DA_REGUA = ["pago", "cancelado"];

export function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v).replace(/\u00a0/g, " ");
}

const NOMES = {
  recebivel: { s: "recebível", p: "recebíveis", atrasadoS: "atrasado", atrasadoP: "atrasados", resumo: "💰 Recebíveis" },
  despesa: { s: "despesa", p: "despesas", atrasadoS: "atrasada", atrasadoP: "atrasadas", resumo: "📅 Despesas" },
} as const;

/** Monta título e corpo do push (seção 4 da especificação). */
export function montarMensagem(tipo: TipoItem, itens: ItemAviso[]): { titulo: string; corpo: string; temAtrasados: boolean } | null {
  if (itens.length === 0) return null;
  const n = NOMES[tipo];
  const soma = (xs: ItemAviso[]) => xs.reduce((a, i) => a + i.valor, 0);
  const por = (e: Etapa) => itens.filter((i) => i.etapa === e);
  const nome = (q: number) => (q === 1 ? n.s : n.p);
  const vence = (q: number) => (q === 1 ? "vence" : "vencem");
  const atr = (q: number) => (q === 1 ? n.atrasadoS : n.atrasadoP);
  const valorTxt = (xs: ItemAviso[]) => (xs.length === 1 ? formatBRL(soma(xs)) : `Total ${formatBRL(soma(xs))}`);
  const etapas = new Set(itens.map((i) => i.etapa));
  const temAtrasados = etapas.has("atrasado") || etapas.has("atraso_continuo");

  if (etapas.size === 1) {
    const e = itens[0]!.etapa;
    const q = itens.length;
    const cap = n.s.charAt(0).toUpperCase() + n.s.slice(1);
    const map: Record<Etapa, [string, string]> = {
      antecipado: [`🔔 ${cap === "Recebível" ? "Recebíveis" : "Despesas"} a vencer`, `${q} ${nome(q)} ${vence(q)} em 3 dias`],
      vespera: ["📅 Lembrete", `${q} ${nome(q)} ${vence(q)} amanhã`],
      hoje: ["⏰ Atenção", `${q} ${nome(q)} ${vence(q)} hoje`],
      atrasado: [`⚠️ ${q === 1 ? cap : (cap === "Recebível" ? "Recebíveis" : "Despesas")} ${atr(q)}`, `${q} ${nome(q)} ${atr(q)} desde ontem`],
      atraso_continuo: ["🔴 Cobrança pendente", `${q} ${nome(q)} ${atr(q)}`],
    };
    const [titulo, base] = map[e];
    return { titulo, corpo: `${base} · ${valorTxt(itens)}`, temAtrasados };
  }

  const partes: string[] = [];
  const a = [...por("atrasado"), ...por("atraso_continuo")];
  if (a.length) partes.push(`${a.length} ${atr(a.length)} (${formatBRL(soma(a))})`);
  const h = por("hoje");
  if (h.length) partes.push(`${h.length} ${vence(h.length)} hoje (${formatBRL(soma(h))})`);
  const v = por("vespera");
  if (v.length) partes.push(`${v.length} ${vence(v.length)} amanhã (${formatBRL(soma(v))})`);
  const t = por("antecipado");
  if (t.length) partes.push(`${t.length} ${vence(t.length)} em 3 dias (${formatBRL(soma(t))})`);
  return { titulo: n.resumo, corpo: partes.join(" · "), temAtrasados };
}

/** Regra de repetição: etapas únicas só uma vez; atraso contínuo a cada 3 dias. */
export function deveEnviar(etapa: Etapa, envios: { etapa: string; enviado_em: string }[], now: Date = new Date()): boolean {
  if (etapa !== "atraso_continuo") return !envios.some((e) => e.etapa === etapa);
  if (envios.length === 0) return true;
  const ultimo = Math.max(...envios.map((e) => new Date(e.enviado_em).getTime()));
  const hoje = hojeSaoPaulo(now);
  return diasAte(hoje, hojeSaoPaulo(new Date(ultimo))) >= 3;
}
