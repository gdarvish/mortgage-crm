import type { Obligation } from '@/types/database'

export const DEFAULT_DTI_MONTHS_THRESHOLD = 18

/**
 * The 18-month rule: an obligation counts toward DTI when it still has more
 * than `thresholdMonths` left to run (or has no end date). Banks ignore
 * obligations that expire within the window because they will not burden the
 * borrower over the mortgage term.
 */
export function shouldIncludeInDti(
  endDate: string | null | undefined,
  thresholdMonths = DEFAULT_DTI_MONTHS_THRESHOLD,
): boolean {
  if (!endDate) return true
  const end = new Date(endDate).getTime()
  if (Number.isNaN(end)) return true
  const cutoff = Date.now() + thresholdMonths * 30.44 * 24 * 60 * 60 * 1000
  return end > cutoff
}

/**
 * Whether an obligation enters the DTI *right now*.
 *
 * The rule is evaluated at read time, not once at data entry: an obligation
 * saved with 20 months left has 16 left four months later, and the stored
 * `include_in_dti` snapshot would keep inflating the ratio forever. An explicit
 * `dti_override` set by the advisor always wins.
 */
export function isCountedInDti(
  o: Pick<Obligation, 'end_date' | 'dti_override'>,
  thresholdMonths = DEFAULT_DTI_MONTHS_THRESHOLD,
): boolean {
  if (o.dti_override !== null && o.dti_override !== undefined) return o.dti_override
  return shouldIncludeInDti(o.end_date, thresholdMonths)
}

/** Months left on an obligation, or null when it has no usable end date. */
export function monthsUntilEnd(endDate: string | null | undefined): number | null {
  if (!endDate) return null
  const end = new Date(endDate).getTime()
  if (Number.isNaN(end)) return null
  return Math.round((end - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))
}

/** Sum of the monthly repayments that actually enter the DTI calculation. */
export function totalMonthlyObligations(
  obligations: Obligation[],
  thresholdMonths = DEFAULT_DTI_MONTHS_THRESHOLD,
): number {
  return obligations
    .filter(o => isCountedInDti(o, thresholdMonths))
    .reduce((sum, o) => sum + (o.monthly_payment || 0), 0)
}
