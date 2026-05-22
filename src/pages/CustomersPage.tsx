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
import { useTheme } from '@/theme/ThemeContext'

// Design statusColors helper (crm-data.js) — Hebrew customer status → {bg,text}
function statusColors(status: string): { bg: string; text: string } {
  return (
    {
      'ליד': { bg: '#ede9fe', text: '#7c3aed' },
      'פגישה': { bg: '#fef3c7', text: '#b45309' },
      'מסמכים': { bg: '#ffedd5', text: '#c2410c' },
      'הגשה': { bg: '#f3e8ff', text: '#9333ea' },
      'אישור': { bg: '#d1fae5', text: '#065f46' },
      'סגירה': { bg: '#a7f3d0', text: '#064e3b' },
    }[status] || { bg: '#f1f5f9', text: '#64748b' }
  )
}

const statuses = ['הכל', 'ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']

export default function CustomersPage() {
  const t = useTheme()
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

  // Counts per status across loaded customers
  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    statuses.slice(1).forEach(s => {
      acc[s] = customers.filter(c => c.status === s).length
    })
    return acc
  }, [customers])

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1.5px solid ${t.border}`,
    borderRadius: 9, fontSize: 14, color: t.text, background: t.inputBg,
    outline: 'none', fontFamily: 'Heebo,sans-serif',
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
        {/* Page header */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: 28, animation: 'fadeUp 0.4s ease backwards',
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>לקוחות</h1>
            <p style={{ fontSize: 13, color: t.textMuted }}>{customers.length} לקוחות במערכת</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="crm-btn-primary"
            style={{
              background: t.primary, color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 4px 14px ${t.primary}45`, flexShrink: 0,
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            לקוח חדש
          </button>
        </div>

        {/* Status pills row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {statuses.slice(1).map((s, i) => {
            const sc = statusColors(s)
            const active = statusFilter === s
            return (
              <div
                key={s}
                onClick={() => setStatusFilter(active ? 'הכל' : s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 12,
                  background: active ? sc.bg : t.cardBg,
                  border: `1px solid ${active ? sc.text + '50' : t.border}`,
                  cursor: 'pointer', boxShadow: t.shadow,
                  transform: active ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                  animation: `fadeUp 0.4s ease ${i * 0.05 + 0.1}s backwards`,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: active ? sc.text : t.textSub }}>{s}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: active ? sc.text : t.textMuted }}>{counts[s]}</span>
              </div>
            )
          })}
        </div>

        {/* Search card */}
        <div
          style={{
            background: t.cardBg, borderRadius: 14, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, padding: '14px 18px', marginBottom: 18,
            display: 'flex', gap: 14, alignItems: 'center',
            animation: 'fadeUp 0.4s ease 0.2s backwards',
          }}
        >
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <Search size={15} color={t.textMuted} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לקוח..."
              style={{
                width: '100%', paddingRight: 38, paddingLeft: 14,
                height: 38, borderRadius: 9, border: `1px solid ${t.border}`,
                background: t.inputBg, color: t.text, fontSize: 14,
                outline: 'none', fontFamily: 'Heebo,sans-serif',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={e => { e.target.style.borderColor = t.primary; e.target.style.boxShadow = `0 0 0 3px ${t.primary}20` }}
              onBlur={e => { e.target.style.borderColor = t.border; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <span style={{ fontSize: 13, color: t.textMuted, marginRight: 'auto' }}>{customers.length} תוצאות</span>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              position: 'sticky', top: 58, zIndex: 20,
              display: 'flex', alignItems: 'center', gap: 10,
              background: t.primary, borderRadius: 12, padding: '10px 18px', marginBottom: 14,
              boxShadow: `0 4px 14px ${t.primary}45`, animation: 'scaleIn 0.2s ease',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{selectedIds.size} נבחרו</span>
            <button
              onClick={handleBulkExport}
              className="crm-btn"
              style={{
                background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8,
                padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Heebo,sans-serif', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Download size={13} /> ייצא CSV
            </button>
            <button
              onClick={() => setShowBulkDelete(true)}
              className="crm-btn"
              style={{
                background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8,
                padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Heebo,sans-serif', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Trash2 size={13} /> מחק
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                marginRight: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Heebo,sans-serif',
              }}
            >
              ביטול
            </button>
          </div>
        )}

        {/* Table */}
        <div
          style={{
            background: t.cardBg, borderRadius: 18, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, overflow: 'hidden',
            animation: 'fadeUp 0.4s ease 0.25s backwards',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192 }}>
              <Loader2 size={28} style={{ color: t.primary }} className="animate-spin" />
            </div>
          ) : customers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
              <Users size={40} style={{ color: t.border, marginBottom: 12 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: t.textSub }}>אין לקוחות עדיין</p>
              <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>הוסף את הלקוח הראשון שלך</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}>
                  <th style={{ padding: '13px 14px', width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: t.primary }}
                      aria-label="בחר הכל"
                    />
                  </th>
                  {['לקוח', 'ת.ז', 'טלפון', 'סטטוס', 'מקור', 'הכנסה', 'תאריך'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '13px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700,
                        color: t.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => {
                  const sc = statusColors(c.status)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      style={{
                        borderBottom: i < customers.length - 1 ? `1px solid ${t.borderLight}` : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                        animation: `fadeUp 0.35s ease ${i * 0.04 + 0.3}s backwards`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.bg)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 14px', width: 40 }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: t.primary }}
                          aria-label={`בחר ${c.first_name} ${c.last_name}`}
                        />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: t.primary + '20', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, fontWeight: 800, color: t.primary, flexShrink: 0,
                            }}
                          >
                            {c.first_name.charAt(0)}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                            {c.first_name} {c.last_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.textMuted }} dir="ltr">{c.id_number || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.textSub }} dir="ltr">{c.phone || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 12px', borderRadius: 20, background: sc.bg, color: sc.text, fontSize: 12, fontWeight: 600 }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.textSub }}>{c.lead_source || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: t.primary, fontWeight: 700 }}>
                        {c.monthly_income ? formatCurrency(c.monthly_income) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: t.textMuted }}>{formatDate(c.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Infinite-scroll sentinel */}
        {hasNextPage && (
          <div ref={sentinelRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            {isFetchingNextPage && <Loader2 size={20} style={{ color: t.primary }} className="animate-spin" />}
          </div>
        )}
      </div>

      {/* New customer modal */}
      {showNewModal && (
        <div
          onClick={() => setShowNewModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.cardBg, borderRadius: 20, padding: 28, width: '100%', maxWidth: 480,
              boxShadow: t.shadowHover, animation: 'scaleIn 0.25s ease', border: `1px solid ${t.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: t.text }}>לקוח חדש</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color={t.textMuted} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>שם פרטי *</label>
                  <input
                    required
                    value={newCustomer.first_name}
                    onChange={e => setNewCustomer(p => ({ ...p, first_name: e.target.value }))}
                    style={inputSt}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>שם משפחה *</label>
                  <input
                    required
                    value={newCustomer.last_name}
                    onChange={e => setNewCustomer(p => ({ ...p, last_name: e.target.value }))}
                    style={inputSt}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>ת.ז</label>
                  <input
                    value={newCustomer.id_number}
                    onChange={e => setNewCustomer(p => ({ ...p, id_number: e.target.value }))}
                    style={inputSt}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>טלפון</label>
                  <input
                    value={newCustomer.phone}
                    onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                    style={inputSt}
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>אימייל</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))}
                  style={inputSt}
                  dir="ltr"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>מקור הגעה</label>
                <select
                  value={newCustomer.lead_source}
                  onChange={e => setNewCustomer(p => ({ ...p, lead_source: e.target.value }))}
                  style={inputSt}
                >
                  <option value="">בחר...</option>
                  {['הפניה', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'טלפון'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={createCustomer.isPending}
                  className="crm-btn-primary"
                  style={{
                    flex: 1, background: t.primary, color: '#fff', border: 'none', borderRadius: 12,
                    padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'Heebo,sans-serif', boxShadow: `0 4px 14px ${t.primary}45`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: createCustomer.isPending ? 0.5 : 1,
                  }}
                >
                  {createCustomer.isPending && <Loader2 size={15} className="animate-spin" />}
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="crm-btn"
                  style={{
                    flex: 1, background: t.bg, color: t.textSub, border: `1px solid ${t.border}`,
                    borderRadius: 12, padding: '11px 0', fontSize: 14, cursor: 'pointer',
                    fontFamily: 'Heebo,sans-serif',
                  }}
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
