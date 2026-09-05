// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { AddressInput } from '@/components/ui/AddressInput'

/**
 * The address lookup talks to a public government service across origins.
 * It has to stay a working text field when that call is blocked, slow, or
 * returns nothing — which is the normal case behind a strict CSP.
 */

function govMapResponse(labels: string[]) {
  return {
    ok: true,
    json: async () => ({ res: { ADDRESS: labels.map((l, i) => ({ ResultLable: l, X: i, Y: i })) } }),
  }
}

function Harness({ onSelect }: { onSelect?: (s: { text: string }) => void }) {
  const [value, setValue] = useState('')
  return <AddressInput id="addr" value={value} onChange={setValue} onSelect={onSelect} />
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => govMapResponse(['הרצל 1, תל אביב', 'הרצל 2, חיפה']))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AddressInput', () => {
  it('does not call the service until two characters are typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'ה')
    await new Promise(r => setTimeout(r, 400))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('offers the returned addresses', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'הרצל')
    expect(await screen.findByRole('option', { name: 'הרצל 1, תל אביב' })).toBeInTheDocument()
  })

  it('debounces a burst of keystrokes into one request', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'הרצל')
    await screen.findByRole('option', { name: 'הרצל 1, תל אביב' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('writes the chosen address and reports its coordinates', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    await user.type(screen.getByRole('combobox'), 'הרצל')
    await user.click(await screen.findByRole('option', { name: 'הרצל 2, חיפה' }))

    expect(screen.getByRole('combobox')).toHaveValue('הרצל 2, חיפה')
    expect(onSelect).toHaveBeenCalledWith({ text: 'הרצל 2, חיפה', x: 1, y: 1 })
    // Writing the value back must not re-open the list with what was chosen.
    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument())
  })

  it('is keyboard operable', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'הרצל')
    await screen.findByRole('option', { name: 'הרצל 1, תל אביב' })
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(screen.getByRole('combobox')).toHaveValue('הרצל 2, חיפה')
  })

  it('stays a plain text field when the lookup fails', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValue(new Error('blocked by CORS'))
    render(<Harness />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'הרצל 5')
    await new Promise(r => setTimeout(r, 400))
    expect(input).toHaveValue('הרצל 5')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes the list on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'הרצל')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
