import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Loader2, X, Users, Download, Trash2 } from 'lucide-react'
import { writeBatch, doc } from 'firebase/firestore'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/firebase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { customersToCsv, downloadCsv } from '@/utils/csvExport'
import { useCreateCustomer } from '@/hooks/queries/useCustomers'
import { useCustomersInfinite } from '@/hooks/queries/useCustomersInfinite'
import { toast, ConfirmDialog } from '@/components/ui'

const statusColors: Record<string, { bg: string; color: string }> = {
  'ליד':    { bg: '#ede9fe', color: '#7c3aed' },
  'פגישה':  { bg: '#fef3c7', color: '#b45309' },
  'מסמכים': { bg: '#ffedd5', color: '#c2410c' },
  'הגשה':   { bg: '#f3e8ff', color: '#9333ea' },
  'אישור':  { bg: '#d1fae5', color: '#065f46' },
  'ביצוע':  { bg: '#ccfbf1', color: '#0f766e' },
  'סגירה':  { bg: '#a7f3d0', color: '#064e3b' },
}

const statuses = ['הכל', 'ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'ביצוע', 'סגירה']

const cardStyle = {
  background: 'var(--color-card)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border)',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid var(--color-border)',
  borderRadius: 10,
  fontSize: 14,
  color: 'var(--color-text)',
  background: 'var(--color-card)',
  outline: 'none',
  fontFamily: 'var(--font-heebo)',
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('הכל')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    first_name: '', last_name: '', id_number: '', phone: '', email: '', lead_source: '',
  })

  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCustomersInfinite({ statusFilter: statusFilter !== 'הכל' ? statusFilter : undefined })
  const createCustomer = useCreateCustomer()
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const allCustomers = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data])
  // Search filters the pages loaded so far (Firestore has no substring search).
  const customers = useMemo(() => {
    if (!search) return allCustomers
    const needle = search.toLowerCase()
    return allCustomers.filter(c =>
      c.first_name.toLowerCase().includes(needle) ||
      c.last_name.toLowerCase().includes(needle) ||
      (c.phone?.toLowerCase().includes(needle) ?? false) ||
      (c.id_number?.toLowerCase().includes(needle) ?? false)
    )
  }, [allCustomers, search])

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id))
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(customers.map(c => c.id)))
  }

  const handleBulkExport = () => {
    const selected = customers.filter(c => selectedIds.has(c.id))
    downloadCsv(customersToCsv(selected), `customers-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      const batch = writeBatch(db)
      selectedIds.forEach(id => batch.delete(doc(db, 'customers', id)))
      await batch.commit()
      toast.success(`${selectedIds.size} לקוחות נמחקו`)
      setSelectedIds(new Set())
      qc.invalidateQueries({ queryKey: ['customers'] })
    } catch (e) {
      toast.error('שגיאה במחיקה', e instanceof Error ? e.message : undefined)
    } finally {
      setBulkDeleting(false)
      setShowBulkDelete(false)
    }
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.first_name || !newCustomer.last_name) return
    createCustomer.mutate(
      {
        ...newCustomer,
        status: 'ליד',
        children: 0,
        existing_obligations: 0,
        questionnaire_completed: false,
        id_number: newCustomer.id_number || null,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
        address: null,
        marital_status: null,
        monthly_income: null,
        partner_income: null,
        own_capital: null,
        lead_source: newCustomer.lead_source || null,
        notes: null,
        referral_partner_id: null,
        questionnaire_token: null,
      },
      {
        onSuccess: () => {
          setShowNewModal(false)
          setNewCustomer({ first_name: '', last_name: '', id_number: '', phone: '', email: '', lead_source: '' })
          toast.success('הלקוח נוצר בהצלחה')
        },
        onError: (err) => toast.error('שגיאה ביצירת לקוח', err.message),
      }
    )
  }

  const statusCounts = statuses.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'הכל' ? customers.length : customers.filter(c => c.status === s).length
    return acc
  }, {})

  return (
    <div className="crm-page animate-fade-in space-y-5">
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div
          className="crm-btn-primary sticky top-2 z-20 flex items-center gap-2 px-4 py-2.5 text-white"
          style={{ borderRadius: 12, background: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 27%, transparent)' }}
        >
          <span className="text-[13px] font-bold">{selectedIds.size} נבחרו</span>
          <button
            onClick={handleBulkExport}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 transition-all hover:opacity-90"
            style={{ borderRadius: 8, background: 'rgba(255,255,255,0.18)' }}
          >
            <Download size={13} /> ייצא ל-CSV
          </button>
          <button
            onClick={() => setShowBulkDelete(true)}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 transition-all hover:opacity-90"
            style={{ borderRadius: 8, background: 'rgba(255,255,255,0.18)' }}
          >
            <Trash2 size={13} /> מחק
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[12px] font-semibold px-3 py-1.5 mr-auto transition-all hover:opacity-80"
          >
            ביטול
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>לקוחות</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{customers.length} לקוחות</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="crm-btn-primary flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.96] shrink-0"
          style={{ borderRadius: 12, background: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 27%, transparent)' }}
        >
          <Plus size={15} />
          לקוח חדש
        </button>
      </div>

      {/* Status pills + search */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לקוח..."
              className="w-full pr-10 pl-4 py-2 outline-none text-[13px]"
              style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)' }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map(s => {
              const sc = statusColors[s]
              const active = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1.5 text-[12px] font-semibold transition-all"
                  style={{
                    borderRadius: 20,
                    background: active ? (sc?.bg ?? 'var(--color-success-bg)') : 'var(--color-border-light)',
                    color: active ? (sc?.color ?? '#065f46') : 'var(--color-text-sub)',
                    transform: active ? 'translateY(-2px)' : 'none',
                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {s} <span className="opacity-60 ml-1">{statusCounts[s]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={28} style={{ color: 'var(--color-primary)' }} className="animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users size={40} style={{ color: '#d6d3d1' }} className="mb-3" />
            <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-sub)' }}>אין לקוחות עדיין</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>הוסף את הלקוח הראשון שלך</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)' }}>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 cursor-pointer accent-[var(--color-primary)] align-middle"
                    aria-label="בחר הכל"
                  />
                </th>
                {['שם', 'ת.ז', 'טלפון', 'סטטוס', 'מקור', 'הכנסה', 'תאריך'].map(h => (
                  <th key={h} className="text-right p-3 text-[11px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => {
                const sc = statusColors[c.status] ?? { bg: 'var(--color-border-light)', color: 'var(--color-text-sub)' }
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="border-b cursor-pointer group"
                    style={{
                      borderColor: 'var(--color-border-light)',
                      animationName: 'fadeUp',
                      animationDuration: '0.35s',
                      animationDelay: `${i * 40}ms`,
                      animationFillMode: 'backwards',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td className="p-3 w-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 cursor-pointer accent-[var(--color-primary)] align-middle"
                        aria-label={`בחר ${c.first_name} ${c.last_name}`}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--color-primary)', transition: 'transform 120ms' }}
                        >
                          {c.first_name.charAt(0)}
                        </div>
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{c.first_name} {c.last_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-[13px]" style={{ color: 'var(--color-text-muted)' }} dir="ltr">{c.id_number || '—'}</td>
                    <td className="p-3 text-[13px]" style={{ color: 'var(--color-text-sub)' }} dir="ltr">{c.phone || '—'}</td>
                    <td className="p-3">
                      <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{c.lead_source || '—'}</td>
                    <td className="p-3 text-[13px] font-semibold" style={{ color: 'var(--color-primary)' }}>{c.monthly_income ? formatCurrency(c.monthly_income) : '—'}</td>
                    <td className="p-3 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{formatDate(c.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Infinite-scroll sentinel */}
      {hasNextPage && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          {isFetchingNextPage && <Loader2 size={20} style={{ color: 'var(--color-primary)' }} className="animate-spin" />}
        </div>
      )}

      {/* New customer modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(28,25,23,0.5)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-lg animate-fade-in"
            style={{ ...cardStyle, padding: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-bold" style={{ color: 'var(--color-text)' }}>לקוח חדש</h2>
              <button onClick={() => setShowNewModal(false)} style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>שם פרטי *</label>
                  <input required value={newCustomer.first_name} onChange={e => setNewCustomer(p => ({ ...p, first_name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>שם משפחה *</label>
                  <input required value={newCustomer.last_name} onChange={e => setNewCustomer(p => ({ ...p, last_name: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>ת.ז</label>
                  <input value={newCustomer.id_number} onChange={e => setNewCustomer(p => ({ ...p, id_number: e.target.value }))} style={inputStyle} dir="ltr" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>טלפון</label>
                  <input value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} style={inputStyle} dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>אימייל</label>
                <input type="email" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} style={inputStyle} dir="ltr" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>מקור הגעה</label>
                <select value={newCustomer.lead_source} onChange={e => setNewCustomer(p => ({ ...p, lead_source: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="">בחר...</option>
                  {['הפניה', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'טלפון'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createCustomer.isPending}
                  className="flex-1 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ borderRadius: 12, background: 'var(--color-primary)' }}
                >
                  {createCustomer.isPending && <Loader2 size={15} className="animate-spin" />}
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80"
                  style={{ borderRadius: 12, background: 'var(--color-border-light)', color: 'var(--color-text-sub)' }}
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showBulkDelete}
        variant="danger"
        title="מחיקת לקוחות"
        message={`למחוק ${selectedIds.size} לקוחות? פעולה זו תמחק גם את כל הנתונים הקשורים אליהם ואינה הפיכה.`}
        confirmText="מחק"
        loading={bulkDeleting}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDelete(false)}
      />
    </div>
  )
}
