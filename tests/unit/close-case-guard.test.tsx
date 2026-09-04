// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CustomerWithRelations, MortgageWithTracks } from '@/types/database'

/**
 * Critical path 3: closing a case before the insurance has been issued.
 *
 * Also covers PR-K.3 — the status used to be written only by the personal
 * tab's save button, so changing it and navigating away lost it silently.
 */

const updates = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }))
const now = new Date().toISOString()

vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {}, functions: {}, app: {} }))
vi.mock('firebase/functions', () => ({ httpsCallable: () => async () => ({ data: {} }) }))

vi.mock('@/services/customerService', () => ({
  customerService: {
    update: vi.fn(async (_id: string, payload: Record<string, unknown>) => {
      updates.calls.push(payload)
      return { data: { id: 'c1', ...payload }, error: null }
    }),
    findDuplicateIdNumber: vi.fn(async () => ({ data: null, error: null })),
    delete: vi.fn(async () => ({ error: null })),
  },
}))

vi.mock('@/services/obligationService', () => ({
  obligationService: { getByCustomer: vi.fn(async () => ({ data: [], error: null })) },
}))

const snapshotValue = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/hooks/queries/useCaseSnapshot', () => ({
  useCaseSnapshot: () => ({ data: snapshotValue.current, isLoading: false, isError: false }),
  caseSnapshotKey: (id: string) => ['case-snapshot', id],
}))

const CUSTOMER = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/hooks/queries/useCustomers', () => ({
  useCustomer: () => ({ data: CUSTOMER.current, isLoading: false }),
}))

function mortgage(over: Partial<MortgageWithTracks> = {}): MortgageWithTracks {
  return {
    id: 'm1', customer_id: 'c1', type: 'חדשה',
    property_price: 2_000_000, property_type: 'דירה_ראשונה',
    own_capital: 600_000, loan_amount: 1_400_000, status: 'אושר',
    compliance_status: null, notes: null, created_at: now,
    loan_tracks: [],
    life_insurance_status: 'נדרש',
    property_insurance_status: 'נדרש',
    ...over,
  }
}

function customer(mortgages: MortgageWithTracks[]): CustomerWithRelations {
  return {
    id: 'c1', user_id: 'u1', first_name: 'ישראל', last_name: 'ישראלי',
    id_number: null, phone: null, email: null, address: null,
    marital_status: 'נשוי', children: 0,
    monthly_income: 20_000, partner_income: 0, own_capital: 500_000,
    existing_obligations: 0, lead_source: null, status: 'ביצוע', notes: null,
    referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
    created_at: now, updated_at: now,
    documents: [], mortgages, tasks: [], messages: [], commissions: [],
  }
}

async function renderCase() {
  const { default: CustomerDetailPage } = await import('@/pages/CustomerDetailPage')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/customers/c1']}>
        <Routes>
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  updates.calls = []
  snapshotValue.current = null
  CUSTOMER.current = customer([mortgage()])
})

describe('closing a case', () => {
  it('warns before closing while the insurance is not issued', async () => {
    const user = userEvent.setup()
    await renderCase()

    await user.click(await screen.findByRole('button', { name: 'סגירה' }))

    expect(await screen.findByText(/הביטוחים טרם הופקו/)).toBeInTheDocument()
    // Nothing is written until the advisor confirms.
    expect(updates.calls).toHaveLength(0)
  })

  it('closes once the advisor confirms', async () => {
    const user = userEvent.setup()
    await renderCase()

    await user.click(await screen.findByRole('button', { name: 'סגירה' }))
    await user.click(await screen.findByRole('button', { name: 'סגור בכל זאת' }))

    await waitFor(() => expect(updates.calls).toContainEqual({ status: 'סגירה' }))
  })

  it('does not warn when both insurances have been issued', async () => {
    CUSTOMER.current = customer([
      mortgage({ life_insurance_status: 'הופק', property_insurance_status: 'הופק' }),
    ])
    const user = userEvent.setup()
    await renderCase()

    await user.click(await screen.findByRole('button', { name: 'סגירה' }))

    await waitFor(() => expect(updates.calls).toContainEqual({ status: 'סגירה' }))
    expect(screen.queryByText(/הביטוחים טרם הופקו/)).not.toBeInTheDocument()
  })

  it('saves any other status immediately, without the personal form (PR-K.3)', async () => {
    const user = userEvent.setup()
    await renderCase()

    await user.click(await screen.findByRole('button', { name: 'אישור' }))

    // The write happens on click — not on the personal tab's save button.
    await waitFor(() => expect(updates.calls).toContainEqual({ status: 'אישור' }))
  })
})
