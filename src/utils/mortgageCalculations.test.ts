import { describe, it, expect } from 'vitest'
import {
  calculateMonthlyPayment,
  calculateAmortizationSchedule,
  calculateTotalPayment,
  calculateTotalInterest,
  calculateGracePayments,
  effectiveMonthlyPayment,
  getLtvLimit,
  checkCompliance,
  generateRecommendedMixes,
  effectivePropertyValue,
  additionalEquityRequired,
  isCpiLinked,
  linkedPaymentAtMonth,
  totalPaymentWithCpi,
  estimatePrepaymentFee,
  calculateRefinanceSavings,
  trackTotalCost,
  formatCheckValue,
  checkBarWidth,
  mixMonthlyPaymentAfterYears,
  type TrackInput,
} from './mortgageCalculations'

describe('calculateMonthlyPayment', () => {
  it('returns 0 for 0 months', () => {
    expect(calculateMonthlyPayment(100000, 5, 0)).toBe(0)
  })

  it('handles 0% interest (simple division)', () => {
    expect(calculateMonthlyPayment(120000, 0, 120)).toBe(1000)
  })

  it('calculates standard amortization correctly', () => {
    const payment = calculateMonthlyPayment(1000000, 4.5, 300)
    expect(payment).toBeGreaterThan(5500)
    expect(payment).toBeLessThan(5700)
  })

  it('higher interest means higher payment', () => {
    const low = calculateMonthlyPayment(500000, 3, 240)
    const high = calculateMonthlyPayment(500000, 6, 240)
    expect(high).toBeGreaterThan(low)
  })

  it('shorter period means higher payment', () => {
    const short = calculateMonthlyPayment(500000, 4, 120)
    const long = calculateMonthlyPayment(500000, 4, 240)
    expect(short).toBeGreaterThan(long)
  })
})

describe('calculateAmortizationSchedule', () => {
  it('returns correct number of rows', () => {
    const schedule = calculateAmortizationSchedule(100000, 5, 60)
    expect(schedule).toHaveLength(60)
  })

  it('balance reaches 0 at end', () => {
    const schedule = calculateAmortizationSchedule(100000, 5, 60)
    expect(schedule[schedule.length - 1].balance).toBe(0)
  })

  it('each row has month number', () => {
    const schedule = calculateAmortizationSchedule(100000, 5, 12)
    schedule.forEach((row, i) => {
      expect(row.month).toBe(i + 1)
    })
  })
})

describe('calculateTotalPayment / calculateTotalInterest', () => {
  it('total payment > principal', () => {
    const total = calculateTotalPayment(500000, 5, 300)
    expect(total).toBeGreaterThan(500000)
  })

  it('total interest = total payment - principal', () => {
    const total = calculateTotalPayment(500000, 5, 300)
    const interest = calculateTotalInterest(500000, 5, 300)
    expect(Math.round(interest)).toBe(Math.round(total - 500000))
  })

  it('0% interest means total equals principal', () => {
    const total = calculateTotalPayment(100000, 0, 120)
    expect(Math.round(total)).toBe(100000)
  })
})

describe('calculateGracePayments', () => {
  it('no grace returns same payment for both periods', () => {
    const result = calculateGracePayments(500000, 5, 240, 0, 'חלקי')
    expect(result.duringGrace).toBe(result.afterGrace)
  })

  it('partial grace: during = interest only', () => {
    const result = calculateGracePayments(500000, 6, 240, 12, 'חלקי')
    const monthlyInterest = Math.round(500000 * (6 / 100 / 12))
    expect(result.duringGrace).toBe(monthlyInterest)
  })

  it('full grace: during = 0', () => {
    const result = calculateGracePayments(500000, 6, 240, 12, 'מלא')
    expect(result.duringGrace).toBe(0)
  })

  it('full grace: afterGrace > partial grace afterGrace (compound effect)', () => {
    const full = calculateGracePayments(500000, 6, 240, 24, 'מלא')
    const partial = calculateGracePayments(500000, 6, 240, 24, 'חלקי')
    expect(full.afterGrace).toBeGreaterThan(partial.afterGrace)
  })
})

