import type { LoanTrackType, PropertyType } from '@/types/database'

export type GraceType = 'מלא' | 'חלקי'

export interface TrackInput {
  type: LoanTrackType
  amount: number
  interestRate: number
  periodMonths: number
  graceMonths?: number   // 0 or undefined = no grace period
  graceType?: GraceType  // 'מלא' = interest+principal deferred | 'חלקי' = interest only paid
}

/**
 * Calculate payments during and after grace period.
 * גרייס חלקי (partial): Only interest is paid during grace. Principal unchanged.
 * גרייס מלא (full): Nothing is paid. Interest compounds onto principal.
 */
export function calculateGracePayments(
  principal: number,
  annualRate: number,
  totalMonths: number,
  graceMonths: number,
  graceType: GraceType
): { duringGrace: number; afterGrace: number } {
  if (graceMonths <= 0 || totalMonths <= graceMonths) {
    const p = calculateMonthlyPayment(principal, annualRate, totalMonths)
    return { duringGrace: p, afterGrace: p }
  }

  const r = annualRate / 100 / 12
  const remainingMonths = totalMonths - graceMonths

  if (graceType === 'חלקי') {
    // Partial grace: pay interest only, principal stays the same
    const duringGrace = Math.round(principal * r)
    const afterGrace = Math.round(calculateMonthlyPayment(principal, annualRate, remainingMonths))
    return { duringGrace, afterGrace }
  } else {
    // Full grace: nothing paid, interest compounds onto principal
    const capitalAfterGrace = principal * Math.pow(1 + r, graceMonths)
    const duringGrace = 0
    const afterGrace = Math.round(calculateMonthlyPayment(capitalAfterGrace, annualRate, remainingMonths))
    return { duringGrace, afterGrace }
  }
}

/** Returns the effective monthly payment for compliance & totals (uses afterGrace if grace exists) */
export function effectiveMonthlyPayment(track: TrackInput): number {
  if (!track.graceMonths || track.graceMonths <= 0) {
    return calculateMonthlyPayment(track.amount, track.interestRate, track.periodMonths)
  }
  return calculateGracePayments(
    track.amount, track.interestRate, track.periodMonths,
    track.graceMonths, track.graceType || 'חלקי'
  ).afterGrace
}

export interface AmortizationRow {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

export interface ComplianceResult {
  isValid: boolean
  checks: ComplianceCheck[]
}

export interface ComplianceCheck {
  name: string
  value: number
  limit: number
  isValid: boolean
  severity: 'error' | 'warning'
  message: string
}

/**
 * DTI thresholds. `warn` is where the case stops being comfortable and `hard`
 * is where it stops being fundable; between them the advisor gets an amber
 * flag rather than a red one, because a case at 43% is a conversation, not a
 * rejection.
 *
 * NOTE: verify both numbers against the current הוראת ניהול בנקאי תקין before
 * relying on them — they are defaults, and every caller may override them.
 */
export interface DtiLimits {
  warn: number
  hard: number
}

export const DEFAULT_DTI_LIMITS: DtiLimits = { warn: 40, hard: 50 }

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (months <= 0) return 0
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export function calculateAmortizationSchedule(
  principal: number,
  annualRate: number,
  months: number
): AmortizationRow[] {
  const schedule: AmortizationRow[] = []
  const r = annualRate / 100 / 12
  const payment = calculateMonthlyPayment(principal, annualRate, months)
  let balance = principal

  for (let month = 1; month <= months; month++) {
    const interest = balance * r
    const principalPart = payment - interest
    balance -= principalPart

    schedule.push({
      month,
      payment: Math.round(payment),
      principal: Math.round(principalPart),
      interest: Math.round(interest),
      balance: Math.max(0, Math.round(balance)),
    })
  }

  return schedule
}

export function calculateTotalPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  return calculateMonthlyPayment(principal, annualRate, months) * months
}

export function calculateTotalInterest(
  principal: number,
  annualRate: number,
  months: number
): number {
  return calculateTotalPayment(principal, annualRate, months) - principal
}

export function getLtvLimit(propertyType: PropertyType): number {
  switch (propertyType) {
    case 'דירה_ראשונה': return 75
    case 'משפרי_דיור': return 70
    case 'להשקעה': return 50
    default: return 75
  }
}

/** The bank finances against the lower of purchase price and appraised value. */
export function effectivePropertyValue(purchasePrice: number, appraisedValue?: number | null): number {
  if (!appraisedValue || appraisedValue <= 0) return purchasePrice
  return Math.min(purchasePrice, appraisedValue)
}

