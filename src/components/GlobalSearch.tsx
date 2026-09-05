import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import { Search } from 'lucide-react'
import { useCustomers } from '@/hooks/queries/useCustomers'
import { useLeads } from '@/hooks/queries/useLeads'

interface SearchItem {
  type: 'customer' | 'lead'
  id: string
  name: string
  phone: string
  email: string
  idNumber: string
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: customers } = useCustomers()
  const { data: leads } = useLeads()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fuse = useMemo(() => {
    const items: SearchItem[] = [
      ...(customers ?? []).map((c) => ({
        type: 'customer' as const,
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        phone: c.phone ?? '',
        email: c.email ?? '',
        idNumber: c.id_number ?? '',
      })),
      ...(leads ?? []).map((l) => ({
        type: 'lead' as const,
        id: l.id,
        name: l.name ?? '',
        phone: l.phone ?? '',
        email: l.email ?? '',
        idNumber: '',
      })),
    ]
    return new Fuse(items, { keys: ['name', 'phone', 'email', 'idNumber'], threshold: 0.3 })
  }, [customers, leads])

  const trimmed = query.trim()
  const results = trimmed.length >= 2 ? fuse.search(trimmed).slice(0, 10) : []

  const go = (item: SearchItem) => {
    setOpen(false)
    setQuery('')
    navigate(item.type === 'customer' ? `/customers/${item.id}` : '/leads')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center transition-colors hover:text-[#fafaf9]"
        style={{ width: 36, height: 36, borderRadius: 10, color: 'var(--color-text-muted)' }}
        aria-label="חיפוש (Ctrl+K)"
        title="חיפוש (Ctrl+K)"
      >
        <Search size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4"
          style={{ background: 'rgba(28,25,23,0.5)' }}
          onClick={() => setOpen(false)}
          dir="rtl"
        >
          <div
            className="w-full max-w-xl bg-[var(--color-card)] overflow-hidden animate-fade-in"
            style={{ borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
              <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חפש לקוח, ליד, ת.ז, טלפון..."
                className="w-full py-4 text-[15px] outline-none"
                style={{ color: 'var(--color-text)' }}
              />
            </div>
            <div className="max-h-96 overflow-y-auto">
              {trimmed.length < 2 && (
                <p className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                  הקלד לפחות 2 תווים לחיפוש
                </p>
              )}
              {trimmed.length >= 2 && results.length === 0 && (
                <p className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                  לא נמצאו תוצאות
                </p>
              )}
              {results.map(({ item }) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => go(item)}
                  className="w-full px-4 py-3 text-right border-b transition-colors hover:bg-[var(--color-bg)]"
                  style={{ borderColor: 'var(--color-border-light)' }}
                >
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>{item.name || '—'}</div>
                  <div className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                    {[item.phone, item.type === 'customer' ? 'לקוח' : 'ליד'].filter(Boolean).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