describe('effectiveMonthlyPayment', () => {
  it('without grace returns calculateMonthlyPayment', () => {
    const track: TrackInput = { type: 'קל"צ', amount: 500000, interestRate: 5, periodMonths: 240 }
    const expected = calculateMonthlyPayment(500000, 5, 240)
    expect(effectiveMonthlyPayment(track)).toBe(expected)
  })

  it('with grace returns afterGrace payment', () => {
    const track: TrackInput = {
      type: 'קל"צ', amount: 500000, interestRate: 5, periodMonths: 240,
      graceMonths: 12, graceType: 'חלקי',
    }
    const result = effectiveMonthlyPayment(track)
    const expected = calculateGracePayments(500000, 5, 240, 12, 'חלקי').afterGrace
    expect(result).toBe(expected)
  })
})

describe('getLtvLimit', () => {
  it('returns 75 for first apartment', () => {
    expect(getLtvLimit('דירה_ראשונה')).toBe(75)
  })

  it('returns 70 for upgraders', () => {
    expect(getLtvLimit('משפרי_דיור')).toBe(70)
  })

  it('returns 50 for investment', () => {
    expect(getLtvLimit('להשקעה')).toBe(50)
  })
})

describe('checkCompliance', () => {
  const compliantTracks: TrackInput[] = [
    { type: 'קל"צ', amount: 400000, interestRate: 4.5, periodMonths: 300 },
    { type: 'פריים', amount: 300000, interestRate: 5.0, periodMonths: 240 },
    { type: 'קל"ב', amount: 300000, interestRate: 3.8, periodMonths: 300 },
  ]

  it('valid mix passes compliance', () => {
    const result = checkCompliance(compliantTracks, 2000000, 'דירה_ראשונה', 30000)
    expect(result.isValid).toBe(true)
  })

  it('LTV exceeding limit fails', () => {
    const result = checkCompliance(compliantTracks, 1000000, 'דירה_ראשונה', 30000)
    expect(result.isValid).toBe(false)
    const ltvCheck = result.checks.find(c => c.name.includes('LTV'))!
    expect(ltvCheck.isValid).toBe(false)
  })

  it('period over 360 months fails', () => {
    const longTracks: TrackInput[] = [
      { type: 'קל"צ', amount: 400000, interestRate: 4.5, periodMonths: 400 },
      { type: 'קל"ב', amount: 200000, interestRate: 3.8, periodMonths: 300 },
    ]
    const result = checkCompliance(longTracks, 2000000, 'דירה_ראשונה', 30000)
    const periodCheck = result.checks.find(c => c.name.includes('תקופה'))!
    expect(periodCheck.isValid).toBe(false)
  })

  it('DTI above 40% fails', () => {
    const result = checkCompliance(compliantTracks, 2000000, 'דירה_ראשונה', 5000)
    const dtiCheck = result.checks.find(c => c.name.includes('החזר'))!
    expect(dtiCheck.isValid).toBe(false)
  })

  it('monthly obligations raise the DTI ratio', () => {
    const withoutObligations = checkCompliance(compliantTracks, 2000000, 'דירה_ראשונה', 30000)
    const withObligations = checkCompliance(compliantTracks, 2000000, 'דירה_ראשונה', 30000, 6000)
    const dtiWithout = withoutObligations.checks.find(c => c.name.includes('החזר'))!.value
    const dtiWith = withObligations.checks.find(c => c.name.includes('החזר'))!.value
    expect(dtiWith).toBeGreaterThan(dtiWithout)
  })

  it('large obligations can push a compliant file over 40% DTI', () => {
    const result = checkCompliance(compliantTracks, 2000000, 'דירה_ראשונה', 15000, 5000)
    const dtiCheck = result.checks.find(c => c.name.includes('החזר'))!
    expect(dtiCheck.isValid).toBe(false)
    expect(dtiCheck.message).toContain('התחייבויות')
  })

  it('prime over 66.6% is warning, not error — does not fail isValid alone', () => {
    const heavyPrime: TrackInput[] = [
      { type: 'פריים', amount: 700000, interestRate: 5.0, periodMonths: 240 },
      { type: 'קל"צ', amount: 300000, interestRate: 4.5, periodMonths: 300 },
    ]
    const result = checkCompliance(heavyPrime, 2000000, 'דירה_ראשונה', 30000)
    const primeCheck = result.checks.find(c => c.name.includes('פריים'))!
    expect(primeCheck.severity).toBe('warning')
    expect(primeCheck.isValid).toBe(false)
  })

  // ── PR-E regressions ──────────────────────────────────────────────────────

  it('E.1 — זכאות counts toward the fixed-rate floor', () => {
    // 40% זכאות + 30% קל"ב = 70% fixed. Before the fix only the קל"ב counted
    // and the mix was reported as "ריבית קבועה חסרה: 30%".
    const withEligibility: TrackInput[] = [
      { type: 'זכאות', amount: 400000, interestRate: 3.0, periodMonths: 240 },
      { type: 'קל"ב', amount: 300000, interestRate: 3.8, periodMonths: 300 },
      { type: 'פריים', amount: 300000, interestRate: 5.0, periodMonths: 240 },
    ]
    const result = checkCompliance(withEligibility, 2000000, 'דירה_ראשונה', 30000)
    const fixedCheck = result.checks.find(c => c.name.includes('קבועה'))!
    expect(fixedCheck.value).toBeCloseTo(70, 1)
    expect(fixedCheck.isValid).toBe(true)
  })

  it('E.2 — an empty track list never yields -Infinity', () => {
    const result = checkCompliance([], 2000000, 'דירה_ראשונה', 30000)
    for (const check of result.checks) {
      expect(Number.isFinite(check.value)).toBe(true)
    }
    const periodCheck = result.checks.find(c => c.name.includes('תקופה'))!
    expect(periodCheck.value).toBe(0)
  })

  it('E.3 — a zero property price never yields Infinity%', () => {
    const result = checkCompliance(compliantTracks, 0, 'דירה_ראשונה', 30000)
    const ltvCheck = result.checks.find(c => c.name.includes('LTV'))!
    expect(Number.isFinite(ltvCheck.value)).toBe(true)
    expect(ltvCheck.isValid).toBe(true)
    expect(ltvCheck.message).toContain('חסר שווי נכס')
  })

  it('E.4 — DTI between the warn and hard thresholds warns rather than fails', () => {
    // Payment + obligations tuned to land at ~43% of income.
    const single: TrackInput[] = [
      { type: 'קל"צ', amount: 1000000, interestRate: 4.5, periodMonths: 300 },
    ]
    const payment = effectiveMonthlyPayment(single[0])
    const income = payment / 0.43
    const result = checkCompliance(single, 3000000, 'דירה_ראשונה', income)
    const dtiCheck = result.checks.find(c => c.name.includes('החזר'))!
    expect(dtiCheck.value).toBeCloseTo(43, 0)
    expect(dtiCheck.severity).toBe('warning')
    expect(dtiCheck.isValid).toBe(false)
    expect(dtiCheck.message).toContain('מעל סף האזהרה')
    // A warning must not fail the file overall.
    expect(result.isValid).toBe(true)
  })

  it('E.4 — DTI above the hard threshold is a red error', () => {
    const single: TrackInput[] = [
      { type: 'קל"צ', amount: 1000000, interestRate: 4.5, periodMonths: 300 },
    ]
    const payment = effectiveMonthlyPayment(single[0])
    const result = checkCompliance(single, 3000000, 'דירה_ראשונה', payment / 0.55)
    const dtiCheck = result.checks.find(c => c.name.includes('החזר'))!
    expect(dtiCheck.severity).toBe('error')
    expect(dtiCheck.isValid).toBe(false)
  })

  it('E.4 — thresholds are overridable', () => {
    const single: TrackInput[] = [
      { type: 'קל"צ', amount: 1000000, interestRate: 4.5, periodMonths: 300 },
    ]
    const payment = effectiveMonthlyPayment(single[0])
    const income = payment / 0.43
    const strict = checkCompliance(
      single, 3000000, 'דירה_ראשונה', income, 0, null, undefined, { warn: 35, hard: 40 },
    )
    const dtiCheck = strict.checks.find(c => c.name.includes('החזר'))!
    expect(dtiCheck.severity).toBe('error')
    expect(dtiCheck.isValid).toBe(false)
  })

  it('E.5 — a low appraisal drives LTV instead of the purchase price', () => {
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 700000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 300000, interestRate: 5.0, periodMonths: 240 },
    ]
    const atPrice = checkCompliance(tracks, 1400000, 'דירה_ראשונה', 30000)
    const atAppraisal = checkCompliance(tracks, 1400000, 'דירה_ראשונה', 30000, 0, 1200000)
    const ltvAtPrice = atPrice.checks.find(c => c.name.includes('LTV'))!
    const ltvAtAppraisal = atAppraisal.checks.find(c => c.name.includes('LTV'))!
    expect(ltvAtPrice.isValid).toBe(true)
    expect(ltvAtAppraisal.value).toBeGreaterThan(ltvAtPrice.value)
    expect(ltvAtAppraisal.isValid).toBe(false)
  })

  it('E.5 — a borrower who ages past 85 by term end raises the age check', () => {
    const born = new Date()
    born.setFullYear(born.getFullYear() - 62)
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 700000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 300000, interestRate: 5.0, periodMonths: 240 },
    ]
    const result = checkCompliance(
      tracks, 2000000, 'דירה_ראשונה', 30000, 0, null, [born.toISOString()],
    )
    const ageCheck = result.checks.find(c => c.name.includes('גיל'))
    expect(ageCheck).toBeDefined()
    expect(ageCheck!.value).toBe(87)
    expect(ageCheck!.severity).toBe('warning')
  })

  it('insufficient fixed rate fails compliance', () => {
    const noFixed: TrackInput[] = [
      { type: 'פריים', amount: 500000, interestRate: 5.0, periodMonths: 240 },
      { type: 'משתנה_צמודה', amount: 500000, interestRate: 3.0, periodMonths: 240 },
    ]
    const result = checkCompliance(noFixed, 2000000, 'דירה_ראשונה', 30000)
    expect(result.isValid).toBe(false)
    const fixedCheck = result.checks.find(c => c.name.includes('קבועה'))!
    expect(fixedCheck.isValid).toBe(false)
  })
})

