export type FinancialPayment = {
  data_pagamento: string | null;
  valor: number;
  forma_pagamento: string | null;
};

export type FinancialPeriod = {
  from?: string;
  to?: string;
};

export function isDateInFinancialPeriod(
  date: string | null | undefined,
  period: FinancialPeriod,
): boolean {
  if (!period.from && !period.to) return true;
  if (!date) return false;
  const day = date.slice(0, 10);
  if (period.from && day < period.from) return false;
  if (period.to && day > period.to) return false;
  return true;
}

/**
 * Pagamentos considerados no relatório.
 *
 * O período do relatório é definido pela data de VENCIMENTO do lançamento,
 * portanto os pagamentos são sempre considerados integralmente, mesmo que
 * tenham ocorrido antes ou depois do período. O filtro por forma de
 * pagamento continua sendo aplicado.
 */
export function paymentsInFinancialScope<T extends FinancialPayment>(
  payments: readonly T[] | null | undefined,
  _period: FinancialPeriod,
  paymentMatches: (payment: T) => boolean = () => true,
): T[] {
  return (payments ?? []).filter((payment) => paymentMatches(payment));
}

/**
 * Um lançamento pertence ao período quando seu VENCIMENTO está no intervalo.
 * O status/pagamento não altera essa pertinência.
 */
export function financialRecordMatchesScope<T extends FinancialPayment>({
  dueDate,
  payments,
  period,
  hasPaymentMethodFilter,
  paymentMatches,
}: {
  dueDate: string | null | undefined;
  payments: readonly T[] | null | undefined;
  period: FinancialPeriod;
  hasPaymentMethodFilter: boolean;
  paymentMatches: (payment: T) => boolean;
}): boolean {
  if (hasPaymentMethodFilter && !(payments ?? []).some((p) => paymentMatches(p))) return false;
  if (!period.from && !period.to) return true;
  return isDateInFinancialPeriod(dueDate, period);
}


export function sumFinancialPayments(payments: readonly FinancialPayment[]): number {
  return payments.reduce((total, payment) => total + Number(payment.valor ?? 0), 0);
}