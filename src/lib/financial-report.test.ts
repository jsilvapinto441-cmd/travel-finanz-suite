import { describe, expect, it } from "vitest";
import {
  financialRecordMatchesScope,
  paymentsInFinancialScope,
  sumFinancialPayments,
} from "@/lib/financial-report";

const payments = [
  { data_pagamento: "2026-01-06", valor: 2, forma_pagamento: "pix" },
  { data_pagamento: "2026-02-15", valor: 3, forma_pagamento: "boleto" },
];

describe("escopo financeiro por data efetiva", () => {
  it("rateia pagamentos parciais no mês em que ocorreram", () => {
    const january = paymentsInFinancialScope(payments, {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    const february = paymentsInFinancialScope(payments, {
      from: "2026-02-01",
      to: "2026-02-28",
    });

    expect(sumFinancialPayments(january)).toBe(2);
    expect(sumFinancialPayments(february)).toBe(3);
  });

  it("inclui em fevereiro um lançamento vencido em janeiro que recebeu em fevereiro", () => {
    expect(
      financialRecordMatchesScope({
        dueDate: "2026-01-06",
        payments,
        period: { from: "2026-02-01", to: "2026-02-28" },
        hasPaymentMethodFilter: false,
        paymentMatches: () => true,
      }),
    ).toBe(true);
  });

  it("não inclui pagamentos fora do período na exportação", () => {
    const scoped = paymentsInFinancialScope(payments, {
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(scoped).toEqual([payments[1]]);
  });

  it("combina período e forma de pagamento", () => {
    const pixInFebruary = paymentsInFinancialScope(
      payments,
      { from: "2026-02-01", to: "2026-02-28" },
      (payment) => payment.forma_pagamento === "pix",
    );
    expect(pixInFebruary).toEqual([]);
  });

  it("mantém o saldo atual independente do rateio mensal", () => {
    const currentBalance = 10 - sumFinancialPayments(payments);
    expect(currentBalance).toBe(5);
  });
});