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

describe("escopo financeiro por data de vencimento", () => {
  it("inclui o lançamento no mês do vencimento mesmo pago depois", () => {
    expect(
      financialRecordMatchesScope({
        dueDate: "2026-08-10",
        payments: [{ data_pagamento: "2026-09-20", valor: 5, forma_pagamento: "pix" }],
        period: { from: "2026-08-01", to: "2026-08-31" },
        hasPaymentMethodFilter: false,
        paymentMatches: () => true,
      }),
    ).toBe(true);
  });

  it("não inclui lançamento vencido fora do período, mesmo pago no período", () => {
    expect(
      financialRecordMatchesScope({
        dueDate: "2026-01-06",
        payments,
        period: { from: "2026-02-01", to: "2026-02-28" },
        hasPaymentMethodFilter: false,
        paymentMatches: () => true,
      }),
    ).toBe(false);
  });

  it("mantém todos os pagamentos do lançamento, independente da data", () => {
    const scoped = paymentsInFinancialScope(payments, {
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(scoped).toEqual(payments);
    expect(sumFinancialPayments(scoped)).toBe(5);
  });

  it("aplica o filtro de forma de pagamento", () => {
    const pix = paymentsInFinancialScope(
      payments,
      { from: "2026-02-01", to: "2026-02-28" },
      (payment) => payment.forma_pagamento === "pix",
    );
    expect(pix).toEqual([payments[0]]);

    expect(
      financialRecordMatchesScope({
        dueDate: "2026-02-10",
        payments,
        period: { from: "2026-02-01", to: "2026-02-28" },
        hasPaymentMethodFilter: true,
        paymentMatches: (p) => p.forma_pagamento === "dinheiro",
      }),
    ).toBe(false);
  });
});
