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
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => vi.fn()) }))

// recharts needs a laid-out container, which jsdom never provides.
vi.mock('recharts', () => {
  const Stub = () => null
  return {
    ResponsiveContainer: Stub, LineChart: Stub, Line: Stub,
    XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub,
  }
})

const { default: InterestRatesPage } = await import('@/pages/InterestRatesPage')

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
  localStorage.clear()
  // Keep the page off the network — the BOI feed is not part of these cases.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
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
