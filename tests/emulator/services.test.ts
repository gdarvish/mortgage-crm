import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { signInAnonymously, signOut } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { mortgageService } from '@/services/mortgageService'
import { referralService } from '@/services/referralService'
import { commissionService } from '@/services/commissionService'
import { leadService } from '@/services/leadService'
import { customerService } from '@/services/customerService'
import { documentService } from '@/services/documentService'

/**
 * Service-layer regressions against a live emulator.
 *
 * None of the critical defects in the audit were reachable from a unit test:
 * a missing `where`, a missing index and a duplicate write all only fail
 * against a real Firestore.
 */

const PROJECT_ID = 'mortgage-crm-service-test'
let uid: string

/**
 * Writes a document straight through the emulator's REST API, bypassing the
 * rules. Used to plant another advisor's data, which the client — correctly —
 * cannot create itself.
 */
async function seedForeignDocument(collectionName: string, data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number') fields[key] = { integerValue: String(value) }
    else fields[key] = { stringValue: String(value) }
  }
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields }),
    },
  )
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`)
}

/** Deletes everything the emulator holds, between tests. */
async function clearFirestore() {
  await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
}

beforeAll(async () => {
  const credential = await signInAnonymously(auth)
  uid = credential.user.uid
})

afterAll(async () => {
  await signOut(auth)
})

beforeEach(async () => {
  await clearFirestore()
})

describe('mortgageService (PR-C regression)', () => {
  it('getByCustomer returns data rather than permission-denied', async () => {
    // Rules are not filters: before the fix, the loan_tracks and bank_responses
    // sub-queries omitted user_id and the whole read was rejected.
    const { data: mortgage, error: createError } = await mortgageService.create({
      customer_id: 'cust-1',
      type: 'חדשה',
      property_price: 2_000_000,
      property_type: 'דירה_ראשונה',
      own_capital: 600_000,
      loan_amount: 1_400_000,
      status: 'טיוטה',
      compliance_status: null,
      notes: null,
    })
    expect(createError).toBeNull()
    expect(mortgage).not.toBeNull()

    const { error: trackError } = await mortgageService.addTrack({
      mortgage_id: mortgage!.id,
      type: 'קל"צ',
      amount: 700_000,
      interest_rate: 4.5,
      period_months: 300,
      monthly_payment: 3_889,
      is_existing: false,
      start_date: null,
      end_date: null,
    })
    expect(trackError).toBeNull()

    const { data, error } = await mortgageService.getByCustomer('cust-1')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].loan_tracks).toHaveLength(1)
    expect(data![0].loan_tracks![0].type).toBe('קל"צ')
  })

  it('getById attaches tracks without permission-denied', async () => {
    const { data: mortgage } = await mortgageService.create({
      customer_id: 'cust-2',
      type: 'חדשה',
      property_price: 1_500_000,
      property_type: 'דירה_ראשונה',
      own_capital: 400_000,
      loan_amount: 1_100_000,
      status: 'טיוטה',
      compliance_status: null,
      notes: null,
    })
    await mortgageService.addTrack({
      mortgage_id: mortgage!.id,
      type: 'פריים',
      amount: 500_000,
      interest_rate: 6,
      period_months: 240,
      monthly_payment: 3_582,
      is_existing: false,
      start_date: null,
      end_date: null,
    })

    const { data, error } = await mortgageService.getById(mortgage!.id)
    expect(error).toBeNull()
    expect(data!.loan_tracks).toHaveLength(1)
  })

  it('does not return another advisor’s tracks', async () => {
    const { data: mortgage } = await mortgageService.create({
      customer_id: 'cust-3',
      type: 'חדשה',
      property_price: 1_000_000,
      property_type: 'דירה_ראשונה',
      own_capital: 300_000,
      loan_amount: 700_000,
      status: 'טיוטה',
      compliance_status: null,
      notes: null,
    })
    // A track on this mortgage belonging to somebody else must not come back.
    // Seeded through the emulator's REST API, which bypasses the rules — the
    // client could not write it, which is the point.
    await seedForeignDocument('loan_tracks', {
      user_id: 'someone-else',
      mortgage_id: mortgage!.id,
      type: 'קל"ב',
      amount: 1,
    })

    const { data } = await mortgageService.getById(mortgage!.id)
    expect(data!.loan_tracks).toHaveLength(0)
  })

  it('replaceTracks swaps the set rather than appending to it', async () => {
    const { data: mortgage } = await mortgageService.create({
      customer_id: 'cust-4',
      type: 'חדשה',
      property_price: 1_000_000,
      property_type: 'דירה_ראשונה',
      own_capital: 300_000,
      loan_amount: 700_000,
      status: 'טיוטה',
      compliance_status: null,
      notes: null,
    })
    const track = {
      type: 'קל"צ' as const,
      amount: 700_000,
      interest_rate: 4.5,
      period_months: 300,
      monthly_payment: 3_889,
      is_existing: false,
      start_date: null,
      end_date: null,
    }
    await mortgageService.replaceTracks(mortgage!.id, [track, { ...track, type: 'פריים' as const }])
    await mortgageService.replaceTracks(mortgage!.id, [track])

    const { data } = await mortgageService.getById(mortgage!.id)
    expect(data!.loan_tracks).toHaveLength(1)
    expect(data!.loan_tracks![0].type).toBe('קל"צ')
  })
})

describe('mortgage mix versioning (S2)', () => {
  async function seedFirstVersion() {
    const { data } = await mortgageService.create({
      customer_id: 'cust-v',
      type: 'חדשה',
      property_price: 2_000_000,
      property_type: 'דירה_ראשונה',
      own_capital: 600_000,
      loan_amount: 1_400_000,
      status: 'טיוטה',
      compliance_status: null,
      notes: null,
    })
    return data!
  }

  const versionTracks = [{
    type: 'קל"צ' as const,
    amount: 1_400_000,
    interest_rate: 4.5,
    period_months: 300,
    monthly_payment: 7_778,
    is_existing: false,
    start_date: null,
    end_date: null,
  }]

  const snapshot = { dti: 33, ltv: 70, monthly_payment: 7_778, total_cost: 2_333_400, compliance: null }

  it('a first mix is version 1 with no parent', async () => {
    const first = await seedFirstVersion()
    expect(first.version).toBe(1)
    expect(first.parent_mortgage_id).toBeNull()
    expect(first.source).toBe('advisor')
  })

  it('a derived version numbers above every existing one and keeps its parent', async () => {
    const first = await seedFirstVersion()
    const { data: second, error } = await mortgageService.createVersion({
      customerId: 'cust-v',
      parent: first,
      label: 'אחרי מו"מ',
      source: 'advisor',
      propertyPrice: 2_000_000,
      propertyType: 'דירה_ראשונה',
      ownCapital: 600_000,
      loanAmount: 1_400_000,
      snapshot,
      tracks: versionTracks,
    })
    expect(error).toBeNull()
    expect(second!.version).toBe(2)
    expect(second!.parent_mortgage_id).toBe(first.id)
    expect(second!.version_label).toBe('אחרי מו"מ')
  })

  it('does not lose the version it was derived from', async () => {
    const first = await seedFirstVersion()
    await mortgageService.createVersion({
      customerId: 'cust-v', parent: first, label: 'v2', source: 'advisor',
      propertyPrice: 2_000_000, propertyType: 'דירה_ראשונה', ownCapital: 600_000,
      loanAmount: 1_400_000, snapshot, tracks: versionTracks,
    })
    const { data } = await mortgageService.getByCustomer('cust-v')
    expect(data).toHaveLength(2)
    expect(data!.map(m => m.version).sort()).toEqual([1, 2])
  })

  it('numbers a third version above both, not above its own parent', async () => {
    const first = await seedFirstVersion()
    const { data: second } = await mortgageService.createVersion({
      customerId: 'cust-v', parent: first, label: 'v2', source: 'advisor',
      propertyPrice: 2_000_000, propertyType: 'דירה_ראשונה', ownCapital: 600_000,
      loanAmount: 1_400_000, snapshot, tracks: versionTracks,
    })
    // Branching from v1 again must still produce v3, not a second v2.
    const { data: third } = await mortgageService.createVersion({
      customerId: 'cust-v', parent: first, label: 'v3', source: 'bank_offer',
      propertyPrice: 2_000_000, propertyType: 'דירה_ראשונה', ownCapital: 600_000,
      loanAmount: 1_400_000, snapshot, tracks: versionTracks,
    })
    expect(second!.version).toBe(2)
    expect(third!.version).toBe(3)
    expect(third!.source).toBe('bank_offer')
  })

  it('freezes the snapshot on the version', async () => {
    const first = await seedFirstVersion()
    const { data: second } = await mortgageService.createVersion({
      customerId: 'cust-v', parent: first, label: 'מזרחי', source: 'bank_offer',
      propertyPrice: 2_000_000, propertyType: 'דירה_ראשונה', ownCapital: 600_000,
      loanAmount: 1_400_000,
      snapshot: { ...snapshot, bank_name: 'מזרחי' },
      tracks: versionTracks,
    })
    const { data: reloaded } = await mortgageService.getById(second!.id)
    expect(reloaded!.snapshot!.monthly_payment).toBe(7_778)
    expect(reloaded!.snapshot!.bank_name).toBe('מזרחי')
  })

  it('carries its own tracks', async () => {
    const first = await seedFirstVersion()
    const { data: second } = await mortgageService.createVersion({
      customerId: 'cust-v', parent: first, label: null, source: 'advisor',
      propertyPrice: 2_000_000, propertyType: 'דירה_ראשונה', ownCapital: 600_000,
      loanAmount: 1_400_000, snapshot, tracks: versionTracks,
    })
    const { data: reloaded } = await mortgageService.getById(second!.id)
    expect(reloaded!.loan_tracks).toHaveLength(1)
    expect(reloaded!.loan_tracks![0].interest_rate).toBe(4.5)
  })
})

describe('index-backed queries (PR-D regression)', () => {
  it('referralService.getAll does not fail with failed-precondition', async () => {
    await referralService.create({
      name: 'שותף',
      type: 'עורך דין',
      phone: null,
      email: null,
      total_referrals: 3,
      converted_referrals: 1,
      notes: null,
    })
    const { data, error } = await referralService.getAll()
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('commissionService.getAll does not fail with failed-precondition', async () => {
    await commissionService.create({
      customer_id: 'cust-1',
      mortgage_id: null,
      amount: 12_000,
      status: 'ממתין',
      payment_date: null,
      notes: null,
    })
    const { data, error } = await commissionService.getAll()
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('commissionService.getAll survives a status filter', async () => {
    await commissionService.create({
      customer_id: 'cust-1',
      mortgage_id: null,
      amount: 9_000,
      status: 'שולם',
      payment_date: null,
      notes: null,
    })
    const { error } = await commissionService.getAll({ status: 'שולם' })
    expect(error).toBeNull()
  })
})

describe('leadService.convertToCustomer (PR-K.1 regression)', () => {
  async function seedLead() {
    const { data } = await leadService.create({
      name: 'ישראל ישראלי',
      phone: '050-1234567',
      email: 'a@b.c',
      source: 'הפניה',
      score: 80,
      status: 'חדש',
      notes: 'רוצה דירה ראשונה',
      referral_partner_id: null,
    })
    return data!
  }

  it('creates exactly one customer and links the lead to it', async () => {
    const lead = await seedLead()
    const { data: customer, error } = await leadService.convertToCustomer(lead.id)
    expect(error).toBeNull()
    expect(customer).not.toBeNull()

    const all = await getDocs(query(collection(db, 'customers'), where('user_id', '==', uid)))
    expect(all.size).toBe(1)
  })

  it('a second conversion returns the same customer, not a duplicate', async () => {
    const lead = await seedLead()
    const first = await leadService.convertToCustomer(lead.id)
    const second = await leadService.convertToCustomer(lead.id)

    expect(second.error).toBeNull()
    expect(second.data!.id).toBe(first.data!.id)

    const all = await getDocs(query(collection(db, 'customers'), where('user_id', '==', uid)))
    expect(all.size).toBe(1)
  })

  it('carries the lead’s notes and score into the case (PR-K.2)', async () => {
    const lead = await seedLead()
    const { data: customer } = await leadService.convertToCustomer(lead.id)
    expect(customer!.notes).toContain('רוצה דירה ראשונה')
    expect(customer!.notes).toContain('80')
  })
})

describe('customerService.findDuplicateIdNumber (PR-K.7)', () => {
  it('finds another case carrying the same national ID', async () => {
    const { data: first } = await customerService.create({
      first_name: 'א', last_name: 'א', id_number: '123456782',
      phone: null, email: null, address: null, marital_status: null, children: 0,
      monthly_income: null, partner_income: null, own_capital: null,
      existing_obligations: 0, lead_source: null, status: 'ליד', notes: null,
      referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
    })
    const { data: second } = await customerService.create({
      first_name: 'ב', last_name: 'ב', id_number: '123456782',
      phone: null, email: null, address: null, marital_status: null, children: 0,
      monthly_income: null, partner_income: null, own_capital: null,
      existing_obligations: 0, lead_source: null, status: 'ליד', notes: null,
      referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
    })

    const { data: duplicate } = await customerService.findDuplicateIdNumber('123456782', second!.id)
    expect(duplicate!.id).toBe(first!.id)
  })

  it('returns nothing when the ID is unique', async () => {
    const { data } = await customerService.findDuplicateIdNumber('999999999')
    expect(data).toBeNull()
  })
})

describe('documentService.upload (PR-L.2 regression)', () => {
  /** A File stand-in the upload path can inspect. */
  function fakeFile(name: string, type: string, size: number): File {
    return new File([new Uint8Array(Math.min(size, 1024))], name, { type })
  }

  it('rejects a disallowed file type before touching Storage', async () => {
    const { data, error } = await documentService.upload(
      'cust-1', fakeFile('x.exe', 'application/x-msdownload', 1024), 'תעודת זהות', 'זיהוי',
    )
    expect(data).toBeNull()
    expect(error!.message).toContain('סוג קובץ לא נתמך')

    const docs = await getDocs(query(collection(db, 'documents'), where('user_id', '==', uid)))
    expect(docs.size).toBe(0)
  })

  it('rejects an oversized file', async () => {
    const big = fakeFile('big.pdf', 'application/pdf', 1024)
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    const { data, error } = await documentService.upload('cust-1', big, 'הסכם רכישה', 'נכס')
    expect(data).toBeNull()
    expect(error!.message).toContain('גדול')
  })
})
