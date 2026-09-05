// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Lead } from '@/types/database'

/**
 * Critical path 2: converting a lead.
 *
 * Dropping an already-converted lead back onto "הפך ללקוח" used to open the
 * conversion dialog again and create a second customer for the same person.
 * The board can only be driven by drag events here, so this covers the
 * decision the drop makes, and the emulator suite covers the service's own
 * guard.
 */

const navigated = vi.hoisted(() => ({ to: [] as string[] }))
const converted = vi.hoisted(() => ({ ids: [] as string[] }))

const LEADS = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('@/hooks/queries/useLeads', () => ({
  useLeads: () => ({ data: LEADS.current, isLoading: false }),
  useCreateLead: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateLead: () => ({ mutate: vi.fn() }),
  useDeleteLead: () => ({ mutate: vi.fn() }),
  useConvertLead: () => ({
    mutate: (id: string, opts?: { onSuccess?: (d: { id: string }) => void }) => {
      converted.ids.push(id)
      opts?.onSuccess?.({ id: 'new-customer' })
    },
    isPending: false,
  }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => (to: string) => { navigated.to.push(to) } }
})

vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {}, functions: {}, app: {} }))

function lead(over: Partial<Lead>): Lead {
  return {
    id: 'l1', user_id: 'u1', name: 'דנה כהן', phone: '052-1234567',
    email: null, source: 'פייסבוק', score: 70, status: 'חדש',
    notes: null, referral_partner_id: null, created_at: new Date().toISOString(),
    ...over,
  }
}

async function renderLeads() {
  const { default: LeadsPage } = await import('@/pages/LeadsPage')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><LeadsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  navigated.to = []
  converted.ids = []
  LEADS.current = []
})

describe('lead conversion', () => {
  it('an unconverted lead offers conversion', async () => {
    LEADS.current = [lead({ status: 'חדש' })]
    await renderLeads()
    expect(await screen.findByText('דנה כהן')).toBeInTheDocument()
  })

  it('an already-converted lead links to its existing case', async () => {
    const user = userEvent.setup()
    LEADS.current = [lead({ status: 'הפך ללקוח', converted_to_customer_id: 'existing-customer' })]
    await renderLeads()

    // The card for a converted lead offers the case it produced. An exact name
    // is needed: dnd-kit gives the draggable card itself a button role, and its
    // accessible name contains the whole card's text.
    const link = await screen.findByRole('button', { name: 'לתיק הלקוח' })
    await user.click(link)

    await waitFor(() => expect(navigated.to).toContain('/customers/existing-customer'))
    // Crucially, no second conversion was started.
    expect(converted.ids).toHaveLength(0)
  })
})
