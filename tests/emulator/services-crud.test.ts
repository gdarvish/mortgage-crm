import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { signInAnonymously, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { customerService } from '@/services/customerService'
import { leadService } from '@/services/leadService'
import { taskService } from '@/services/taskService'
import { messageService } from '@/services/messageService'
import { alertService } from '@/services/alertService'
import { commissionService } from '@/services/commissionService'
import { referralService } from '@/services/referralService'
import { obligationService } from '@/services/obligationService'
import { appraisalService } from '@/services/appraisalService'
import { borrowerService } from '@/services/borrowerService'
import { bankOfferService } from '@/services/bankOfferService'
import { disbursementService } from '@/services/disbursementService'
import { meetingService } from '@/services/meetingService'
import { signatureService } from '@/services/signatureService'
import { settingsService } from '@/services/settingsService'
import { regulatoryService } from '@/services/regulatoryService'

/**
 * CRUD coverage for the service layer, against a live emulator.
 *
 * Every service writes, reads back and updates at least once, so a query that
 * cannot run — a missing user_id filter, a wrong field name, a rules
 * mismatch — fails here rather than in front of an advisor.
 */

const PROJECT_ID = 'mortgage-crm-service-test'
const CUSTOMER = 'cust-crud'

async function clearFirestore() {
  await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
}

beforeAll(async () => { await signInAnonymously(auth) })
afterAll(async () => { await signOut(auth) })
beforeEach(async () => { await clearFirestore() })

describe('customerService', () => {
  const base = {
    first_name: 'ישראל', last_name: 'ישראלי', id_number: '123456782',
    phone: '050-1234567', email: 'a@b.c', address: null, marital_status: 'נשוי',
    children: 2, monthly_income: 20_000, partner_income: 8_000, own_capital: 500_000,
    existing_obligations: 0, lead_source: 'הפניה', status: 'ליד' as const, notes: null,
    referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
  }

  it('creates, lists, updates and deletes', async () => {
    const { data: created, error } = await customerService.create(base)
    expect(error).toBeNull()
    expect(created!.first_name).toBe('ישראל')

    const { data: all } = await customerService.getAll()
    expect(all).toHaveLength(1)

    await customerService.update(created!.id, { status: 'פגישה' })
    const { data: reloaded } = await customerService.getById(created!.id)
    expect(reloaded!.status).toBe('פגישה')

    await customerService.delete(created!.id)
    const { data: after } = await customerService.getAll()
    expect(after).toHaveLength(0)
  })

  it('filters by status', async () => {
    await customerService.create(base)
    await customerService.create({ ...base, id_number: null, status: 'אישור' })
    const { data, error } = await customerService.getAll({ status: 'אישור' })
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('searches client-side by name and phone', async () => {
    await customerService.create(base)
    const { data: byName } = await customerService.getAll({ search: 'ישראלי' })
    const { data: byPhone } = await customerService.getAll({ search: '050' })
    const { data: miss } = await customerService.getAll({ search: 'כהן' })
    expect(byName).toHaveLength(1)
    expect(byPhone).toHaveLength(1)
    expect(miss).toHaveLength(0)
  })

  it('paginates', async () => {
    for (let i = 0; i < 3; i++) await customerService.create({ ...base, id_number: null, first_name: `ל${i}` })
    const { data, error } = await customerService.getPaginated({ pageSize: 2 })
    expect(error).toBeNull()
    expect(data!.items).toHaveLength(2)
    expect(data!.hasMore).toBe(true)

    const { data: page2 } = await customerService.getPaginated({ pageSize: 2, cursor: data!.nextCursor })
    expect(page2!.items).toHaveLength(1)
    expect(page2!.hasMore).toBe(false)
  })
})

describe('leadService', () => {
  const base = {
    name: 'דנה כהן', phone: '052-7654321', email: null, source: 'פייסבוק',
    score: 60, status: 'חדש' as const, notes: null, referral_partner_id: null,
  }

  it('creates, lists, filters and updates', async () => {
    const { data: created, error } = await leadService.create(base)
    expect(error).toBeNull()

    const { data: all } = await leadService.getAll()
    expect(all).toHaveLength(1)

    const { data: filtered, error: filterError } = await leadService.getAll({ source: 'פייסבוק' })
    expect(filterError).toBeNull()
    expect(filtered).toHaveLength(1)

    await leadService.update(created!.id, { status: 'בטיפול' })
    const { data: after } = await leadService.getAll({ status: 'בטיפול' })
    expect(after).toHaveLength(1)
  })

  it('filters by status and source together', async () => {
    await leadService.create(base)
    const { error } = await leadService.getAll({ status: 'חדש', source: 'פייסבוק' })
    expect(error).toBeNull()
  })

  it('deletes', async () => {
    const { data } = await leadService.create(base)
    await leadService.delete(data!.id)
    const { data: after } = await leadService.getAll()
    expect(after).toHaveLength(0)
  })
})

describe('taskService', () => {
  const base = {
    customer_id: CUSTOMER, title: 'לאסוף תלושים',
    due_date: new Date().toISOString(), priority: 'גבוהה' as const,
    status: 'פתוחה' as const, notes: null,
  }

  it('creates, lists, filters and completes', async () => {
    const { data: created, error } = await taskService.create(base)
    expect(error).toBeNull()

    const { data: all, error: listError } = await taskService.getAll()
    expect(listError).toBeNull()
    expect(all).toHaveLength(1)

    const { error: filterError } = await taskService.getAll({ status: 'פתוחה' })
    expect(filterError).toBeNull()

    const { error: customerFilterError } = await taskService.getAll({ customerId: CUSTOMER })
    expect(customerFilterError).toBeNull()

    await taskService.update(created!.id, { status: 'הושלמה' })
    const { data: done } = await taskService.getAll({ status: 'הושלמה' })
    expect(done).toHaveLength(1)

    await taskService.delete(created!.id)
    expect((await taskService.getAll()).data).toHaveLength(0)
  })

  it('lists today’s open tasks', async () => {
    await taskService.create(base)
    const { error } = await taskService.getTodayTasks()
    expect(error).toBeNull()
  })
})

describe('messageService', () => {
  it('records and reads a customer’s messages', async () => {
    const { error } = await messageService.create({
      customer_id: CUSTOMER, channel: 'whatsapp', direction: 'יוצא',
      content: 'שלום', status: 'sent', sent_at: new Date().toISOString(),
    })
    expect(error).toBeNull()
    const { data, error: readError } = await messageService.getByCustomer(CUSTOMER)
    expect(readError).toBeNull()
    expect(data).toHaveLength(1)
  })
})

describe('obligationService', () => {
  const base = {
    customer_id: CUSTOMER, type: 'הלוואה בנקאית' as const, lender: 'בנק',
    monthly_payment: 1_500, balance: 40_000, end_date: null,
    include_in_dti: true, dti_override: null, notes: null,
  }

  it('creates, reads, updates and deletes', async () => {
    const { data: created, error } = await obligationService.create(base)
    expect(error).toBeNull()

    const { data, error: readError } = await obligationService.getByCustomer(CUSTOMER)
    expect(readError).toBeNull()
    expect(data).toHaveLength(1)

    await obligationService.update(created!.id, { dti_override: false })
    const { data: after } = await obligationService.getByCustomer(CUSTOMER)
    expect(after![0].dti_override).toBe(false)

    await obligationService.delete(created!.id)
    expect((await obligationService.getByCustomer(CUSTOMER)).data).toHaveLength(0)
  })
})

describe('appraisalService', () => {
  it('creates, reads and updates', async () => {
    const { data: created, error } = await appraisalService.create({
      customer_id: CUSTOMER, mortgage_id: null, property_address: 'רחוב 1',
      appraiser_name: 'שמאי', appraiser_phone: null, status: 'הוזמנה',
      ordered_at: new Date().toISOString(), scheduled_at: null, received_at: null,
      purchase_price: 2_000_000, appraised_value: null, document_id: null, notes: null,
    })
    expect(error).toBeNull()

    await appraisalService.update(created!.id, { status: 'התקבלה', appraised_value: 1_900_000 })
    const { data, error: readError } = await appraisalService.getByCustomer(CUSTOMER)
    expect(readError).toBeNull()
    expect(data![0].appraised_value).toBe(1_900_000)
  })
})

describe('borrowerService', () => {
  it('creates, reads, updates and deletes', async () => {
    const { data: created, error } = await borrowerService.create({
      customer_id: CUSTOMER, role: 'לווה שני', first_name: 'רות', last_name: 'כהן',
      id_number: null, phone: null, email: null, birth_date: '1985-01-01',
      employment_type: 'שכיר', monthly_income: 9_000,
    })
    expect(error).toBeNull()

    const { data, error: readError } = await borrowerService.getByCustomer(CUSTOMER)
    expect(readError).toBeNull()
    expect(data).toHaveLength(1)

    await borrowerService.update(created!.id, { monthly_income: 11_000 })
    expect((await borrowerService.getByCustomer(CUSTOMER)).data![0].monthly_income).toBe(11_000)

    await borrowerService.delete(created!.id)
    expect((await borrowerService.getByCustomer(CUSTOMER)).data).toHaveLength(0)
  })
})

describe('bankOfferService', () => {
  it('creates, reads and updates offers for a mortgage', async () => {
    const { data: created, error } = await bankOfferService.create({
      customer_id: CUSTOMER, mortgage_id: 'm1', bank_name: 'מזרחי', round: 1,
      offer_date: null, valid_until: null,
      tracks: [{ type: 'קל"צ', amount: 700_000, interest_rate: 4.3, period_months: 300 }],
      status: 'התקבלה', bank_response_id: null, notes: null,
    })
    expect(error).toBeNull()

    const { data, error: readError } = await bankOfferService.getByMortgage('m1')
    expect(readError).toBeNull()
    expect(data).toHaveLength(1)

    await bankOfferService.update(created!.id, { status: 'נבחרה' })
    expect((await bankOfferService.getByMortgage('m1')).data![0].status).toBe('נבחרה')
  })
})

describe('disbursementService', () => {
  it('creates, reads and updates', async () => {
    const { data: created, error } = await disbursementService.create({
      customer_id: CUSTOMER, mortgage_id: null, payee: 'מוכר', amount: 500_000,
      due_date: new Date().toISOString(), status: 'מתוכנן', paid_at: null, notes: null,
    })
    expect(error).toBeNull()

    await disbursementService.update(created!.id, { status: 'שולם' })
    const { data, error: readError } = await disbursementService.getByCustomer(CUSTOMER)
    expect(readError).toBeNull()
    expect(data![0].status).toBe('שולם')
  })
})

describe('meetingService', () => {
  it('creates, lists and lists today', async () => {
    const starts = new Date()
    starts.setHours(starts.getHours() + 1)
    const { error } = await meetingService.create({
      customer_id: CUSTOMER, title: 'פגישת ייעוץ',
      starts_at: starts.toISOString(), ends_at: null, location: null,
      status: 'מתוכננת', reminder_sent: false, notes: null,
    })
    expect(error).toBeNull()

    const { data, error: listError } = await meetingService.getAll()
    expect(listError).toBeNull()
    expect(data).toHaveLength(1)

    const { error: todayError } = await meetingService.getToday()
    expect(todayError).toBeNull()
  })
})

describe('referralService', () => {
  it('creates, lists and updates', async () => {
    const { data: created, error } = await referralService.create({
      name: 'עו"ד לוי', type: 'עורך דין', phone: null, email: null,
      total_referrals: 2, converted_referrals: 1, notes: null,
    })
    expect(error).toBeNull()

    const { data, error: listError } = await referralService.getAll()
    expect(listError).toBeNull()
    expect(data).toHaveLength(1)

    await referralService.update(created!.id, { total_referrals: 5 })
    const { data: reloaded } = await referralService.getById(created!.id)
    expect(reloaded!.total_referrals).toBe(5)
  })
})

describe('commissionService', () => {
  it('creates, lists, filters by period and updates', async () => {
    const { data: created, error } = await commissionService.create({
      customer_id: CUSTOMER, mortgage_id: null, amount: 12_000,
      status: 'ממתין', payment_date: null, notes: null,
    })
    expect(error).toBeNull()

    const { data, error: listError } = await commissionService.getAll()
    expect(listError).toBeNull()
    expect(data).toHaveLength(1)

    const from = new Date(Date.now() - 86_400_000).toISOString()
    const to = new Date(Date.now() + 86_400_000).toISOString()
    const { error: periodError } = await commissionService.getAll({ period: { from, to } })
    expect(periodError).toBeNull()

    await commissionService.update(created!.id, { status: 'שולם' })
    expect((await commissionService.getAll({ status: 'שולם' })).data).toHaveLength(1)
  })
})

describe('alertService', () => {
  it('lists, snoozes and marks handled', async () => {
    const { data, error } = await alertService.getAll({ status: 'פתוח' })
    expect(error).toBeNull()
    expect(data).toEqual([])

    const { count, error: countError } = await alertService.getActiveCount()
    expect(countError).toBeNull()
    expect(count).toBe(0)
  })
})

describe('signatureService', () => {
  // createRequest builds a browser-facing signing URL from window.location, so
  // the node test environment has to supply one.
  beforeAll(() => {
    ;(globalThis as { window?: unknown }).window = { location: { origin: 'https://example.test' } }
  })
  afterAll(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('creates a request and lists it for the customer', async () => {
    const { data, error } = await signatureService.createRequest({
      customer_id: CUSTOMER, customer_name: 'ישראל ישראלי', document_name: 'ייפוי כוח',
    })
    expect(error).toBeNull()
    expect(data!.url).toBe(`https://example.test/sign/${data!.token}`)

    const { data: list, error: listError } = await signatureService.listByCustomer(CUSTOMER)
    expect(listError).toBeNull()
    expect(list).toHaveLength(1)
  })
})

describe('settingsService', () => {
  it('returns null before anything is saved, then round-trips', async () => {
    const { data: empty, error } = await settingsService.get()
    expect(error).toBeNull()
    expect(empty).toBeNull()

    await settingsService.upsert({ name: 'יועץ', dti_warn_threshold: 38 })
    const { data } = await settingsService.get()
    expect(data!.name).toBe('יועץ')
    expect(data!.dti_warn_threshold).toBe(38)

    // Merges rather than replaces.
    await settingsService.upsert({ dti_hard_threshold: 48 })
    const { data: merged } = await settingsService.get()
    expect(merged!.name).toBe('יועץ')
    expect(merged!.dti_hard_threshold).toBe(48)
  })
})

describe('regulatoryService', () => {
  it('falls back to the built-in parameters when nothing is published', async () => {
    const { data, error } = await regulatoryService.getAll()
    expect(error).toBeNull()
    expect(data).toEqual([])

    const params = await regulatoryService.getInForceAt()
    expect(params.id).toBe('fallback')
    expect(params.max_period_months).toBe(360)
  })
})
