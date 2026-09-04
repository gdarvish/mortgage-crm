import { describe, it, expect } from 'vitest'
import {
  shouldIncludeInDti,
  isCountedInDti,
  monthsUntilEnd,
  totalMonthlyObligations,
  DEFAULT_DTI_MONTHS_THRESHOLD,
} from './dti'
import type { Obligation } from '@/types/database'

/** An ISO date `months` from now. */
function inMonths(months: number): string {
  const d = new Date()
  d.setTime(d.getTime() + months * 30.44 * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

function obligation(over: Partial<Obligation>): Obligation {
  return {
    id: 'o1',
    user_id: 'u1',
    customer_id: 'c1',
    type: 'הלוואה בנקאית',
    lender: 'בנק',
    monthly_payment: 1000,
    balance: null,
    end_date: null,
    include_in_dti: true,
    dti_override: null,
    notes: null,
    created_at: new Date().toISOString(),
    ...over,
  }
}

describe('isCountedInDti', () => {
  it('auto — counted while more than the threshold remains', () => {
    const o = obligation({ end_date: inMonths(24), dti_override: null })
    expect(isCountedInDti(o)).toBe(true)
  })

  it('auto — not counted once less than the threshold remains', () => {
    // Saved when 20 months were left; four months on, 16 remain. The stored
    // include_in_dti still says true — the live rule must say otherwise.
    const o = obligation({ end_date: inMonths(16), include_in_dti: true, dti_override: null })
    expect(o.include_in_dti).toBe(true)
    expect(isCountedInDti(o)).toBe(false)
  })

  it('an explicit override wins over the rule in both directions', () => {
    const forcedIn = obligation({ end_date: inMonths(3), dti_override: true })
    const forcedOut = obligation({ end_date: inMonths(60), dti_override: false })
    expect(isCountedInDti(forcedIn)).toBe(true)
    expect(isCountedInDti(forcedOut)).toBe(false)
  })

  it('an override survives the end date moving', () => {
    const pinned = obligation({ end_date: inMonths(60), dti_override: false })
    const moved = { ...pinned, end_date: inMonths(2) }
    expect(isCountedInDti(moved)).toBe(false)
  })

  it('an obligation with no end date counts', () => {
    expect(isCountedInDti(obligation({ end_date: null }))).toBe(true)
  })

  it('honours a non-default threshold', () => {
    const o = obligation({ end_date: inMonths(24) })
    expect(isCountedInDti(o, DEFAULT_DTI_MONTHS_THRESHOLD)).toBe(true)
    expect(isCountedInDti(o, 36)).toBe(false)
  })
})

describe('totalMonthlyObligations', () => {
  it('sums only the obligations counted right now', () => {
    const list = [
      obligation({ id: 'a', monthly_payment: 1000, end_date: inMonths(40) }),
      obligation({ id: 'b', monthly_payment: 500, end_date: inMonths(6) }),
      obligation({ id: 'c', monthly_payment: 300, end_date: inMonths(6), dti_override: true }),
    ]
    expect(totalMonthlyObligations(list)).toBe(1300)
  })

  it('ignores the stale include_in_dti snapshot', () => {
    const list = [obligation({ monthly_payment: 900, end_date: inMonths(10), include_in_dti: true })]
    expect(totalMonthlyObligations(list)).toBe(0)
  })
})

describe('monthsUntilEnd', () => {
  it('returns null without an end date', () => {
    expect(monthsUntilEnd(null)).toBeNull()
    expect(monthsUntilEnd('not a date')).toBeNull()
  })

  it('counts the months left', () => {
    expect(monthsUntilEnd(inMonths(16))).toBe(16)
  })
})

describe('shouldIncludeInDti', () => {
  it('is the rule isCountedInDti falls back to', () => {
    const endDate = inMonths(16)
    expect(shouldIncludeInDti(endDate)).toBe(false)
    expect(isCountedInDti({ end_date: endDate, dti_override: null })).toBe(false)
  })
})