/** Additional equity the borrower must bring if the appraisal came in low. */
export function additionalEquityRequired(
  loanAmount: number, purchasePrice: number, appraisedValue: number, propertyType: PropertyType
): number {
  const maxLoan = (getLtvLimit(propertyType) / 100) * effectivePropertyValue(purchasePrice, appraisedValue)
  return Math.max(0, Math.round(loanAmount - maxLoan))
}

function dtiBreakdown(
  dti: number,
  limits: DtiLimits,
  mortgagePayment: number,
  obligations: number,
): string {
  const nis = (v: number) => Math.round(v).toLocaleString('he-IL')
  const parts = obligations > 0
    ? ` (משכנתא ${nis(mortgagePayment)} ₪ + התחייבויות ${nis(obligations)} ₪)`
    : ''
  if (dti <= limits.warn) {
    return `יחס החזר/הכנסה תקין: ${dti.toFixed(1)}%${parts} (סף אזהרה ${limits.warn}%)`
  }
  if (dti <= limits.hard) {
    return `יחס החזר/הכנסה מעל סף האזהרה: ${dti.toFixed(1)}%${parts} (אזהרה ${limits.warn}%, מקסימום ${limits.hard}%)`
  }
  return `יחס החזר/הכנסה חורג: ${dti.toFixed(1)}%${parts} (מקסימום ${limits.hard}%)`
}

