import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import { Search } from 'lucide-react'
import { useCustomers } from '@/hooks/queries/useCustomers'
import { useLeads } from '@/hooks/queries/useLeads'
import { useTheme } from '@/theme/ThemeContext'

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
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const [hov, setHov] = useState(false)
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
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: t.navActive,
          color: hov ? t.navTextActive : t.navText,
          border: 'none',
          cursor: 'pointer',
          transition: 'color 0.15s ease, transform 0.2s ease',
          transform: hov ? 'scale(1.08)' : 'scale(1)',
        }}
        aria-label="חיפוש (Ctrl+K)"
        title="חיפוש (Ctrl+K)"
      >
        <Search size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
          dir="rtl"
          role="presentation"
        >
          <div
            className="w-full max-w-xl overflow-hidden animate-fade-in"
            style={{ borderRadius: 16, background: t.cardBg, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="חיפוש"
          >
            <div className="flex items-center gap-2 px-4 border-b" style={{ borderColor: t.borderLight }}>
              <Search size={18} style={{ color: t.textMuted }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חפש לקוח, ליד, ת.ז, טלפון..."
                className="w-full py-4 text-[15px] outline-none bg-transparent"
                style={{ color: t.text }}
              />
            </div>
            <div className="max-h-96 overflow-y-auto">
              {trimmed.length < 2 && (
                <p className="px-4 py-6 text-center text-[13px]" style={{ color: t.textMuted }}>
                  הקלד לפחות 2 תווים לחיפוש
                </p>
              )}
              {trimmed.length >= 2 && results.length === 0 && (
                <p className="px-4 py-6 text-center text-[13px]" style={{ color: t.textMuted }}>
                  לא נמצאו תוצאות
                </p>
              )}
              {results.map(({ item }) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => go(item)}
                  className="w-full px-4 py-3 text-right border-b transition-colors"
                  style={{ borderColor: t.borderLight }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.bg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="text-[14px] font-semibold" style={{ color: t.text }}>{item.name || '—'}</div>
                  <div className="text-[12px]" style={{ color: t.textMuted }}>
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
