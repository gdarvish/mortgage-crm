// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RatesDoc } from '@/types/database'

/**
 * The rate board is the advisor's own data, so it has to survive a reload.
 * Before this it was a hardcoded array in the page: editing was impossible
 * and the מ"ל (משתנה לא צמודה) column did not exist at all.
 */

const saved = vi.hoisted(() => ({ calls: [] as RatesDoc[], error: null as { message: string } | null }))
const stored = vi.hoisted(() => ({ data: null as RatesDoc | null }))
const boi = vi.hoisted(() => ({
  result: null as Record<string, unknown> | null,
  error: null as Error | null,
  calls: [] as unknown[],
}))

vi.mock('@/services/settingsService', () => ({
  settingsService: {
    getRates: vi.fn(async () => ({ data: stored.data, error: null })),
    saveRates: vi.fn(async (rates: RatesDoc) => {
      saved.calls.push(rates)
      return { error: saved.error }
    }),
  },
}))

// The page also renders the admin-published rates section, which reads
// Firestore and the auth token directly.
vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
}))
// The Bank of Israel reading comes from the fetchBoiRates callable, not from
// a browser fetch — a fetch from the tab is blocked by CORS before it leaves.
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_fns: unknown, name: string) => async (payload: unknown) => {
    if (name !== 'fetchBoiRates') return { data: undefined }
    boi.calls.push(payload)
    if (boi.error) throw boi.error
    return { data: boi.result }
  }),
}))

// recharts needs a laid-out container, which jsdom never provides.
vi.mock('recharts', () => {
  const Stub = () => null
  return {
    ResponsiveContainer: Stub, LineChart: Stub, Line: Stub,
    XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub,
  }
})

const { default: InterestRatesPage } = await import('@/pages/InterestRatesPage')
const { Toaster, useToastStore } = await import('@/components/ui')

/** The page reports failures through toasts, so the Toaster has to be mounted. */
function renderPage() {
  return render(<><InterestRatesPage /><Toaster /></>)
}

const savedBoard: RatesDoc = {
  bankRates: [
    { bank: 'בנק אגוד', prime: 6, fixedNonLinked: 4.1, fixedLinked: 3.3, variableLinked: 3, variableNotLinked: 4.9 },
  ],
  prime: 6,
  boiRate: 4.5,
  lastCpi: 0.3,
  updated_at: '2026-09-04T00:00:00.000Z',
}