export function checkCompliance(
  tracks: TrackInput[],
  propertyPrice: number,
  propertyType: PropertyType,
  monthlyIncome: number,
  monthlyObligations = 0,
  appraisedValue?: number | null,
  borrowerBirthDates?: (string | null | undefined)[],
  dtiLimits: DtiLimits = DEFAULT_DTI_LIMITS,
): ComplianceResult {
  const totalLoan = tracks.reduce((sum, t) => sum + t.amount, 0)
  const totalMonthlyPayment = tracks.reduce(
    (sum, t) => sum + effectiveMonthlyPayment(t),
    0
  )
  // Math.max of an empty list is -Infinity, which used to surface verbatim in
  // the "תקופה" row of an untouched calculator.
  const maxPeriod = tracks.length ? Math.max(...tracks.map(t => t.periodMonths)) : 0

  // זכאות is a fixed, index-linked rate, so it counts toward the fixed-third
  // floor exactly like קל"צ and קל"ב. (isCpiLinked already treats it as linked;
  // that stays as it is.)
  const fixedTracks = tracks.filter(t => t.type === 'קל"צ' || t.type === 'קל"ב' || t.type === 'זכאות')
  const primeTracks = tracks.filter(t => t.type === 'פריים')
  const variableTracks = tracks.filter(t =>
    t.type === 'פריים' || t.type === 'משתנה_צמודה' || t.type === 'משתנה_לא_צמודה'
  )

  const fixedPercent = totalLoan > 0
    ? (fixedTracks.reduce((s, t) => s + t.amount, 0) / totalLoan) * 100
    : 0
  const primePercent = totalLoan > 0
    ? (primeTracks.reduce((s, t) => s + t.amount, 0) / totalLoan) * 100
    : 0
  const variablePercent = totalLoan > 0
    ? (variableTracks.reduce((s, t) => s + t.amount, 0) / totalLoan) * 100
    : 0

  const effectiveValue = effectivePropertyValue(propertyPrice, appraisedValue)
  const ltvApplicable = effectiveValue > 0
  const ltv = ltvApplicable ? (totalLoan / effectiveValue) * 100 : 0
  const ltvLimit = getLtvLimit(propertyType)
  const combinedPayment = totalMonthlyPayment + monthlyObligations
  const dti = monthlyIncome > 0 ? (combinedPayment / monthlyIncome) * 100 : 0

  const checks: ComplianceCheck[] = [
    {
      name: 'LTV - יחס הלוואה לשווי',
      value: Math.round(ltv * 10) / 10,
      limit: ltvLimit,
      // With no property value there is nothing to divide by; reporting the
      // check as failed would be a false alarm, so it is reported as N/A.
      isValid: !ltvApplicable || ltv <= ltvLimit,
      severity: 'error',
      message: !ltvApplicable
        ? 'לא ניתן לחשב LTV — חסר שווי נכס'
        : ltv <= ltvLimit
          ? `LTV תקין: ${ltv.toFixed(1)}% (מקסימום ${ltvLimit}%)`
          : `LTV חורג: ${ltv.toFixed(1)}% (מקסימום ${ltvLimit}%)`,
    },
    {
      name: 'ריבית קבועה (מינימום)',
      value: Math.round(fixedPercent * 10) / 10,
      limit: 33.3,
      isValid: fixedPercent >= 33.3,
      severity: 'error',
      message: fixedPercent >= 33.3
        ? `ריבית קבועה תקינה: ${fixedPercent.toFixed(1)}% (מינימום 33.3%)`
        : `ריבית קבועה חסרה: ${fixedPercent.toFixed(1)}% (מינימום 33.3%)`,
    },
    {
      name: 'פריים (בתוך מגבלת המשתנה)',
      value: Math.round(primePercent * 10) / 10,
      limit: 66.6,
      isValid: primePercent <= 66.6,
      severity: 'warning',
      message: primePercent <= 66.6
        ? `פריים תקין: ${primePercent.toFixed(1)}% (מקסימום 66.6%)`
        : `פריים חורג: ${primePercent.toFixed(1)}% (מקסימום 66.6%)`,
    },
    {
      name: 'משתנה כולל (מקסימום)',
      value: Math.round(variablePercent * 10) / 10,
      limit: 66.6,
      isValid: variablePercent <= 66.6,
      severity: 'error',
      message: variablePercent <= 66.6
        ? `משתנה כולל תקין: ${variablePercent.toFixed(1)}% (מקסימום 66.6%)`
        : `משתנה כולל חורג: ${variablePercent.toFixed(1)}% (מקסימום 66.6%)`,
    },
    {
      name: 'תקופה (מקסימום)',
      value: maxPeriod,
      limit: 360,
      isValid: maxPeriod <= 360,
      severity: 'error',
      message: maxPeriod <= 360
        ? `תקופה תקינה: ${maxPeriod} חודשים (מקסימום 360)`
        : `תקופה חורגת: ${maxPeriod} חודשים (מקסימום 360)`,
    },
    {
      name: 'יחס החזר/הכנסה',
      value: Math.round(dti * 10) / 10,
      limit: dtiLimits.hard,
      // Three states, not two. Up to `warn` the case is clean; between `warn`
      // and `hard` it is flagged but still fundable, so the check reads as
      // not-clean at warning severity and does not fail overall compliance;
      // only above `hard` is it an error.
      isValid: dti <= dtiLimits.warn,
      severity: dti <= dtiLimits.hard ? 'warning' : 'error',
      message: dtiBreakdown(dti, dtiLimits, totalMonthlyPayment, monthlyObligations),
    },
  ]

  // Age-at-term warning (professional guidance, non-blocking). Many banks cap
  // the borrower's age at the end of the term around 85.
  const oldestAgeAtEnd = (borrowerBirthDates ?? [])
    .map(bd => {
      if (!bd) return null
      const born = new Date(bd).getTime()
      if (Number.isNaN(born)) return null
      const ageNow = (Date.now() - born) / (365.25 * 24 * 60 * 60 * 1000)
      return ageNow + maxPeriod / 12
    })
    .filter((v): v is number => v !== null)
    .reduce((max, v) => Math.max(max, v), 0)

  if (oldestAgeAtEnd > 85) {
    checks.push({
      name: 'גיל בתום התקופה',
      value: Math.round(oldestAgeAtEnd),
      limit: 85,
      isValid: false,
      severity: 'warning',
      message: `גיל הלווה בתום התקופה: ${Math.round(oldestAgeAtEnd)} — בנקים רבים מגבילים ל-~85`,
    })
  }

  return {
    isValid: checks.filter(c => c.severity === 'error').every(c => c.isValid),
    checks,
  }
}

/**
 * Live market rates keyed by track, as published in `interest_rates`.
 *
 * The keys are deliberately named after the Hebrew tracks rather than after
 * "linked"/"unlinked": קל"צ is fixed *un*linked and קל"ב is fixed *linked*, and
 * naming them the other way round is exactly how the two got swapped before.
 * These names never reach Firestore — documents key off `track_type` with the
 * Hebrew value — so the shape is free to describe the tracks directly.
 */
export interface LiveRates {
  /** קל"צ — קבועה לא צמודה. Carries the higher nominal rate: no index on top. */
  fixed_kalatz?: number
  /** קל"ב — קבועה צמודת מדד. Lower nominal rate; the CPI is added on top. */
  fixed_kalab?: number
  variable_linked?: number
  eligibility?: number
  prime?: number
}

