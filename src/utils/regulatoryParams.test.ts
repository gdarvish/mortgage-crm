import { describe, it, expect } from 'vitest'
import {
  paramsInForceAt,
  ltvLimitFor,
  FALLBACK_REGULATORY_PARAMS,
  type RegulatoryParams,
} from './regulatoryParams'
import { checkCompliance, estimatePrepaymentFee, type TrackInput } from './mortgageCalculations'

function params(over: Partial<RegulatoryParams>): RegulatoryParams {
  return { ...FALLBACK_REGULATORY_PARAMS, ...over }
}

const RULES_2024 = params({ id: '2024', effective_from: '2024-01-01T00:00:00.000Z', max_period_months: 360 })
const RULES_2026 = params({ id: '2026', effective_from: '2026-01-01T00:00:00.000Z', max_period_months: 300 })

describe('paramsInForceAt', () => {
  it('picks the most recent record already in effect', () => {
    expect(paramsInForceAt([RULES_2024, RULES_2026], '2026-06-01').id).toBe('2026')
  })

  it('judges an older case by the rules that applied then', () => {
    expect(paramsInForceAt([RULES_2024, RULES_2026], '2025-03-01').id).toBe('2024')
  })

  it('ignores a record that has not taken effect yet', () => {
    expect(paramsInForceAt([RULES_2024, RULES_2026], '2024-06-01').id).toBe('2024')
  })

  it('is order-independent', () => {
    expect(paramsInForceAt([RULES_2026, RULES_2024], '2025-03-01').id).toBe('2024')
  })

  it('falls back when nothing has been published', () => {
    expect(paramsInForceAt([]).id).toBe('fallback')
  })

  it('falls back when every record is still in the future', () => {
    expect(paramsInForceAt([RULES_2026], '2024-01-01').id).toBe('fallback')
  })

  it('treats an unparseable date as now', () => {
    const result = paramsInForceAt([RULES_2024], 'not a date')
    expect(result.id).toBe('2024')
  })
})

describe('ltvLimitFor', () => {
  it('maps each property type to its own ceiling', () => {
    const p = params({ ltv_first_home: 80, ltv_upgrader: 65, ltv_investment: 45 })
    expect(ltvLimitFor('דירה_ראשונה', p)).toBe(80)
    expect(ltvLimitFor('משפרי_דיור', p)).toBe(65)
    expect(ltvLimitFor('להשקעה', p)).toBe(45)
  })
})

describe('checkCompliance under published parameters', () => {
  const tracks: TrackInput[] = [
    { type: 'קל"צ', amount: 400_000, interestRate: 4.5, periodMonths: 330 },
    { type: 'פריים', amount: 300_000, interestRate: 5, periodMonths: 240 },
    { type: 'קל"ב', amount: 300_000, interestRate: 3.8, periodMonths: 300 },
  ]

  it('a 330-month term passes under the 2024 rules and fails under the 2026 ones', () => {
    const under2024 = checkCompliance(tracks, 2_000_000, 'דירה_ראשונה', 30_000, 0, null, undefined, undefined, RULES_2024)
    const under2026 = checkCompliance(tracks, 2_000_000, 'דירה_ראשונה', 30_000, 0, null, undefined, undefined, RULES_2026)
    const period2024 = under2024.checks.find(c => c.name.includes('תקופה'))!
    const period2026 = under2026.checks.find(c => c.name.includes('תקופה'))!
    expect(period2024.isValid).toBe(true)
    expect(period2024.limit).toBe(360)
    expect(period2026.isValid).toBe(false)
    expect(period2026.limit).toBe(300)
  })

  it('takes the LTV ceiling from the parameters', () => {
    const strict = params({ ltv_first_home: 60 })
    const result = checkCompliance(tracks, 1_400_000, 'דירה_ראשונה', 30_000, 0, null, undefined, undefined, strict)
    const ltv = result.checks.find(c => c.name.includes('LTV'))!
    expect(ltv.limit).toBe(60)
    expect(ltv.isValid).toBe(false)
  })

  it('takes the DTI thresholds from the parameters when none are passed', () => {
    const lenient = params({ dti_warn_threshold: 50, dti_hard_threshold: 60 })
    const result = checkCompliance(tracks, 3_000_000, 'דירה_ראשונה', 12_000, 0, null, undefined, undefined, lenient)
    const dti = result.checks.find(c => c.name.includes('החזר'))!
    expect(dti.limit).toBe(60)
  })

  it('an explicit advisor setting still overrides the regulator’s thresholds', () => {
    const lenient = params({ dti_warn_threshold: 50, dti_hard_threshold: 60 })
    const result = checkCompliance(
      tracks, 3_000_000, 'דירה_ראשונה', 12_000, 0, null, undefined, { warn: 30, hard: 35 }, lenient,
    )
    const dti = result.checks.find(c => c.name.includes('החזר'))!
    expect(dti.limit).toBe(35)
  })

  it('takes the fixed-rate floor and the age cap from the parameters', () => {
    const strict = params({ min_fixed_percent: 80, max_age_at_term: 70 })
    const born = new Date()
    born.setFullYear(born.getFullYear() - 55)
    const result = checkCompliance(
      tracks, 2_000_000, 'דירה_ראשונה', 30_000, 0, null, [born.toISOString()], undefined, strict,
    )
    expect(result.checks.find(c => c.name.includes('קבועה'))!.limit).toBe(80)
    expect(result.checks.find(c => c.name.includes('גיל'))!.limit).toBe(70)
  })
})

describe('estimatePrepaymentFee under published parameters', () => {
  const base = {
    trackType: 'קל"צ' as const,
    balance: 500_000,
    contractRate: 5,
    avgRate: 3.5,
    remainingMonths: 120,
    yearsSinceStart: 4,
    earlyNoticeGiven: false,
  }

  it('takes the seniority tiers from the parameters', () => {
    const generous = params({ prepay_seniority_discounts: [{ years: 3, discount: 0.5 }] })
    const fee = estimatePrepaymentFee(base, generous)
    // Rounded to whole shekels, so allow a shekel either way.
    expect(Math.abs(fee.discount - fee.capitalizationFee * 0.5)).toBeLessThanOrEqual(1)
  })

  it('takes the early-notice discount from the parameters', () => {
    const generous = params({ prepay_early_notice_discount: 0.25 })
    const without = estimatePrepaymentFee({ ...base, earlyNoticeGiven: false }, generous)
    const withNotice = estimatePrepaymentFee({ ...base, earlyNoticeGiven: true }, generous)
    expect(Math.abs(withNotice.finalFee - without.finalFee * 0.75)).toBeLessThanOrEqual(1)
  })

  it('falls back to the built-in values with no parameters passed', () => {
    const fee = estimatePrepaymentFee(base)
    expect(Math.abs(fee.discount - fee.capitalizationFee * 0.2)).toBeLessThanOrEqual(1)
  })
})
