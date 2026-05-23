import { useState } from 'react'
import { CheckSquare, AlertTriangle, DollarSign, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'
import { useCommissions, useDeleteCommission } from '@/hooks/queries/useCommissions'
import { toast, ConfirmDialog } from '@/components/ui'

type CommissionRow = {
  id: string
  customerName: string
  initials: string
  loanAmount: number
  amount: number
  status: string
  paymentDate: string | null
  createdAt: string
}

export default function CommissionsPage() {
  const t = useTheme()
  const [filter, setFilter] = useState('הכל')
  // A4-11 / A4-14: state for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null)

  const { data: rawCommissions = [], isLoading: loading } = useCommissions()
  // A4-06: use React Query mutation hook for delete (invalidates cache)
  const deleteCommission = useDeleteCommission()

  const commissions: CommissionRow[] = rawCommissions.map((c) => {
    const name = c.customer ? `${c.customer.first_name} ${c.customer.last_name}` : 'לא ידוע'
    return {
      id: c.id,
      customerName: name,
      initials: name.charAt(0) || '?',
      loanAmount: c.mortgage?.loan_amount ?? 0,
      amount: c.amount ?? 0,
      status: c.status ?? 'ממתין',
      // A4-05: store as string (already converted by firestoreHelpers) but guard anyway
      paymentDate: c.payment_date ?? null,
      createdAt: c.created_at ?? '',
    }
  })

  const filtered = commissions.filter((c) => filter === 'הכל' || c.status === filter)

  const paid = commissions.filter((c) => c.status === 'שולם').reduce((s, c) => s + c.amount, 0)
  const pending = commissions.filter((c) => c.status === 'ממתין').reduce((s, c) => s + c.amount, 0)

  const now = new Date()
  const month = commissions
    .filter((c) => {
      if (c.status !== 'שולם' || !c.paymentDate) return false
      const d = new Date(c.paymentDate)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((s, c) => s + c.amount, 0)

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    deleteCommission.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('העמלה נמחקה')
        setDeleteTarget(null)
      },
      onError: (err) => {
        toast.error('שגיאה במחיקת עמלה', err.message)
        setDeleteTarget(null)
      },
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <div
          className="animate-spin"
          style={{
            width: 32,
            height: 32,
            border: `3px solid ${t.border}`,
            borderTopColor: t.primary,
            borderRadius: '50%',
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ marginBottom: 28, animation: 'fadeUp 0.4s ease backwards' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>עמלות</h1>
          <p style={{ fontSize: 13, color: t.textMuted }}>מעקב עמלות ותשלומים</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 18, marginBottom: 24 }}>
          {[
            { label: 'שולם סה"כ', value: formatCurrency(paid), col: '#059669', bg: '#d1fae5', icon: CheckSquare },
            { label: 'ממתין לתשלום', value: formatCurrency(pending), col: '#d97706', bg: '#fef3c7', icon: AlertTriangle },
            { label: 'החודש', value: formatCurrency(month), col: t.primary, bg: t.primary + '18', icon: DollarSign },
          ].map((c, i) => {
            const CardIcon = c.icon
            return (
              <div
                key={c.label}
                style={{
                  background: t.cardBg,
                  borderRadius: 20,
                  padding: '24px 26px',
                  boxShadow: t.shadow,
                  border: `1px solid ${t.border}`,
                  animation: `fadeUp 0.4s ease ${i * 0.08 + 0.05}s backwards`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 12, color: t.textMuted, fontWeight: 500, marginBottom: 8, letterSpacing: '0.03em' }}>
                      {c.label}
                    </p>
                    <p style={{ fontSize: 26, fontWeight: 800, color: t.text, lineHeight: 1 }}>{c.value}</p>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      background: c.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CardIcon size={20} color={c.col} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Filter + table */}
        <div
          style={{
            background: t.cardBg,
            borderRadius: 20,
            boxShadow: t.shadow,
            border: `1px solid ${t.border}`,
            overflow: 'hidden',
            animation: 'fadeUp 0.4s ease 0.3s backwards',
          }}
        >
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            {['הכל', 'שולם', 'ממתין'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="crm-btn"
                style={{
                  padding: '5px 16px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: filter === s ? 700 : 400,
                  background: filter === s ? t.primary : t.bg,
                  color: filter === s ? '#fff' : t.textSub,
                  fontFamily: 'Heebo,sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </button>
            ))}
            <span style={{ marginRight: 'auto', fontSize: 13, color: t.textMuted }}>{filtered.length} רשומות</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 13, color: t.textMuted }}>אין עמלות</div>
          ) : (
            <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}>
                  {['לקוח', 'סכום הלוואה', 'עמלה', 'אחוז', 'סטטוס', 'תאריך תשלום', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '13px 22px',
                        textAlign: 'right',
                        fontSize: 11,
                        fontWeight: 700,
                        color: t.textMuted,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <CommissionRowEl
                    key={c.id}
                    row={c}
                    index={i}
                    isLast={i === filtered.length - 1}
                    t={t}
                    onDelete={() => setDeleteTarget({ id: c.id })}
                    deleting={deleteCommission.isPending && deleteCommission.variables === c.id}
                  />
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* A4-06 + A4-14: delete confirmation dialog */}
        <ConfirmDialog
          open={!!deleteTarget}
          variant="danger"
          title="מחיקת עמלה"
          message="האם אתה בטוח שברצונך למחוק עמלה זו? לא ניתן לבטל פעולה זו."
          confirmText="מחק"
          cancelText="ביטול"
          loading={deleteCommission.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </div>
  )
}

interface CommissionRowProps {
  row: CommissionRow
  index: number
  isLast: boolean
  t: ReturnType<typeof useTheme>
  // A4-14: always-visible delete action
  onDelete: () => void
  deleting: boolean
}

function CommissionRowEl({ row, index, isLast, t, onDelete, deleting }: CommissionRowProps) {
  const [hov, setHov] = useState(false)
  const isPaid = row.status === 'שולם'
  const pct = row.loanAmount > 0 ? ((row.amount / row.loanAmount) * 100).toFixed(2) : '0.00'

  // A4-05: safely format the payment date even if it arrives as a Timestamp object
  function toSafeDate(value: unknown): Date | string | null {
    if (!value) return null
    if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate()
    }
    if (value instanceof Date) return value
    return String(value)
  }

  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${t.borderLight}`,
        background: hov ? t.bg : 'transparent',
        transition: 'background 0.12s',
        animation: `fadeUp 0.35s ease ${index * 0.04 + 0.35}s backwards`,
      }}
    >
      <td style={{ padding: '15px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: t.primary + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: t.primary,
            }}
          >
            {row.initials}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{row.customerName}</span>
        </div>
      </td>
      <td style={{ padding: '15px 22px', fontSize: 13, color: t.textSub }}>
        {row.loanAmount > 0 ? formatCurrency(row.loanAmount) : '—'}
      </td>
      <td style={{ padding: '15px 22px', fontSize: 15, fontWeight: 800, color: isPaid ? '#059669' : t.text }}>
        {formatCurrency(row.amount)}
      </td>
      <td style={{ padding: '15px 22px', fontSize: 13, color: t.textMuted }}>{pct}%</td>
      <td style={{ padding: '15px 22px' }}>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: 20,
            background: isPaid ? '#d1fae5' : '#fef3c7',
            color: isPaid ? '#065f46' : '#b45309',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {row.status}
        </span>
      </td>
      <td style={{ padding: '15px 22px', fontSize: 13, color: t.textMuted }}>
        {/* A4-05: use toSafeDate to handle potential Timestamp objects */}
        {row.paymentDate ? formatDate(toSafeDate(row.paymentDate)) : '—'}
      </td>
      {/* A4-14: always-visible delete button (not hidden behind hover opacity) */}
      <td style={{ padding: '15px 16px' }}>
        <button
          onClick={onDelete}
          disabled={deleting}
          aria-label="מחק עמלה"
          style={{
            background: 'none',
            border: 'none',
            cursor: deleting ? 'default' : 'pointer',
            opacity: deleting ? 0.4 : 0.55,
            padding: 6,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Trash2 size={14} color="#dc2626" />
        </button>
      </td>
    </tr>
  )
}