describe('effectivePropertyValue', () => {
  it('returns purchase price when no appraisal', () => {
    expect(effectivePropertyValue(2000000)).toBe(2000000)
    expect(effectivePropertyValue(2000000, null)).toBe(2000000)
    expect(effectivePropertyValue(2000000, 0)).toBe(2000000)
  })

  it('returns the lower of purchase and appraised value', () => {
    expect(effectivePropertyValue(2000000, 1900000)).toBe(1900000)
    expect(effectivePropertyValue(2000000, 2100000)).toBe(2000000)
  })
})

describe('additionalEquityRequired', () => {
  it('is 0 when appraisal supports the loan', () => {
    expect(additionalEquityRequired(1400000, 2000000, 2000000, 'דירה_ראשונה')).toBe(0)
  })

  it('computes extra equity when appraisal is low', () => {
    // purchase 2M, appraisal 1.9M, first apartment (75%): max loan = 1,425,000
    // requested 1.5M → 75,000 extra equity
    expect(additionalEquityRequired(1500000, 2000000, 1900000, 'דירה_ראשונה')).toBe(75000)
  })
})

describe('checkCompliance with appraisal', () => {
  it('low appraisal raises the LTV and can breach the limit', () => {
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 700000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 500000, interestRate: 5.0, periodMonths: 240 },
      { type: 'קל"ב', amount: 300000, interestRate: 3.8, periodMonths: 300 },
    ]
    const withoutAppraisal = checkCompliance(tracks, 2000000, 'דירה_ראשונה', 40000)
    const withLowAppraisal = checkCompliance(tracks, 2000000, 'דירה_ראשונה', 40000, 0, 1900000)
    const ltvWithout = withoutAppraisal.checks.find(c => c.name.includes('LTV'))!
    const ltvWith = withLowAppraisal.checks.find(c => c.name.includes('LTV'))!
    expect(ltvWith.value).toBeGreaterThan(ltvWithout.value)
  })
})

