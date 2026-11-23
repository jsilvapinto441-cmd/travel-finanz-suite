import { describe, it, expect } from "vitest";
import { classificarEtapa, montarMensagem, deveEnviar, hojeSaoPaulo } from "./due-items";

describe("régua de avisos", () => {
  const hoje = "2026-11-23";
  it("classifica as etapas pela data de vencimento", () => {
    expect(classificarEtapa("2026-11-26", hoje)).toBe("antecipado");
    expect(classificarEtapa("2026-11-24", hoje)).toBe("vespera");
    expect(classificarEtapa("2026-11-23", hoje)).toBe("hoje");
    expect(classificarEtapa("2026-11-22", hoje)).toBe("atrasado");
    expect(classificarEtapa("2026-11-10", hoje)).toBe("atraso_continuo");
    expect(classificarEtapa("2026-11-25", hoje)).toBeNull();
  });
  it("usa o fuso de São Paulo (01:00 UTC ainda é o dia anterior)", () => {
    expect(hojeSaoPaulo(new Date("2026-11-24T01:00:00Z"))).toBe("2026-11-23");
  });
  it("atraso contínuo repete só a cada 3 dias", () => {
    const now = new Date("2026-11-23T11:00:00Z");
    expect(deveEnviar("atraso_continuo", [{ etapa: "atrasado", enviado_em: "2026-11-21T11:00:00Z" }], now)).toBe(false);
    expect(deveEnviar("atraso_continuo", [{ etapa: "atraso_continuo", enviado_em: "2026-11-20T11:00:00Z" }], now)).toBe(true);
  });
  it("etapas únicas não se repetem", () => {
    expect(deveEnviar("hoje", [{ etapa: "hoje", enviado_em: "2026-11-23T11:00:00Z" }])).toBe(false);
  });
  it("mensagem de etapa única soma valores e concorda no plural", () => {
    const m = montarMensagem("recebivel", [
      { id: "a", vencimento: "2026-11-26", valor: 1500, etapa: "antecipado" },
      { id: "b", vencimento: "2026-11-26", valor: 3000, etapa: "antecipado" },
    ]);
    expect(m?.titulo).toBe("🔔 Recebíveis a vencer");
    expect(m?.corpo).toBe("2 recebíveis vencem em 3 dias · Total R$ 4.500,00");
  });
  it("singular sem 'Total' e feminino em despesas", () => {
    expect(montarMensagem("recebivel", [{ id: "a", vencimento: "x", valor: 1200, etapa: "hoje" }])?.corpo).toBe("1 recebível vence hoje · R$ 1.200,00");
    expect(montarMensagem("despesa", [
      { id: "a", vencimento: "x", valor: 100, etapa: "atraso_continuo" },
      { id: "b", vencimento: "x", valor: 50, etapa: "atraso_continuo" },
    ])?.corpo).toBe("2 despesas atrasadas · Total R$ 150,00");
  });
  it("resumo combinado na ordem atrasados → hoje → amanhã → 3 dias", () => {
    const m = montarMensagem("recebivel", [
      { id: "a", vencimento: "x", valor: 450, etapa: "vespera" },
      { id: "b", vencimento: "x", valor: 5000, etapa: "atraso_continuo" },
      { id: "c", vencimento: "x", valor: 300, etapa: "atrasado" },
      { id: "d", vencimento: "x", valor: 1800, etapa: "hoje" },
    ]);
    expect(m?.titulo).toBe("💰 Recebíveis");
    expect(m?.corpo).toBe("2 atrasados (R$ 5.300,00) · 1 vence hoje (R$ 1.800,00) · 1 vence amanhã (R$ 450,00)");
  });
});
