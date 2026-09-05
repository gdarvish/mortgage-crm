// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CaseSummaryBar } from '@/components/customer/CaseSummaryBar'
import { buildCaseSnapshot } from '@/utils/caseSnapshot'
import { FALLBACK_REGULATORY_PARAMS } from '@/utils/regulatoryParams'
import { formatCheckValue, checkCompliance, type TrackInput } from '@/utils/mortgageCalculations'
import type { Customer, MortgageWithTracks, LoanTrack } from '@/types/database'

/**
 * Critical path 4: every compliance figure is shown with its own unit.
 *
 * The term check read "300%" and the age check "88%" because the display
 * appended a percent sign to every row regardless of what it measured.
 */

const now = new Date().toISOString()

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'c1', user_id: 'u1', first_name: 'ישראל', last_name: 'ישראלי',
    id_number: null, phone: null, email: null, address: null,
    marital_status: null, children: 0,
    monthly_income: 20_000, partner_income: 5_000, own_capital: 500_000,
    existing_obligations: 0, lead_source: null, status: 'אישור', notes: null,
    referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
    created_at: now, updated_at: now, ...over,
  }
}

function track(over: Partial<LoanTrack> = {}): LoanTrack {
  return {
    id: 't1', user_id: 'u1', mortgage_id: 'm1', type: 'קל"צ',
    amount: 700_000, interest_rate: 4.5, period_months: 300,
    monthly_payment: 3_889, is_existing: false,
    start_date: null, end_date: null, created_at: now, ...over,
  }
}

function mortgage(over: Partial<MortgageWithTracks> = {}): MortgageWithTracks {
  return {
    id: 'm1', customer_id: 'c1', type: 'חדשה',
    property_price: 2_000_000, property_type: 'דירה_ראשונה',
    own_capital: 600_000, loan_amount: 1_400_000, status: 'אושר',
    compliance_status: null, notes: null, created_at: now,
    loan_tracks: [
      track(),
      track({ id: 't2', type: 'פריים', amount: 700_000, interest_rate: 6, period_months: 240 }),
    ],
    ...over,
  }
}

function snapshotOf(mortgages: MortgageWithTracks[], over: Partial<Customer> = {}) {
  return buildCaseSnapshot({
    customer: customer(over),
    borrowers: [],
    obligations: [],
    documents: [],
    appraisals: [],
    mortgages,
    params: FALLBACK_REGULATORY_PARAMS,
  })
}

describe('compliance values carry their own units', () => {
  it('the term check is rendered in months, not percent', () => {
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 700_000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 300_000, interestRate: 6, periodMonths: 240 },
    ]
    const result = checkCompliance(tracks, 2_000_000, 'דירה_ראשונה', 25_000)
    const period = result.checks.find(c => c.name.includes('תקופה'))!
    expect(formatCheckValue(period)).toBe('300 חודשים')
    expect(formatCheckValue(period)).not.toContain('%')
  })

  it('the age check is rendered as a plain number of years', () => {
    const born = new Date()
    born.setFullYear(born.getFullYear() - 62)
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 700_000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 300_000, interestRate: 6, periodMonths: 240 },
    ]
    const result = checkCompliance(
      tracks, 2_000_000, 'דירה_ראשונה', 25_000, 0, null, [born.toISOString()],
    )
    const age = result.checks.find(c => c.name.includes('גיל'))!
    expect(formatCheckValue(age)).toBe('87')
  })

  it('percentage checks keep their percent sign', () => {
    const tracks: TrackInput[] = [
      { type: 'קל"צ', amount: 700_000, interestRate: 4.5, periodMonths: 300 },
      { type: 'פריים', amount: 300_000, interestRate: 6, periodMonths: 240 },
    ]
    const result = checkCompliance(tracks, 2_000_000, 'דירה_ראשונה', 25_000)
    for (const check of result.checks.filter(c => c.unit === '%')) {
      expect(formatCheckValue(check)).toMatch(/%$/)
    }
  })
})

describe('the case summary bar', () => {
  it('shows the headline figures for a case with a mix', () => {
    const snapshot = snapshotOf([mortgage()])
    render(<CaseSummaryBar snapshot={snapshot} />)

    expect(screen.getByText('סטטוס')).toBeInTheDocument()
    expect(screen.getByText('אישור')).toBeInTheDocument()
    expect(screen.getByText('LTV')).toBeInTheDocument()
    expect(screen.getByText('DTI')).toBeInTheDocument()
    expect(screen.getByText('מסמכים')).toBeInTheDocument()
  })

  it('says so when the case has no mix, rather than showing zeros', () => {
    render(<CaseSummaryBar snapshot={snapshotOf([])} />)
    expect(screen.getByText('ללא תמהיל')).toBeInTheDocument()
    expect(screen.queryByText('LTV')).not.toBeInTheDocument()
  })

  it('marks a compliant mix as תקין and a breaching one as חריגה', () => {
    render(<CaseSummaryBar snapshot={snapshotOf([mortgage()])} />)
    expect(screen.getByText('תקין')).toBeInTheDocument()

    // A mix that is all prime breaches the fixed-rate floor.
    const allPrime = mortgage({
      loan_tracks: [track({ type: 'פריים', amount: 1_400_000, interest_rate: 6 })],
    })
    render(<CaseSummaryBar snapshot={snapshotOf([allPrime])} />)
    expect(screen.getAllByText('חריגה').length).toBeGreaterThan(0)
  })

  it('counts down an approval that is about to expire', () => {
    const in10 = new Date(Date.now() + 10 * 86_400_000).toISOString()
    render(<CaseSummaryBar snapshot={snapshotOf([mortgage({ approval_expires_at: in10 })])} />)
    expect(screen.getByText('אישור עקרוני')).toBeInTheDocument()
    expect(screen.getByText('10 ימים')).toBeInTheDocument()
  })

  it('says outright when an approval has already lapsed', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    render(<CaseSummaryBar snapshot={snapshotOf([mortgage({ approval_expires_at: yesterday })])} />)
    expect(screen.getByText('פג תוקף')).toBeInTheDocument()
  })
})