describe('checkCompliance age-at-term warning', () => {
  const tracks: TrackInput[] = [
    { type: 'קל"צ', amount: 400000, interestRate: 4.5, periodMonths: 360 },
    { type: 'פריים', amount: 300000, interestRate: 5.0, periodMonths: 240 },
    { type: 'קל"ב', amount: 300000, interestRate: 3.8, periodMonths: 300 },
  ]

  it('warns when a borrower would exceed 85 at term end', () => {
    const born = new Date()
    born.setFullYear(born.getFullYear() - 60) // 60 now + 30yr term = 90
    const result = checkCompliance(tracks, 2000000, 'דירה_ראשונה', 40000, 0, null, [born.toISOString()])
    const ageCheck = result.checks.find(c => c.name.includes('גיל'))
    expect(ageCheck).toBeDefined()
    expect(ageCheck!.severity).toBe('warning')
    expect(result.isValid).toBe(true) // warning does not fail the file
  })

  it('does not warn for a young borrower', () => {
    const born = new Date()
    born.setFullYear(born.getFullYear() - 35) // 35 + 30 = 65
    const result = checkCompliance(tracks, 2000000, 'דירה_ראשונה', 40000, 0, null, [born.toISOString()])
    expect(result.checks.find(c => c.name.includes('גיל'))).toBeUndefined()
  })
})

