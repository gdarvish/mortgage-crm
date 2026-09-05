// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Customer, FinancialData } from '@/types/database'

/**
 * The calculator used to be a scratchpad: the figures were lost on reload and
 * belonged to nobody. It now loads from and saves onto the selected case.
 */

const updates = vi.hoisted(() => ({ calls: [] as { id: string; updates: Record<string, unknown> }[] }))
const store = vi.hoisted(() => ({ customers: [] as unknown[] }))

vi.mock('@/services/customerService', () => ({
  customerService: {
    getAll: vi.fn(async () => ({ data: store.customers, error: null })),
    getById: vi.fn(async (id: string) => ({
      data: (store.customers as Customer[]).find(c => c.id === id) ?? null,
      error: null,
    })),
    update: vi.fn(async (id: string, u: Record<string, unknown>) => {
      updates.calls.push({ id, updates: u })
      return { data: null, error: null }
    }),
  },
}))

vi.mock('@/utils/pdfExport', () => ({ exportFamilyEconomicsPdf: vi.fn(async () => {}) }))

// recharts needs a laid-out container, which jsdom never provides.
vi.mock('recharts', () => {
  const Stub = () => null
  return { ResponsiveContainer: Stub, PieChart: Stub, Pie: Stub, Cell: Stub, Tooltip: Stub }
})

const { default: FamilyEconomicsPage } = await import('@/pages/FamilyEconomicsPage')

const now = new Date().toISOString()

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'c1', user_id: 'u1', first_name: 'דנה', last_name: 'כהן',
    id_number: null, phone: '050-1111111', email: null, address: null,
    marital_status: null, children: 0,
    monthly_income: null, partner_income: null, own_capital: null,
    existing_obligations: 0, lead_source: null, status: 'ליד', notes: null,
    referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
    created_at: now, updated_at: now, ...over,
  }
}

function renderPage(initialEntry = '/family-economics') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/family-economics" element={<FamilyEconomicsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  updates.calls = []
  store.customers = [customer()]
})

describe('FamilyEconomicsPage', () => {
  it('opens on the seed budget with no customer attached', async () => {
    renderPage()
    expect(await screen.findByLabelText('הכנסה לווה 1')).toHaveValue(15000)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('loads the budget saved on the customer named in the URL', async () => {
    const financial_data: FinancialData = {
      income1: 21_000,
      income2: 4_000,
      mortgagePayment: 6_100,
      expenses: [{ category: 'מזון', amount: 2_200 }],
      updated_at: now,
    }
    store.customers = [customer({ financial_data })]
    renderPage('/family-economics?customerId=c1')

    await waitFor(() => expect(screen.getByLabelText('הכנסה לווה 1')).toHaveValue(21000))
    expect(screen.getByLabelText('הכנסה לווה 2')).toHaveValue(4000)
    expect(screen.getByLabelText('החזר משכנתא מבוקש')).toHaveValue(6100)
    expect(screen.getByLabelText('מזון')).toHaveValue(2200)
  })

  it('seeds the incomes from the case when no budget was ever saved', async () => {
    store.customers = [customer({ monthly_income: 18_000, partner_income: 7_500 })]
    renderPage('/family-economics?customerId=c1')

    await waitFor(() => expect(screen.getByLabelText('הכנסה לווה 1')).toHaveValue(18000))
    expect(screen.getByLabelText('הכנסה לווה 2')).toHaveValue(7500)
  })

  it('writes the edited budget onto the customer', async () => {
    const user = userEvent.setup()
    store.customers = [customer({ monthly_income: 18_000 })]
    renderPage('/family-economics?customerId=c1')
    await waitFor(() => expect(screen.getByLabelText('הכנסה לווה 1')).toHaveValue(18000))

    const food = screen.getByLabelText('מזון')
    await user.clear(food)
    await user.type(food, '4000')
    await user.click(screen.getByRole('button', { name: /שמור ללקוח/ }))

    await waitFor(() => expect(updates.calls).toHaveLength(1))
    const written = updates.calls[0].updates.financial_data as FinancialData
    expect(updates.calls[0].id).toBe('c1')
    expect(written.income1).toBe(18_000)
    expect(written.expenses?.find(e => e.category === 'מזון')?.amount).toBe(4_000)
    // The stored category is the enum value, never the longer display label.
    expect(written.expenses?.map(e => e.category)).toContain('דיור')
  })

  it('attaches a customer picked from the typeahead', async () => {
    const user = userEvent.setup()
    store.customers = [customer({ id: 'c2', first_name: 'אבי', last_name: 'לוי', monthly_income: 9_000 })]
    renderPage()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: /אבי לוי/ }))

    await waitFor(() => expect(screen.getByLabelText('הכנסה לווה 1')).toHaveValue(9000))
    expect(screen.getByText('אבי לוי')).toBeInTheDocument()
  })

  it('shows a share rather than NaN when the income is cleared', async () => {
    const user = userEvent.setup()
    renderPage()
    const income1 = await screen.findByLabelText('הכנסה לווה 1')
    await user.clear(income1)
    await user.clear(screen.getByLabelText('הכנסה לווה 2'))

    expect(screen.getByText('משכנתא: 0%')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })
})
