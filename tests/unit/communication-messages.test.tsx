// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Customer, Message } from '@/types/database'

/**
 * The thread is now read from the query cache. It used to be page state that
 * the send path prepended to, while the service returns the thread
 * oldest-first — so a message you had just sent sat at the top until the
 * next refetch silently moved it to the bottom.
 */

const store = vi.hoisted(() => ({ messages: [] as Message[] }))

vi.mock('@/services/messageService', () => ({
  messageService: {
    getByCustomer: vi.fn(async () => ({ data: [...store.messages], error: null })),
    create: vi.fn(async (input: Partial<Message>) => {
      const created = { id: `m${store.messages.length + 1}`, sent_at: new Date().toISOString(), ...input } as Message
      store.messages.push(created)
      return { data: created, error: null }
    }),
    delete: vi.fn(async (id: string) => {
      store.messages = store.messages.filter(m => m.id !== id)
      return { error: null }
    }),
    sendWhatsApp: vi.fn(),
  },
}))

vi.mock('@/services/customerService', () => ({
  customerService: {
    getAll: vi.fn(async () => ({ data: [customer()], error: null })),
  },
}))

vi.mock('@/lib/firebase', () => ({ functions: {} }))
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => vi.fn()) }))

const now = new Date().toISOString()

function customer(): Customer {
  return {
    id: 'c1', user_id: 'u1', first_name: 'דנה', last_name: 'כהן',
    id_number: null, phone: '0501111111', email: null, address: null,
    marital_status: null, children: 0,
    monthly_income: null, partner_income: null, own_capital: null,
    existing_obligations: 0, lead_source: null, status: 'ליד', notes: null,
    referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
    created_at: now, updated_at: now,
  }
}

function message(id: string, content: string): Message {
  return {
    id, user_id: 'u1', customer_id: 'c1', channel: 'SMS', direction: 'נשלח',
    content, delivery_status: 'manual', sent_at: now, created_at: now,
  } as Message
}

const { default: CommunicationPage } = await import('@/pages/CommunicationPage')

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CommunicationPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  store.messages = [message('m1', 'הודעה ראשונה')]
  vi.stubGlobal('open', vi.fn())
})

describe('CommunicationPage message thread', () => {
  it('loads the thread for the selected customer', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('option', { name: /דנה כהן/ })
    await user.selectOptions(screen.getByLabelText('לקוח'), 'c1')
    expect(await screen.findByText('הודעה ראשונה')).toBeInTheDocument()
  })

  it('keeps the service ordering after sending', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('option', { name: /דנה כהן/ })
    await user.selectOptions(screen.getByLabelText('לקוח'), 'c1')
    await screen.findByText('הודעה ראשונה')

    await user.click(screen.getByRole('button', { name: 'SMS' }))
    await user.type(screen.getByLabelText('הודעה'), 'הודעה שנייה')
    await user.click(screen.getByRole('button', { name: /שלח$/ }))

    await waitFor(() => expect(screen.getByText('הודעה שנייה')).toBeInTheDocument())
    const rendered = screen.getAllByText(/הודעה (ראשונה|שנייה)/).map(el => el.textContent)
    expect(rendered).toEqual(['הודעה ראשונה', 'הודעה שנייה'])
  })

  it('drops a deleted message from the thread', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('option', { name: /דנה כהן/ })
    await user.selectOptions(screen.getByLabelText('לקוח'), 'c1')
    const row = (await screen.findByText('הודעה ראשונה')).closest('div[class*="flex"]')!
    await user.click(within(row.parentElement as HTMLElement).getByRole('button'))
    await waitFor(() => expect(screen.queryByText('הודעה ראשונה')).not.toBeInTheDocument())
  })
})