describe('CPI linkage', () => {
  it('flags linked track types', () => {
    expect(isCpiLinked('קל"ב')).toBe(true)
    expect(isCpiLinked('משתנה_צמודה')).toBe(true)
    expect(isCpiLinked('זכאות')).toBe(true)
    expect(isCpiLinked('קל"צ')).toBe(false)
    expect(isCpiLinked('פריים')).toBe(false)
  })

  it('linkedPaymentAtMonth grows with the index', () => {
    const base = 3000
    expect(linkedPaymentAtMonth(base, 2.5, 0)).toBeCloseTo(3000, 0)
    expect(linkedPaymentAtMonth(base, 2.5, 12)).toBeGreaterThan(3000)
    expect(linkedPaymentAtMonth(base, 2.5, 24)).toBeGreaterThan(linkedPaymentAtMonth(base, 2.5, 12))
  })

  it('linked track total cost exceeds nominal; fixed track equals nominal', () => {
    const linked: TrackInput = { type: 'קל"ב', amount: 500000, interestRate: 3.8, periodMonths: 300 }
    const fixed: TrackInput = { type: 'קל"צ', amount: 500000, interestRate: 4.5, periodMonths: 300 }
    const linkedNominal = calculateMonthlyPayment(500000, 3.8, 300) * 300
    expect(totalPaymentWithCpi(linked, 2.5)).toBeGreaterThan(linkedNominal)
    const fixedNominal = calculateMonthlyPayment(500000, 4.5, 300) * 300
    expect(totalPaymentWithCpi(fixed, 2.5)).toBeCloseTo(fixedNominal, 0)
  })

  it('no index growth when cpi is 0', () => {
    const linked: TrackInput = { type: 'קל"ב', amount: 500000, interestRate: 3.8, periodMonths: 300 }
    const nominal = calculateMonthlyPayment(500000, 3.8, 300) * 300
    expect(totalPaymentWithCpi(linked, 0)).toBeCloseTo(nominal, 0)
  })
})

describe('estimatePrepaymentFee', () => {
  it('returns 0 when average rate >= contract rate', () => {
    const fee = estimatePrepaymentFee({ trackType: 'קל"צ', balance: 500000, contractRate: 5, avgRate: 5.5, remainingMonths: 120, yearsSinceStart: 4, earlyNoticeGiven: false })
    expect(fee.finalFee).toBe(0)
  })

  it('computes a positive fee with seniority discount when rate dropped', () => {
    const fee = estimatePrepaymentFee({ trackType: 'קל"צ', balance: 500000, contractRate: 5, avgRate: 3.5, remainingMonths: 120, yearsSinceStart: 4, earlyNoticeGiven: false })
    expect(fee.capitalizationFee).toBeGreaterThan(0)
    expect(fee.discount).toBeCloseTo(fee.capitalizationFee * 0.2, 0) // 4 years => 20%
    expect(fee.finalFee).toBe(fee.capitalizationFee - fee.discount)
  })

  it('applies 30% discount after 5 years', () => {
    const fee = estimatePrepaymentFee({ trackType: 'קל"צ', balance: 500000, contractRate: 5, avgRate: 3.5, remainingMonths: 120, yearsSinceStart: 6, earlyNoticeGiven: false })
    expect(fee.discount).toBeCloseTo(fee.capitalizationFee * 0.3, 0)
  })

  it('no discount before 3 years', () => {
    const fee = estimatePrepaymentFee({ trackType: 'קל"צ', balance: 500000, contractRate: 5, avgRate: 3.5, remainingMonths: 120, yearsSinceStart: 2, earlyNoticeGiven: false })
    expect(fee.discount).toBe(0)
  })

  // ── PR-H regressions ──────────────────────────────────────────────────────

  it('H.1 — early notice actually changes the fee', () => {
    const base = { trackType: 'קל"צ' as const, balance: 500000, contractRate: 5, avgRate: 3.5, remainingMonths: 120, yearsSinceStart: 4 }
    const without = estimatePrepaymentFee({ ...base, earlyNoticeGiven: false })
    const withNotice = estimatePrepaymentFee({ ...base, earlyNoticeGiven: true })
    expect(withNotice.finalFee).toBeLessThan(without.finalFee)
    // 10% off what remains after the seniority discount.
    expect(withNotice.finalFee).toBeCloseTo(without.finalFee * 0.9, 0)
  })

  it('H.2 — a prime track carries no capitalization fee', () => {
    const fee = estimatePrepaymentFee({ trackType: 'פריים', balance: 500000, contractRate: 6.5, avgRate: 3.5, remainingMonths: 120, yearsSinceStart: 4, earlyNoticeGiven: false })
    expect(fee.capitalizationFee).toBe(0)
    expect(fee.finalFee).toBe(0)
  })

  it('H.2 — repayment at an exit station is exempt', () => {
    const fee = estimatePrepaymentFee({ trackType: 'משתנה_צמודה', balance: 500000, contractRate: 5, avgRate: 3.5, remainingMonths: 120, yearsSinceStart: 4, earlyNoticeGiven: false, atExitStation: true })
    expect(fee.finalFee).toBe(0)
  })
})

