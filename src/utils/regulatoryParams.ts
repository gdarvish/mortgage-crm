import type { PropertyType } from '@/types/database'

/**
 * Bank of Israel and Banking Supervision limits, as data rather than code.
 *
 * These change by circular, not by release. Holding them in Firestore means a
 * change is a value edit rather than a deploy — and, because each record
 * carries the date it took effect, a case approved under the old rules can
 * still be judged by them instead of turning red the day the numbers move.
 */
export interface RegulatoryParams {
  id: string
  /** ISO date these values took effect. */
  effective_from: string

  ltv_first_home: number
  ltv_upgrader: number
  ltv_investment: number

  min_fixed_percent: number
  max_prime_percent: number
  max_variable_percent: number
  max_period_months: number

  dti_warn_threshold: number
  dti_hard_threshold: number
  max_age_at_term: number

  /** Months left below which an obligation stops counting toward DTI. */
  dti_obligation_months: number

  prepay_seniority_discounts: { years: number; discount: number }[]
  prepay_early_notice_discount: number

  updated_by?: string | null
  /** Reference to the circular or directive these came from. */
  source_note?: string | null
  created_at?: string
}

/**
 * The values the app falls back to when no record has been published yet.
 *
 * These are the numbers the code carried before this layer existed. They are
 * documented defaults, not authority: verify each against the current
 * הוראת ניהול בנקאי תקין and צו הבנקאות (עמלות פירעון מוקדם) before relying
 * on them, and publish a record rather than editing this file.
 */
export const FALLBACK_REGULATORY_PARAMS: RegulatoryParams = {
  id: 'fallback',
  effective_from: '1970-01-01T00:00:00.000Z',
  ltv_first_home: 75,
  ltv_upgrader: 70,
  ltv_investment: 50,
  min_fixed_percent: 33.3,
  max_prime_percent: 66.6,
  max_variable_percent: 66.6,
  max_period_months: 360,
  dti_warn_threshold: 40,
  dti_hard_threshold: 50,
  max_age_at_term: 85,
  dti_obligation_months: 18,
  prepay_seniority_discounts: [
    { years: 5, discount: 0.3 },
    { years: 3, discount: 0.2 },
  ],
  prepay_early_notice_discount: 0.1,
  source_note: 'ברירת מחדל מוטמעת — יש לאמת מול ההוראות העדכניות ולפרסם רשומה',
}

/**
 * The record in force on a given date.
 *
 * Records are sorted newest-first by effective_from; the one in force is the
 * most recent that had already taken effect. A case created in 2024 is judged
 * by the 2024 rules even after the 2026 ones are published.
 */
export function paramsInForceAt(
  records: RegulatoryParams[],
  at: string | Date = new Date(),
): RegulatoryParams {
  const when = new Date(at).getTime()
  if (Number.isNaN(when)) return paramsInForceAt(records)
  const inForce = records
    .filter((r) => new Date(r.effective_from).getTime() <= when)
    .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())
  return inForce[0] ?? FALLBACK_REGULATORY_PARAMS
}

/** The LTV ceiling for a property type, under the given parameters. */
export function ltvLimitFor(propertyType: PropertyType, params: RegulatoryParams): number {
  switch (propertyType) {
    case 'דירה_ראשונה': return params.ltv_first_home
    case 'משפרי_דיור': return params.ltv_upgrader
    case 'להשקעה': return params.ltv_investment
    default: return params.ltv_first_home
  }
}
