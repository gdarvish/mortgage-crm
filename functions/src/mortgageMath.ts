/**
 * Mortgage arithmetic shared by the scheduled scans.
 *
 * Mirrors src/utils/mortgageCalculations.ts. The frontend bundle and the
 * functions bundle are compiled separately, so the formulas are duplicated
 * rather than imported; keep the two in step when either changes.
 */

/** Standard monthly payment (annuity). */
export function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0) return 0
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

/**
 * Statutory discounts on the capitalization fee. Verify against the current
 * צו הבנקאות (עמלות פירעון מוקדם) before relying on the numbers.
 */
export const PREPAY_SENIORITY_DISCOUNTS: { years: number; discount: number }[] = [
  { years: 5, discount: 0.3 },
  { years: 3, discount: 0.2 },
]
export const PREPAY_EARLY_NOTICE_DISCOUNT = 0.1

export interface PrepaymentFeeInput {
  trackType: string
  balance: number
  contractRate: number
  avgRate: number
  remainingMonths: number
  yearsSinceStart: number
  earlyNoticeGiven: boolean
  atExitStation?: boolean
}

export interface PrepaymentFee {
  capitalizationFee: number
  discount: number
  finalFee: number
}

/**
 * Estimated early-repayment (capitalization) fee. פריים carries none — it
 * tracks the Bank of Israel rate, so there is no fixed spread to capitalize —
 * and a variable track repaid at its exit station is exempt.
 */
export function estimatePrepaymentFee(input: PrepaymentFeeInput): PrepaymentFee {
  const { trackType, balance, contractRate, avgRate, remainingMonths, yearsSinceStart } = input
  const none = { capitalizationFee: 0, discount: 0, finalFee: 0 }

  if (trackType === 'פריים' || input.atExitStation) return none
  if (avgRate >= contractRate || balance <= 0 || remainingMonths <= 0) return none

  const payment = monthlyPayment(balance, contractRate, remainingMonths)
  const rAvg = avgRate / 100 / 12
  const pvAtAvg = payment * (1 - Math.pow(1 + rAvg, -remainingMonths)) / rAvg
  const capitalizationFee = Math.max(0, pvAtAvg - balance)

  const seniorityRate = PREPAY_SENIORITY_DISCOUNTS
    .find(d => yearsSinceStart >= d.years)?.discount ?? 0
  const seniorityDiscount = capitalizationFee * seniorityRate
  const afterSeniority = capitalizationFee - seniorityDiscount
  const noticeDiscount = input.earlyNoticeGiven ? afterSeniority * PREPAY_EARLY_NOTICE_DISCOUNT : 0

  return {
    capitalizationFee: Math.round(capitalizationFee),
    discount: Math.round(seniorityDiscount + noticeDiscount),
    finalFee: Math.round(afterSeniority - noticeDiscount),
  }
}