describe('calculateRefinanceSavings', () => {
  it('H.3 — a shorter term at a higher payment is still worth it', () => {
    // 600K at 5% over 240 months refinanced to 3.5% over 120: the monthly
    // payment rises, but the total cost falls by far more than the fee.
    const existing: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 5, periodMonths: 240 }]
    const shorter: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 3.5, periodMonths: 120 }]
    const result = calculateRefinanceSavings(existing, shorter, 15000)
    expect(result.monthlySaving).toBeLessThan(0)
    expect(result.totalSaving).toBeGreaterThan(0)
    expect(result.savingType).toBe('term')
    expect(result.isWorthIt).toBe(true)
  })

  it('H.3 — a lower monthly payment that pays back quickly is worth it', () => {
    const existing: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 5, periodMonths: 240 }]
    const cheaper: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 3.5, periodMonths: 240 }]
    const result = calculateRefinanceSavings(existing, cheaper, 15000)
    expect(result.savingType).toBe('monthly')
    expect(result.breakEvenMonths).toBeLessThan(36)
    expect(result.isWorthIt).toBe(true)
  })

  it('H.3 — no saving at all is not worth it', () => {
    const existing: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 3.5, periodMonths: 240 }]
    const worse: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 4.5, periodMonths: 240 }]
    const result = calculateRefinanceSavings(existing, worse, 15000)
    expect(result.savingType).toBe('none')
    expect(result.isWorthIt).toBe(false)
  })

  it('H.3 — a monthly saving that never pays back the fee is not worth it', () => {
    const existing: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 5, periodMonths: 240 }]
    const cheaper: TrackInput[] = [{ type: 'קל"צ', amount: 600000, interestRate: 4.95, periodMonths: 240 }]
    const result = calculateRefinanceSavings(existing, cheaper, 200000)
    expect(result.monthlySaving).toBeGreaterThan(0)
    expect(result.isWorthIt).toBe(false)
  })
})

