import { describe, it, expect } from 'vitest'
import { buildCaseSnapshot } from './caseSnapshot'
import { FALLBACK_REGULATORY_PARAMS } from '@/utils/regulatoryParams'
import type {
  Customer, Borrower, Obligation, Appraisal, Document, MortgageWithTracks, LoanTrack,
} from '@/types/database'

const now = new Date().toISOString()

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'c1', user_id: 'u1', first_name: 'ישראל', last_name: 'ישראלי',
    id_number: null, phone: null, whatsapp_phone: null, email: null, address: null,
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
    loan_tracks: [track(), track({ id: 't2', type: 'פריים', amount: 700_000, interest_rate: 6, period_months: 240 })],
    ...over,
  }
}

function obligation(over: Partial<Obligation> = {}): Obligation {
  return {
    id: 'o1', user_id: 'u1', customer_id: 'c1', type: 'הלוואה בנקאית',
    lender: 'בנק', monthly_payment: 1_500, balance: null,
    end_date: null, include_in_dti: true, dti_override: null,
    notes: null, created_at: now, ...over,
  }
}

function build(over: Partial<Parameters<typeof buildCaseSnapshot>[0]> = {}) {
  return buildCaseSnapshot({
    customer: customer(),
    borrowers: [],
    obligations: [],
    documents: [],
    appraisals: [],
    mortgages: [mortgage()],
    params: FALLBACK_REGULATORY_PARAMS,
    ...over,
  })
}