export function generateRecommendedMixes(
  loanAmount: number,
  periodMonths: number,
  primeRate: number,
  rates?: LiveRates,
): { name: string; tracks: TrackInput[] }[] {
  const r = {
    kalatz: rates?.fixed_kalatz ?? 4.5,
    kalab: rates?.fixed_kalab ?? 3.8,
    variableLinked: rates?.variable_linked ?? 3.2,
    eligibility: rates?.eligibility ?? 3.0,
  }
  return [
    {
      name: 'שמרני',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.4), interestRate: r.kalatz, periodMonths },
        { type: 'קל"ב', amount: Math.round(loanAmount * 0.3), interestRate: r.kalab, periodMonths },
        { type: 'פריים', amount: Math.round(loanAmount * 0.3), interestRate: primeRate, periodMonths },
      ],
    },
    {
      name: 'מאוזן',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.34), interestRate: r.kalatz, periodMonths },
        { type: 'קל"ב', amount: Math.round(loanAmount * 0.33), interestRate: r.kalab, periodMonths },
        { type: 'פריים', amount: Math.round(loanAmount * 0.33), interestRate: primeRate, periodMonths },
      ],
    },
    {
      name: 'אגרסיבי',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.34), interestRate: r.kalatz, periodMonths },
        { type: 'משתנה_צמודה', amount: Math.round(loanAmount * 0.33), interestRate: r.variableLinked, periodMonths },
        { type: 'פריים', amount: Math.round(loanAmount * 0.33), interestRate: primeRate, periodMonths },
      ],
    },
    {
      name: 'מותאם אישית',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.35), interestRate: r.kalatz, periodMonths },
        { type: 'קל"ב', amount: Math.round(loanAmount * 0.2), interestRate: r.kalab, periodMonths },
        { type: 'זכאות', amount: Math.round(loanAmount * 0.15), interestRate: r.eligibility, periodMonths: Math.min(periodMonths, 240) },
        { type: 'פריים', amount: Math.round(loanAmount * 0.3), interestRate: primeRate, periodMonths },
      ],
    },
  ]
}

// ── CPI (index) linkage ──────────────────────────────────────────────────────

export function isCpiLinked(type: LoanTrackType): boolean {
  return type === 'קל"ב' || type === 'משתנה_צמודה' || type === 'זכאות'
}

/**
 * Projected monthly payment on a linked track in month `month` — a simplified
 * model where the payment grows with the index (not a full balance simulation).
 */
export function linkedPaymentAtMonth(basePayment: number, annualCpi: number, month: number): number {
  return basePayment * Math.pow(1 + annualCpi / 100, month / 12)
}

/** Total cost of a track, applying index growth when the track is CPI-linked. */
export function totalPaymentWithCpi(track: TrackInput, annualCpi: number): number {
  const base = calculateMonthlyPayment(track.amount, track.interestRate, track.periodMonths)
  if (!isCpiLinked(track.type) || annualCpi <= 0) return base * track.periodMonths
  let total = 0
  for (let m = 1; m <= track.periodMonths; m++) total += linkedPaymentAtMonth(base, annualCpi, m)
  return total
}

/** Projected monthly payment of a whole mix after `years`, applying index growth. */
export function mixMonthlyPaymentAfterYears(tracks: TrackInput[], annualCpi: number, years: number): number {
  return tracks.reduce((sum, t) => {
    const base = calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths)
    if (t.periodMonths < years * 12) return sum // track already paid off
    if (!isCpiLinked(t.type) || annualCpi <= 0) return sum + base
    return sum + linkedPaymentAtMonth(base, annualCpi, years * 12)
  }, 0)
}

/** Total cost of a whole mix, applying index growth to linked tracks. */
export function mixTotalCostWithCpi(tracks: TrackInput[], annualCpi: number): number {
  return tracks.reduce((sum, t) => sum + totalPaymentWithCpi(t, annualCpi), 0)
}

// ── Early-repayment (capitalization) fee ─────────────────────────────────────

/**
 * Statutory discounts on the capitalization fee.
 *
 * NOTE: verify all three against the current צו הבנקאות (עמלות פירעון מוקדם)
 * before relying on the numbers — they are collected here so that a regulatory
 * change is a one-line edit rather than a hunt through the formula.
 */
export const PREPAY_SENIORITY_DISCOUNTS: { years: number; discount: number }[] = [
  { years: 5, discount: 0.3 },
  { years: 3, discount: 0.2 },
]
/** Discount for giving the bank early notice (10–45 days) of the repayment. */
export const PREPAY_EARLY_NOTICE_DISCOUNT = 0.1