describe('PR-J — calculation and display fixes', () => {
  it('J.1 — total cost charges the grace payment for the grace months', () => {
    const track: TrackInput = {
      type: 'קל"צ', amount: 500000, interestRate: 4, periodMonths: 240,
      graceMonths: 24, graceType: 'חלקי',
    }
    const { duringGrace, afterGrace } = calculateGracePayments(500000, 4, 240, 24, 'חלקי')
    const expected = duringGrace * 24 + afterGrace * 216
    expect(trackTotalCost(track)).toBeCloseTo(expected, 0)
    // The old formula charged the after-grace payment for all 240 months.
    expect(trackTotalCost(track)).toBeLessThan(afterGrace * 240)
  })

  it('J.1 — a track without grace is unaffected', () => {
    const track: TrackInput = { type: 'קל"צ', amount: 500000, interestRate: 4, periodMonths: 240 }
    expect(trackTotalCost(track)).toBeCloseTo(calculateTotalPayment(500000, 4, 240), 6)
  })

  it('J.2 — each check carries the unit its value is measured in', () => {
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 400000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 300000, interestRate: 5, periodMonths: 240 },
      { type: 'קל"ב', amount: 300000, interestRate: 3.8, periodMonths: 300 },
    ]
    const born = new Date()
    born.setFullYear(born.getFullYear() - 62)
    const result = checkCompliance(tracks, 2000000, 'דירה_ראשונה', 30000, 0, null, [born.toISOString()])

    const period = result.checks.find(c => c.name.includes('תקופה'))!
    expect(period.unit).toBe('months')
    expect(formatCheckValue(period)).toBe('300 חודשים')

    const age = result.checks.find(c => c.name.includes('גיל'))!
    expect(age.unit).toBe('years')
    expect(formatCheckValue(age)).not.toContain('%')

    const ltv = result.checks.find(c => c.name.includes('LTV'))!
    expect(ltv.unit).toBe('%')
    expect(formatCheckValue(ltv)).toContain('%')
  })

  it('J.3 — the fixed-rate floor is a minimum, every other check a maximum', () => {
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 400000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 600000, interestRate: 5, periodMonths: 240 },
    ]
    const result = checkCompliance(tracks, 2000000, 'דירה_ראשונה', 30000)
    const fixed = result.checks.find(c => c.name.includes('קבועה'))!
    expect(fixed.direction).toBe('min')
    expect(result.checks.filter(c => c !== fixed).every(c => c.direction === 'max')).toBe(true)
    // 40% against a 33.3% floor is met, so the bar is full.
    expect(checkBarWidth(fixed)).toBe(100)
  })

  it('J.6 — a track ending exactly at the year checked no longer pays', () => {
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 300000, interestRate: 4, periodMonths: 60 },
      { type: 'קל"צ', amount: 300000, interestRate: 4, periodMonths: 240 },
    ]
    const atFive = mixMonthlyPaymentAfterYears(tracks, 0, 5)
    expect(atFive).toBeCloseTo(calculateMonthlyPayment(300000, 4, 240), 6)
  })
})

describe('generateRecommendedMixes', () => {
  it('returns 4 mix recommendations', () => {
    const mixes = generateRecommendedMixes(1000000, 300, 6.0)
    expect(mixes).toHaveLength(4)
  })

  it('each mix sums to loan amount', () => {
    const mixes = generateRecommendedMixes(1000000, 300, 6.0)
    for (const mix of mixes) {
      const total = mix.tracks.reduce((s, t) => s + t.amount, 0)
      expect(total).toBeGreaterThanOrEqual(999000)
      expect(total).toBeLessThanOrEqual(1001000)
    }
  })

  it('uses live rates when provided', () => {
    const mixes = generateRecommendedMixes(1000000, 300, 6.0, {
      fixed_kalatz: 5.0,
      fixed_kalab: 4.2,
    })
    const conservative = mixes[0]
    const kalatz = conservative.tracks.find(t => t.type === 'קל"צ')!
    expect(kalatz.interestRate).toBe(5.0)
  })

  it('falls back to defaults without live rates', () => {
    const mixes = generateRecommendedMixes(1000000, 300, 6.0)
    const conservative = mixes[0]
    const kalatz = conservative.tracks.find(t => t.type === 'קל"צ')!
    expect(kalatz.interestRate).toBe(4.5)
  })

  // Regression (PR-B): קל"צ is fixed *unlinked* and קל"ב is fixed *linked*.
  // The two rates used to be handed to the wrong tracks, so every recommended
  // mix was priced backwards on screen.
  it('קל"צ מקבל ריבית לא צמודה וקל"ב ריבית צמודה', () => {
    const mixes = generateRecommendedMixes(1_000_000, 300, 6, {
      fixed_kalatz: 3.8,
      fixed_kalab: 4.5,
    })
    for (const mix of mixes) {
      const kalatz = mix.tracks.find(t => t.type === 'קל"צ')
      const kalab = mix.tracks.find(t => t.type === 'קל"ב')
      if (kalatz) expect(kalatz.interestRate).toBe(3.8)
      if (kalab) expect(kalab.interestRate).toBe(4.5)
    }
  })

  it('prices קל"צ above קל"ב under real market rates', () => {
    const mixes = generateRecommendedMixes(1_000_000, 300, 6, {
      fixed_kalatz: 4.9,
      fixed_kalab: 3.4,
    })
    for (const mix of mixes) {
      const kalatz = mix.tracks.find(t => t.type === 'קל"צ')
      const kalab = mix.tracks.find(t => t.type === 'קל"ב')
      if (kalatz && kalab) expect(kalatz.interestRate).toBeGreaterThan(kalab.interestRate)
    }
  })
})
