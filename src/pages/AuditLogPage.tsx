import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { History, Loader2, ArrowLeft } from 'lucide-react'
import { db } from '@/lib/firebase'
import { fromDocs, awaitUserId } from '@/services/_firestoreHelpers'
import { formatDate } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'
import type { AuditLogEntry } from '@/types/database'

// A5-17: map both singular entity_type values and plural Firestore collection names to Hebrew labels
const ENTITY_LABELS: Record<string, string> = {
  customer: 'לקוח',
  customers: 'לקוחות',
  lead: 'ליד',
  leads: 'לידים',
  mortgage: 'משכנתא',
  mortgages: 'משכנתאות',
  document: 'מסמך',
  documents: 'מסמכים',
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'שם פרטי',
  last_name: 'שם משפחה',
  status: 'סטטוס',
  phone: 'טלפון',
  email: 'אימייל',
  address: 'כתובת',
  marital_status: 'מצב משפחתי',
  children: 'ילדים',
  monthly_income: 'הכנסה חודשית',
  partner_income: 'הכנסת בן/בת זוג',
  own_capital: 'הון עצמי',
  existing_obligations: 'התחייבויות',
  lead_source: 'מקור הגעה',
  notes: 'הערות',
  name: 'שם',
  source: 'מקור',
  score: 'ציון',
  type: 'סוג',
  amount: 'סכום',
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function AuditLogPage() {
  const t = useTheme()
  const [entityFilter, setEntityFilter] = useState('הכל')

  const { data: entries = [], isLoading: loading } = useQuery({
    queryKey: ['audit_log'],
    queryFn: async () => {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, 'audit_log'),
          where('user_id', '==', uid),
          orderBy('changed_at', 'desc'),
          limit(100)
        )
      )
      return fromDocs<AuditLogEntry>(snap.docs)
    },
  })

  const filtered = useMemo(
    () =>
      entityFilter === 'הכל'
        ? entries
        : entries.filter((e) => ENTITY_LABELS[e.entity_type] === entityFilter),
    [entries, entityFilter]
  )

  const cardStyle = {
    background: t.cardBg,
    borderRadius: 20,
    boxShadow: t.shadow,
    border: `1px solid ${t.border}`,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: t.primary }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={22} style={{ color: t.primary }} />
            יומן שינויים
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
            {entries.length} שינויים אחרונים נרשמו במערכת
          </p>
        </div>

        <div className="flex gap-2 flex-wrap" style={{ marginBottom: 20 }}>
          {['הכל', 'לקוח', 'ליד', 'משכנתא', 'מסמך'].map((label) => {
            const active = entityFilter === label
            return (
              <button
                key={label}
                onClick={() => setEntityFilter(label)}
                className="crm-btn"
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Heebo,sans-serif',
                  background: active ? t.primary : t.bg,
                  color: active ? '#fff' : t.textSub,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ ...cardStyle, padding: '80px 40px' }}>
            <History size={40} style={{ color: t.textMuted }} className="mb-3" />
            <p style={{ fontSize: 15, fontWeight: 600, color: t.textSub }}>אין שינויים להצגה</p>
            <p style={{ fontSize: 13, marginTop: 4, color: t.textMuted }}>
              שינויים על לקוחות, לידים ומשכנתאות יופיעו כאן
            </p>
          </div>
        ) : (
          <>
          <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
            מציג {filtered.length} רשומות
          </p>
          <div className="space-y-3">
            {filtered.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  ...cardStyle,
                  padding: '16px 20px',
                  animation: `fadeUp 0.35s ease ${i * 0.04 + 0.05}s backwards`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: t.successBg,
                        color: t.success,
                      }}
                    >
                      {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                    </span>
                    {/* A5-18: show entity name with fallback to entity_id or em dash */}
                    <span style={{ fontSize: 12, color: t.textSub }}>
                      {(entry as AuditLogEntry & { entity_name?: string }).entity_name ?? entry.entity_id ?? '—'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: t.textMuted }}>{formatDate(entry.changed_at)}</span>
                </div>
                <div className="space-y-1.5">
                  {entry.changed_fields.map((field) => {
                    const change = entry.changes[field]
                    return (
                      <div key={field} className="flex items-center gap-2 text-[13px] flex-wrap">
                        <span style={{ fontWeight: 600, color: t.text, minWidth: 110 }}>
                          {fieldLabel(field)}
                        </span>
                        <span style={{ color: t.textMuted }}>{formatValue(change?.from)}</span>
                        <ArrowLeft size={13} style={{ color: t.textMuted }} />
                        <span style={{ color: t.primary }}>{formatValue(change?.to)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  )
}