beforeEach(() => {
  saved.calls = []
  saved.error = null
  stored.data = null
  boi.result = null
  boi.error = new Error('בנק ישראל לא זמין')
  boi.calls = []
  useToastStore.getState().toasts.forEach(t => useToastStore.getState().removeToast(t.id))
  localStorage.clear()
  // The page must never reach the network itself.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('the page must not fetch directly') }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InterestRatesPage', () => {
  it('shows the seed board with a מ"ל column when nothing is saved', async () => {
    render(<InterestRatesPage />)
    expect(await screen.findByText('בנק הפועלים')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /מ"ל/ })).toBeInTheDocument()
    expect(screen.getByText('עודכן: לא נשמר עדיין')).toBeInTheDocument()
  })

  it('prefers the saved board over the seed', async () => {
    stored.data = savedBoard
    render(<InterestRatesPage />)
    expect(await screen.findByText('בנק אגוד')).toBeInTheDocument()
    expect(screen.queryByText('בנק הפועלים')).not.toBeInTheDocument()
  })

  it('persists an edited rate and shows it in the table', async () => {
    const user = userEvent.setup()
    stored.data = savedBoard
    render(<InterestRatesPage />)
    await screen.findByText('בנק אגוד')

    await user.click(screen.getByRole('button', { name: 'ערוך ריביות' }))
    const dialog = await screen.findByRole('dialog')
    const field = within(dialog).getByLabelText('מ"ל')
    await user.clear(field)
    await user.type(field, '5.5')
    await user.click(within(dialog).getByRole('button', { name: 'שמור' }))

    await waitFor(() => expect(saved.calls).toHaveLength(1))
    expect(saved.calls[0].bankRates[0].variableNotLinked).toBe(5.5)
    expect(saved.calls[0].updated_at).not.toBe(savedBoard.updated_at)
    expect(await screen.findByText('5.50%')).toBeInTheDocument()
  })

  it('keeps the old figures on screen when the save fails', async () => {
    const user = userEvent.setup()
    stored.data = savedBoard
    saved.error = { message: 'permission-denied' }
    render(<InterestRatesPage />)
    await screen.findByText('בנק אגוד')

    await user.click(screen.getByRole('button', { name: 'ערוך ריביות' }))
    const dialog = await screen.findByRole('dialog')
    const field = within(dialog).getByLabelText('מ"ל')
    await user.clear(field)
    await user.type(field, '5.5')
    await user.click(within(dialog).getByRole('button', { name: 'שמור' }))

    await waitFor(() => expect(saved.calls).toHaveLength(1))
    expect(screen.getByText('4.90%')).toBeInTheDocument()
    expect(screen.queryByText('5.50%')).not.toBeInTheDocument()
  })

  it('warns when the board has not been touched for over a week', async () => {
    stored.data = { ...savedBoard, updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
    render(<InterestRatesPage />)
    expect(await screen.findByText('הריביות לא עודכנו למעלה משבוע')).toBeInTheDocument()
  })

  it('does not warn about a board saved today', async () => {
    stored.data = { ...savedBoard, updated_at: new Date().toISOString() }
    render(<InterestRatesPage />)
    await screen.findByText('בנק אגוד')
    expect(screen.queryByText('הריביות לא עודכנו למעלה משבוע')).not.toBeInTheDocument()
  })
})

describe('the Bank of Israel refresh', () => {
  it('goes through the callable rather than fetching the feed directly', async () => {
    const user = userEvent.setup()
    const directFetch = vi.fn(async () => { throw new Error('blocked by CORS') })
    vi.stubGlobal('fetch', directFetch)
    stored.data = savedBoard
    boi.error = null
    boi.result = { prime: 5.75, boiRate: 4.25, lastUpdate: '2026-09' }
    renderPage()
    await screen.findByText('בנק אגוד')

    await user.click(screen.getByRole('button', { name: /רענן מבנק ישראל/ }))

    await waitFor(() => expect(saved.calls).toHaveLength(1))
    expect(directFetch).not.toHaveBeenCalled()
    // A manual refresh asks the server to bypass its cache.
    expect(boi.calls.at(-1)).toEqual({ force: true })
  })

  it('applies the reading to the headline figures only', async () => {
    const user = userEvent.setup()
    stored.data = savedBoard
    boi.error = null
    boi.result = { prime: 5.75, boiRate: 4.25, lastUpdate: '2026-09' }
    renderPage()
    await screen.findByText('בנק אגוד')

    await user.click(screen.getByRole('button', { name: /רענן מבנק ישראל/ }))

    await waitFor(() => expect(saved.calls).toHaveLength(1))
    const written = saved.calls[0]
    expect(written.prime).toBe(5.75)
    expect(written.boiRate).toBe(4.25)
    // The advisor's own quotes are never overwritten by the feed.
    expect(written.bankRates).toEqual(savedBoard.bankRates)
    expect(await screen.findByText('4.25%')).toBeInTheDocument()
  })

  it('reports why the refresh failed instead of a generic error', async () => {
    const user = userEvent.setup()
    stored.data = savedBoard
    boi.error = new Error('בנק ישראל החזיר שגיאה 404')
    renderPage()
    await screen.findByText('בנק אגוד')

    await user.click(screen.getByRole('button', { name: /רענן מבנק ישראל/ }))

    expect(await screen.findByText('בנק ישראל החזיר שגיאה 404')).toBeInTheDocument()
    // The saved figures stay on screen and nothing is written.
    expect(saved.calls).toHaveLength(0)
    expect(screen.getByText('4.50%')).toBeInTheDocument()
  })

  it('keeps a stale reading but says it is stale', async () => {
    const user = userEvent.setup()
    stored.data = savedBoard
    boi.error = null
    boi.result = { prime: 6, boiRate: 4.5, lastUpdate: '2026-08', stale: true, error: 'תם הזמן הקצוב' }
    renderPage()
    await screen.findByText('בנק אגוד')

    await user.click(screen.getByRole('button', { name: /רענן מבנק ישראל/ }))

    expect(await screen.findByText('בנק ישראל לא זמין')).toBeInTheDocument()
    expect(screen.getByText('תם הזמן הקצוב')).toBeInTheDocument()
  })
})