export interface PrepaymentFeeInput {
  /** פריים carries no capitalization fee at all. */
  trackType: LoanTrackType
  balance: number               // track balance
  contractRate: number          // the rate in the contract (%)
  avgRate: number               // Bank of Israel average rate for the remaining term (%)
  remainingMonths: number
  yearsSinceStart: number       // seniority — for the seniority discount
  earlyNoticeGiven: boolean     // early notice (10–45 days)
  /** A variable track repaid at an exit station is exempt. */
  atExitStation?: boolean
}

export function estimatePrepaymentFee(input: PrepaymentFeeInput) {
  const { trackType, balance, contractRate, avgRate, remainingMonths, yearsSinceStart } = input

  // פריים tracks the Bank of Israel rate, so there is no fixed-rate spread to
  // capitalize; a variable track repaid at its exit station is likewise exempt.
  if (trackType === 'פריים' || input.atExitStation) {
    return { capitalizationFee: 0, discount: 0, finalFee: 0 }
  }
  // No capitalization fee when the average rate is at or above the contract rate.
  if (avgRate >= contractRate || balance <= 0 || remainingMonths <= 0) {
    return { capitalizationFee: 0, discount: 0, finalFee: 0 }
  }
  // Capitalization: present value of the future payments (at the contract rate),
  // discounted at the average rate — versus the current balance.
  const payment = calculateMonthlyPayment(balance, contractRate, remainingMonths)
  const rAvg = avgRate / 100 / 12
  const pvAtAvg = payment * (1 - Math.pow(1 + rAvg, -remainingMonths)) / rAvg
  const capitalizationFee = Math.max(0, pvAtAvg - balance)

  const seniorityRate = PREPAY_SENIORITY_DISCOUNTS
    .find(d => yearsSinceStart >= d.years)?.discount ?? 0
  const seniorityDiscount = capitalizationFee * seniorityRate

  // The early-notice discount applies to what is left after the seniority
  // discount. It was accepted as a parameter but never used, so ticking the box
  // changed the fee by exactly nothing.
  const afterSeniority = capitalizationFee - seniorityDiscount
  const noticeDiscount = input.earlyNoticeGiven ? afterSeniority * PREPAY_EARLY_NOTICE_DISCOUNT : 0

  return {
    capitalizationFee: Math.round(capitalizationFee),
    discount: Math.round(seniorityDiscount + noticeDiscount),
    finalFee: Math.round(afterSeniority - noticeDiscount),
  }
}

/**
 * How a refinance pays off: a lower monthly payment, a shorter term at a
 * higher payment but lower total cost, or not at all.
 */
export type RefinanceSavingType = 'monthly' | 'term' | 'none'

export function calculateRefinanceSavings(
  existingTracks: TrackInput[],
  newTracks: TrackInput[],
  earlyRepaymentFee: number
) {
  const existingMonthly = existingTracks.reduce(
    (sum, t) => sum + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0
  )
  const newMonthly = newTracks.reduce(
    (sum, t) => sum + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0
  )

  const existingTotal = existingTracks.reduce(
    (sum, t) => sum + calculateTotalPayment(t.amount, t.interestRate, t.periodMonths), 0
  )
  const newTotal = newTracks.reduce(
    (sum, t) => sum + calculateTotalPayment(t.amount, t.interestRate, t.periodMonths), 0
  )

  const monthlySaving = existingMonthly - newMonthly
  const totalSaving = existingTotal - newTotal - earlyRepaymentFee
  const breakEvenMonths = monthlySaving > 0
    ? Math.ceil(earlyRepaymentFee / monthlySaving)
    : Infinity

  // Shortening the term raises the monthly payment while cutting total cost.
  // Judging every refinance by break-even on a monthly saving rejected those
  // outright — including cases saving hundreds of thousands over the term.
  const savingType: RefinanceSavingType =
    monthlySaving > 0 ? 'monthly' : totalSaving > 0 ? 'term' : 'none'

  return {
    existingMonthly: Math.round(existingMonthly),
    newMonthly: Math.round(newMonthly),
    monthlySaving: Math.round(monthlySaving),
    existingTotal: Math.round(existingTotal),
    newTotal: Math.round(newTotal),
    totalSaving: Math.round(totalSaving),
    earlyRepaymentFee,
    breakEvenMonths,
    savingType,
    isWorthIt: totalSaving > 0 && (monthlySaving <= 0 || breakEvenMonths < 36),
  }
}
