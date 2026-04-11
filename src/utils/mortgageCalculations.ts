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

export type GraceType = "none" | "full" | "interest-only";

/**
 * Generate amortization schedule with optional grace period.
 * - "full" grace: no payments at all during grace, interest capitalizes onto principal
 * - "interest-only" grace: pay only interest during grace, principal unchanged
 * - After grace: standard Spitzer (annuity) schedule on remaining balance
 */
export function generateAmortizationWithGrace(
  principal: number,
  annualRate: number,
  years: number,
  graceMonths: number,
  graceType: GraceType
): AmortizationRow[] {
  if (principal <= 0 || years <= 0) return [];
  const monthlyRate = annualRate / 100 / 12;
  const schedule: AmortizationRow[] = [];
  let remaining = principal;
  let month = 1;

  // Grace period
  if (graceType !== "none" && graceMonths > 0) {
    for (let g = 0; g < graceMonths; g++) {
      const interestPayment = remaining * monthlyRate;
      if (graceType === "full") {
        // Interest capitalizes - no payment
        remaining += interestPayment;
        schedule.push({ month, principalPayment: 0, interestPayment: 0, totalPayment: 0, remainingBalance: remaining });
      } else {
        // Interest-only - pay interest, principal unchanged
        schedule.push({ month, principalPayment: 0, interestPayment, totalPayment: interestPayment, remainingBalance: remaining });
      }
      month++;
    }
  }

  // Regular repayment period after grace
  const remainingMonths = years * 12 - (graceType !== "none" ? graceMonths : 0);
  if (remainingMonths <= 0) return schedule;

  const payment = annualRate <= 0
    ? remaining / remainingMonths
    : (remaining * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
      (Math.pow(1 + monthlyRate, remainingMonths) - 1);

  for (let i = 0; i < remainingMonths; i++) {
    const interestPayment = remaining * monthlyRate;
    const principalPayment = payment - interestPayment;
    remaining = Math.max(0, remaining - principalPayment);
    schedule.push({ month, principalPayment, interestPayment, totalPayment: payment, remainingBalance: remaining });
    month++;
  }

  return schedule;
}

/**
 * Generate CPI-linked amortization schedule (Israeli mortgage market).
 * CPI adjusts the outstanding principal each month, NOT the interest rate.
 * monthlyCPI = (1 + annualCPI/100)^(1/12) - 1
 * Each month: balance *= (1 + monthlyCPI), then calculate interest & principal payment.
 * The monthly payment is recalculated each month based on the adjusted balance.
 */
export function generateCPILinkedSchedule(
  principal: number,
  annualRate: number,
  years: number,
  annualCPI: number,
  graceMonths: number = 0,
  graceType: GraceType = "none"
): AmortizationRow[] {
  if (principal <= 0 || years <= 0) return [];
  const monthlyRate = annualRate / 100 / 12;
  const monthlyCPI = Math.pow(1 + annualCPI / 100, 1 / 12) - 1;
  const totalMonths = years * 12;
  const schedule: AmortizationRow[] = [];
  let remaining = principal;
  let month = 1;

  // Grace period
  const effectiveGrace = graceType !== "none" ? graceMonths : 0;
  for (let g = 0; g < effectiveGrace; g++) {
    // CPI adjustment on principal
    remaining *= (1 + monthlyCPI);
    const interestPayment = remaining * monthlyRate;

    if (graceType === "full") {
      remaining += interestPayment;
      schedule.push({ month, principalPayment: 0, interestPayment: 0, totalPayment: 0, remainingBalance: remaining });
    } else {
      schedule.push({ month, principalPayment: 0, interestPayment, totalPayment: interestPayment, remainingBalance: remaining });
    }
    month++;
  }

  // Regular repayment period - recalculate payment each month due to CPI adjustment
  const remainingMonths = totalMonths - effectiveGrace;
  if (remainingMonths <= 0) return schedule;

  for (let i = 0; i < remainingMonths; i++) {
    // CPI adjustment on principal at start of month
    remaining *= (1 + monthlyCPI);

    // Recalculate payment based on updated balance and remaining term
    const monthsLeft = remainingMonths - i;
    const payment = annualRate <= 0
      ? remaining / monthsLeft
      : (remaining * monthlyRate * Math.pow(1 + monthlyRate, monthsLeft)) /
        (Math.pow(1 + monthlyRate, monthsLeft) - 1);

    const interestPayment = remaining * monthlyRate;
    const principalPayment = payment - interestPayment;
    remaining = Math.max(0, remaining - principalPayment);

    schedule.push({ month, principalPayment, interestPayment, totalPayment: payment, remainingBalance: remaining });
    month++;
  }

  return schedule;
}

export function formatCurrency(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
