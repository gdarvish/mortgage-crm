import type { LoanTrackType, PropertyType } from '@/types/database'

export interface TrackInput {
  type: LoanTrackType
  amount: number
  interestRate: number
  periodMonths: number
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

export function checkCompliance(
  tracks: TrackInput[],
  propertyPrice: number,
  propertyType: PropertyType,
  monthlyIncome: number
): ComplianceResult {
  const totalLoan = tracks.reduce((sum, t) => sum + t.amount, 0)
  const totalMonthlyPayment = tracks.reduce(
    (sum, t) => sum + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths),
    0
  )
  const maxPeriod = Math.max(...tracks.map(t => t.periodMonths))

  const fixedTracks = tracks.filter(t => t.type === 'קל"צ' || t.type === 'קל"ב')
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

  const ltv = (totalLoan / propertyPrice) * 100
  const ltvLimit = getLtvLimit(propertyType)
  const dti = monthlyIncome > 0 ? (totalMonthlyPayment / monthlyIncome) * 100 : 0

  const checks: ComplianceCheck[] = [
    {
      name: 'LTV - יחס הלוואה לשווי',
      value: Math.round(ltv * 10) / 10,
      limit: ltvLimit,
      isValid: ltv <= ltvLimit,
      severity: 'error',
      message: ltv <= ltvLimit
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
      name: 'פריים (מקסימום)',
      value: Math.round(primePercent * 10) / 10,
      limit: 33.3,
      isValid: primePercent <= 33.3,
      severity: 'error',
      message: primePercent <= 33.3
        ? `פריים תקין: ${primePercent.toFixed(1)}% (מקסימום 33.3%)`
        : `פריים חורג: ${primePercent.toFixed(1)}% (מקסימום 33.3%)`,
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
      limit: 40,
      isValid: dti <= 40,
      severity: dti <= 40 ? 'warning' : 'error',
      message: dti <= 40
        ? `יחס החזר/הכנסה תקין: ${dti.toFixed(1)}% (מקסימום 40%)`
        : `יחס החזר/הכנסה חורג: ${dti.toFixed(1)}% (מקסימום 40%)`,
    },
  ]

  return {
    isValid: checks.every(c => c.isValid),
    checks,
  }
}

export function generateRecommendedMixes(
  loanAmount: number,
  periodMonths: number,
  primeRate: number
): { name: string; tracks: TrackInput[] }[] {
  return [
    {
      name: 'שמרני',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.4), interestRate: 4.5, periodMonths },
        { type: 'קל"ב', amount: Math.round(loanAmount * 0.3), interestRate: 3.8, periodMonths },
        { type: 'פריים', amount: Math.round(loanAmount * 0.3), interestRate: primeRate, periodMonths },
      ],
    },
    {
      name: 'מאוזן',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.34), interestRate: 4.5, periodMonths },
        { type: 'קל"ב', amount: Math.round(loanAmount * 0.33), interestRate: 3.8, periodMonths },
        { type: 'פריים', amount: Math.round(loanAmount * 0.33), interestRate: primeRate, periodMonths },
      ],
    },
    {
      name: 'אגרסיבי',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.34), interestRate: 4.5, periodMonths },
        { type: 'משתנה_צמודה', amount: Math.round(loanAmount * 0.33), interestRate: 3.2, periodMonths },
        { type: 'פריים', amount: Math.round(loanAmount * 0.33), interestRate: primeRate, periodMonths },
      ],
    },
    {
      name: 'מותאם אישית',
      tracks: [
        { type: 'קל"צ', amount: Math.round(loanAmount * 0.35), interestRate: 4.5, periodMonths },
        { type: 'קל"ב', amount: Math.round(loanAmount * 0.2), interestRate: 3.8, periodMonths },
        { type: 'זכאות', amount: Math.round(loanAmount * 0.15), interestRate: 3.0, periodMonths: Math.min(periodMonths, 240) },
        { type: 'פריים', amount: Math.round(loanAmount * 0.3), interestRate: primeRate, periodMonths },
      ],
    },
  ]
}

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

  return {
    existingMonthly: Math.round(existingMonthly),
    newMonthly: Math.round(newMonthly),
    monthlySaving: Math.round(monthlySaving),
    existingTotal: Math.round(existingTotal),
    newTotal: Math.round(newTotal),
    totalSaving: Math.round(totalSaving),
    earlyRepaymentFee,
    breakEvenMonths,
    isWorthIt: totalSaving > 0 && breakEvenMonths < 36,
  }
}