describe('buildCaseSnapshot', () => {
  it('takes the current mix as the most recently created one', () => {
    const older = mortgage({ id: 'old', created_at: '2024-01-01T00:00:00.000Z' })
    const newer = mortgage({ id: 'new', created_at: '2026-01-01T00:00:00.000Z' })
    const snapshot = build({ mortgages: [older, newer] })
    expect(snapshot.mortgage!.id).toBe('new')
    expect(snapshot.mortgages.map(m => m.id)).toEqual(['new', 'old'])
  })

  it('household income counts co-borrowers but not guarantors', () => {
    const borrowers: Borrower[] = [
      { id: 'b1', user_id: 'u1', customer_id: 'c1', role: 'לווה שני', first_name: 'א', last_name: 'א', id_number: null, phone: null, email: null, birth_date: null, employment_type: null, monthly_income: 8_000, created_at: now },
      { id: 'b2', user_id: 'u1', customer_id: 'c1', role: 'ערב', first_name: 'ב', last_name: 'ב', id_number: null, phone: null, email: null, birth_date: null, employment_type: null, monthly_income: 30_000, created_at: now },
    ]
    expect(build({ borrowers }).householdIncome).toBe(28_000)
  })

  it('falls back to partner income when no borrowers are recorded', () => {
    expect(build().householdIncome).toBe(25_000)
  })

  it('obligations come from the collection, not the questionnaire field', () => {
    const snapshot = build({
      customer: customer({ existing_obligations: 9_999 }),
      obligations: [obligation({ monthly_payment: 1_500 }), obligation({ id: 'o2', monthly_payment: 500 })],
    })
    expect(snapshot.monthlyObligations).toBe(2_000)
  })

  it('uses the questionnaire figure only when no obligations are recorded', () => {
    const snapshot = build({ customer: customer({ existing_obligations: 1_200 }), obligations: [] })
    expect(snapshot.monthlyObligations).toBe(1_200)
  })

  it('an obligation ending inside the window does not count', () => {
    const soon = new Date(Date.now() + 10 * 30.44 * 86_400_000).toISOString()
    const snapshot = build({ obligations: [obligation({ end_date: soon, monthly_payment: 3_000 })] })
    expect(snapshot.monthlyObligations).toBe(0)
  })

  it('a received appraisal below the purchase price drives LTV', () => {
    const appraisals: Appraisal[] = [{
      id: 'a1', user_id: 'u1', customer_id: 'c1', mortgage_id: 'm1',
      property_address: null, appraiser_name: null, appraiser_phone: null,
      status: 'התקבלה', ordered_at: null, scheduled_at: null, received_at: now,
      purchase_price: 2_000_000, appraised_value: 1_600_000,
      document_id: null, notes: null, created_at: now,
    }]
    const atPrice = build()
    const atAppraisal = build({ appraisals })
    expect(atPrice.propertyValue).toBe(2_000_000)
    expect(atAppraisal.propertyValue).toBe(1_600_000)
    expect(atAppraisal.ltv).toBeGreaterThan(atPrice.ltv)
    expect(atAppraisal.additionalEquityRequired).toBeGreaterThan(0)
  })

  it('an appraisal that has not come back yet is ignored', () => {
    const appraisals: Appraisal[] = [{
      id: 'a1', user_id: 'u1', customer_id: 'c1', mortgage_id: 'm1',
      property_address: null, appraiser_name: null, appraiser_phone: null,
      status: 'הוזמנה', ordered_at: now, scheduled_at: null, received_at: null,
      purchase_price: 2_000_000, appraised_value: 1_600_000,
      document_id: null, notes: null, created_at: now,
    }]
    expect(build({ appraisals }).propertyValue).toBe(2_000_000)
  })

  it('DTI combines the mix payment with the counted obligations', () => {
    const snapshot = build({ obligations: [obligation({ monthly_payment: 2_500 })] })
    const expected = ((snapshot.monthlyPayment + 2_500) / snapshot.householdIncome) * 100
    expect(snapshot.dti).toBeCloseTo(Math.round(expected * 10) / 10, 1)
  })

  it('changing an obligation moves the DTI', () => {
    const light = build({ obligations: [obligation({ monthly_payment: 500 })] })
    const heavy = build({ obligations: [obligation({ monthly_payment: 5_000 })] })
    expect(heavy.dti).toBeGreaterThan(light.dti)
  })

  it('pre-existing loans are excluded from the mix', () => {
    const withExisting = mortgage({
      loan_tracks: [track(), track({ id: 't9', is_existing: true, amount: 900_000 })],
    })
    expect(build({ mortgages: [withExisting] }).loanAmount).toBe(700_000)
  })

  it('counts missing checklist documents', () => {
    const snapshot = build({ documents: [] })
    expect(snapshot.uploadedDocumentCount).toBe(0)
    expect(snapshot.requiredDocumentCount).toBeGreaterThan(0)
    expect(snapshot.missingDocuments).toHaveLength(snapshot.requiredDocumentCount)
  })

  it('an uploaded document satisfies its checklist entry', () => {
    const documents: Document[] = [{
      id: 'd1', customer_id: 'c1', type: 'תעודת זהות + ספח',
      file_url: null, file_name: 'id.pdf', file_size: 1, status: 'תקין',
      ocr_data: null, expires_at: null, uploaded_at: now, category: 'זיהוי',
    }]
    const snapshot = build({ documents })
    expect(snapshot.uploadedDocumentCount).toBe(1)
    expect(snapshot.missingDocuments).not.toContain('תעודת זהות + ספח')
  })

  it('an expired document does not satisfy its entry', () => {
    const documents: Document[] = [{
      id: 'd1', customer_id: 'c1', type: 'תעודת זהות + ספח',
      file_url: null, file_name: 'id.pdf', file_size: 1, status: 'פג תוקף',
      ocr_data: null, expires_at: null, uploaded_at: now, category: 'זיהוי',
    }]
    expect(build({ documents }).missingDocuments).toContain('תעודת זהות + ספח')
  })

  it('counts the days left on the principle approval', () => {
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString()
    expect(build({ mortgages: [mortgage({ approval_expires_at: in30 })] }).approvalDaysLeft).toBe(30)
  })

  it('reports no approval countdown when there is no expiry', () => {
    expect(build().approvalDaysLeft).toBeNull()
  })

  it('a case with no mix still produces a snapshot', () => {
    const snapshot = build({ mortgages: [] })
    expect(snapshot.mortgage).toBeNull()
    expect(snapshot.loanAmount).toBe(0)
    expect(snapshot.dti).toBe(0)
    expect(Number.isFinite(snapshot.ltv)).toBe(true)
  })
})
