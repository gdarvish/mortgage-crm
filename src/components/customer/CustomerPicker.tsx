import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useCustomers } from '@/hooks/queries/useCustomers'
import type { Customer } from '@/types/database'

export interface CustomerPickerProps {
  selected: Customer | null
  onSelect: (customer: Customer) => void
  onClear: () => void
  label?: string
  placeholder?: string
  /** Rendered next to the selected customer — typically a save action. */
  children?: React.ReactNode
}

const MAX_SUGGESTIONS = 8

/**
 * A typeahead over the advisor's customers, for pages that can optionally be
 * tied to a case. Once a customer is chosen it collapses to a chip so the
 * selection stays visible while the page is used.
 */
export function CustomerPicker({
  selected,
  onSelect,
  onClear,
  label = 'בחר לקוח (אופציונלי)',
  placeholder = 'חיפוש לקוח לפי שם או טלפון...',
  children,
}: CustomerPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const { data: customers = [] } = useCustomers()

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers.slice(0, MAX_SUGGESTIONS)
    return customers
      .filter((c) => {
        const full = `${c.first_name} ${c.last_name}`.toLowerCase()
        return full.includes(q) || (c.phone ?? '').toLowerCase().includes(q)
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [customers, query])

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const pick = (customer: Customer) => {
    setQuery('')
    setOpen(false)
    onSelect(customer)
  }

  return (
    <div>
      <label
        className="block mb-1.5 text-[12px] font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
        htmlFor={selected ? undefined : 'customer-picker-input'}
      >
        {label}
      </label>

      {selected ? (
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold"
            style={{ background: 'var(--color-accent-bg)', color: 'var(--color-primary)' }}
          >
            <span>{selected.first_name} {selected.last_name}</span>
            {selected.phone && (
              <span dir="ltr" className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>· {selected.phone}</span>
            )}
            <button
              type="button"
              onClick={onClear}
              aria-label="בטל בחירת לקוח"
              className="flex p-0 ms-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
          {children}
        </div>
      ) : (
        <div ref={containerRef} className="relative max-w-[420px]">
          <span
            className="absolute end-3 top-1/2 -translate-y-1/2 flex pointer-events-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Search size={15} />
          </span>
          <input
            id="customer-picker-input"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="customer-picker-list"
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-lg py-2.5 ps-3.5 pe-10 text-[14px] outline-none focus:border-[var(--color-primary)]"
            style={{
              background: 'var(--color-input-bg)',
              color: 'var(--color-text)',
              border: '1.5px solid var(--color-border)',
            }}
          />
          {open && (
            <ul
              id="customer-picker-list"
              role="listbox"
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl py-1"
              style={{
                background: 'var(--color-card-bg)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card-hover)',
              }}
            >
              {suggestions.length === 0 ? (
                <li className="px-3.5 py-2.5 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                  לא נמצאו לקוחות
                </li>
              ) : (
                suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => pick(c)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-right text-[13px] hover:bg-[var(--color-bg)]"
                      style={{ color: 'var(--color-text)' }}
                    >
                      <span className="font-semibold">{c.first_name} {c.last_name}</span>
                      {c.phone && (
                        <span dir="ltr" className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{c.phone}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
