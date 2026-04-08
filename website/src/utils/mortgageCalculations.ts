export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate <= 0) return principal / (years * 12);

  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  return payment;
}

export interface AmortizationRow {
  month: number;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  remainingBalance: number;
}

export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  years: number
): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, years);

  let remaining = principal;

  for (let month = 1; month <= numPayments; month++) {
    const interestPayment = remaining * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    remaining = Math.max(0, remaining - principalPayment);

    schedule.push({
      month,
      principalPayment,
      interestPayment,
      totalPayment: monthlyPayment,
      remainingBalance: remaining,
    });
  }

  return schedule;
}

export function formatCurrency(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
