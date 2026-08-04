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

export function paymentsInFinancialScope<T extends FinancialPayment>(
  payments: readonly T[] | null | undefined,
  period: FinancialPeriod,
  paymentMatches: (payment: T) => boolean = () => true,
): T[] {
  return (payments ?? []).filter(
    (payment) =>
      isDateInFinancialPeriod(payment.data_pagamento, period) && paymentMatches(payment),
  );
}

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
  const scopedPayments = paymentsInFinancialScope(payments, period, paymentMatches);
  if (hasPaymentMethodFilter) return scopedPayments.length > 0;
  if (!period.from && !period.to) return true;
  return isDateInFinancialPeriod(dueDate, period) || scopedPayments.length > 0;
}

export function sumFinancialPayments(payments: readonly FinancialPayment[]): number {
  return payments.reduce((total, payment) => total + Number(payment.valor ?? 0), 0);
}