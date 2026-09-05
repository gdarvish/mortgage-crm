// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

/**
 * Critical path 1: saving a mix from the calculator into a case.
 *
 * This is the defect that mattered most in the audit — a fully styled button
 * with no onClick — and it was invisible to every other kind of test. The
 * calculation was right, the service was right, nothing connected them.
 */

const created = vi.hoisted(() => ({ calls: [] as unknown[] }))
const tracksWritten = vi.hoisted(() => ({ calls: [] as unknown[] }))
const navigated = vi.hoisted(() => ({ to: [] as string[] }))

vi.mock('@/services/mortgageService', () => ({
  mortgageService: {
    create: vi.fn(async (payload: unknown) => {
      created.calls.push(payload)
      return { data: { id: 'new-mortgage', version: 1, ...(payload as object) }, error: null }
    }),
    createVersion: vi.fn(async (input: { tracks: unknown }) => {
      created.calls.push(input)
      tracksWritten.calls.push(input.tracks)
      return { data: { id: 'new-mortgage', version: 1 }, error: null }
    }),
    update: vi.fn(async () => ({ data: { id: 'existing' }, error: null })),
    replaceTracks: vi.fn(async (_id: string, tracks: unknown) => {
      tracksWritten.calls.push(tracks)
      return { error: null }
    }),
  },
}))

vi.mock('@/services/settingsService', () => ({
  settingsService: { get: vi.fn(async () => ({ data: null, error: null })) },
}))

vi.mock('@/services/regulatoryService', () => ({
  regulatoryService: {
    getInForceAt: vi.fn(async () => (await import('@/utils/regulatoryParams')).FALLBACK_REGULATORY_PARAMS),
  },
}))

// The calculator reads published interest rates directly. The Firestore
// client is stubbed rather than pointed at an emulator: this test is about
// wiring in the page, not about queries, which the emulator suites cover.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
}))

vi.mock('@/lib/firebase', () => ({
  db: {}, auth: {}, storage: {}, functions: {}, app: {},
}))

// Toasts render through a Toaster mounted at the app root, which this test does
// not stand up; capturing them is enough to assert what the page reported.
const toasts = vi.hoisted(() => ({ errors: [] as string[], successes: [] as string[] }))
vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>()
  return {
    ...actual,
    toast: {
      error: (message: string) => { toasts.errors.push(message) },
      success: (message: string) => { toasts.successes.push(message) },
    },
  }
})

const snapshotValue = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/hooks/queries/useCaseSnapshot', () => ({
  useCaseSnapshot: () => ({ data: snapshotValue.current, isLoading: false, isError: false }),
  caseSnapshotKey: (id: string) => ['case-snapshot', id],
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => (to: string) => { navigated.to.push(to) },
  }
})

async function renderCalculator(url: string): Promise<void> {
  const { default: MortgageCalculatorPage } = await import('@/pages/MortgageCalculatorPage')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/calculator" element={<MortgageCalculatorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(ui)
}

const CASE_SNAPSHOT = {
  customer: {
    id: 'c1', first_name: 'ישראל', last_name: 'ישראלי',
    requested_amount: 1_500_000, own_capital: 400_000, existing_obligations: 0,
    monthly_income: 20_000, partner_income: 5_000,
  },
  borrowers: [],
  obligations: [],
  mortgages: [],
  appraisal: null,
  householdIncome: 25_000,
  monthlyObligations: 0,
  params: null as unknown,
}

beforeEach(async () => {
  created.calls = []
  tracksWritten.calls = []
  navigated.to = []
  toasts.errors = []
  toasts.successes = []
  const { FALLBACK_REGULATORY_PARAMS } = await import('@/utils/regulatoryParams')
  snapshotValue.current = { ...CASE_SNAPSHOT, params: FALLBACK_REGULATORY_PARAMS }
})

afterEach(() => { vi.clearAllMocks() })

describe('saving a mix to a case', () => {
  it('the save button is disabled without a case', async () => {
    snapshotValue.current = null
    await renderCalculator('/calculator')
    const button = await screen.findByRole('button', { name: /שמור תמהיל ללקוח/ })
    expect(button).toBeDisabled()
    expect(screen.getByText(/פתח את המחשבון מתוך תיק לקוח/)).toBeInTheDocument()
  })

  it('writes a mortgage and its tracks, then returns to the case', async () => {
    const user = userEvent.setup()
    await renderCalculator('/calculator?customerId=c1')

    const button = await screen.findByRole('button', { name: /שמור תמהיל ללקוח/ })
    expect(button).toBeEnabled()
    await user.click(button)

    // The mix does not match the loan amount, so it asks first.
    const confirm = await screen.findByRole('button', { name: /שמור בכל זאת/ })
    await user.click(confirm)

    await waitFor(() => expect(created.calls).toHaveLength(1))
    expect(tracksWritten.calls).toHaveLength(1)
    // The default mix has two tracks; both must reach the case.
    expect(tracksWritten.calls[0]).toHaveLength(2)
    await waitFor(() => expect(navigated.to).toContain('/customers/c1'))
  })

  it('names the case it is building for', async () => {
    await renderCalculator('/calculator?customerId=c1')
    expect(await screen.findByText(/בונה תמהיל עבור ישראל ישראלי/)).toBeInTheDocument()
  })

  it('refuses to save a mix with no tracks', async () => {
    const user = userEvent.setup()
    await renderCalculator('/calculator?customerId=c1')

    // Remove every track. Re-queried each time: removing one re-renders the
    // list, so buttons captured up front would be detached by the second click.
    await screen.findAllByRole('button', { name: 'הסר מסלול' })
    for (;;) {
      const remaining = screen.queryAllByRole('button', { name: 'הסר מסלול' })
      if (remaining.length === 0) break
      await user.click(remaining[0])
    }

    await user.click(screen.getByRole('button', { name: /שמור תמהיל ללקוח/ }))
    await waitFor(() => expect(toasts.errors).toContain('אין מסלולים לשמירה'))
    expect(created.calls).toHaveLength(0)
  })
})
