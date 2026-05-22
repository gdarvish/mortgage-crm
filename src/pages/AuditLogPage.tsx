import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { History, Loader2, ArrowLeft } from 'lucide-react'
import { db } from '@/lib/firebase'
import { fromDocs, awaitUserId } from '@/services/_firestoreHelpers'
import { formatDate } from '@/lib/utils'
import type { AuditLogEntry } from '@/types/database'

const ENTITY_LABELS: Record<string, string> = {
  customer: 'לקוח',
  lead: 'ליד',
  mortgage: 'משכנתא',
  document: 'מסמך',
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

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: '#059669' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div>
        <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
          <History size={22} style={{ color: '#059669' }} />
          יומן שינויים
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>
          {entries.length} שינויים אחרונים נרשמו במערכת
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['הכל', 'לקוח', 'ליד', 'משכנתא', 'מסמך'].map((label) => (
          <button
            key={label}
            onClick={() => setEntityFilter(label)}
            className="px-4 py-2 text-[13px] font-semibold transition-all"
            style={{
              borderRadius: 20,
              background: entityFilter === label ? '#059669' : '#f5f4f2',
              color: entityFilter === label ? '#fff' : '#57534e',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20" style={cardStyle}>
          <History size={40} style={{ color: '#d6d3d1' }} className="mb-3" />
          <p className="text-[15px] font-semibold" style={{ color: '#57534e' }}>אין שינויים להצגה</p>
          <p className="text-[13px] mt-1" style={{ color: '#a8a29e' }}>
            שינויים על לקוחות, לידים ומשכנתאות יופיעו כאן
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div key={entry.id} style={{ ...cardStyle, padding: '16px 20px' }}>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: '#d1fae5', color: '#065f46' }}
                >
                  {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                </span>
                <span className="text-[12px]" style={{ color: '#a8a29e' }}>{formatDate(entry.changed_at)}</span>
              </div>
              <div className="space-y-1.5">
                {entry.changed_fields.map((field) => {
                  const change = entry.changes[field]
                  return (
                    <div key={field} className="flex items-center gap-2 text-[13px] flex-wrap">
                      <span className="font-semibold" style={{ color: '#1c1917', minWidth: 110 }}>
                        {fieldLabel(field)}
                      </span>
                      <span style={{ color: '#a8a29e' }}>{formatValue(change?.from)}</span>
                      <ArrowLeft size={13} style={{ color: '#d6d3d1' }} />
                      <span style={{ color: '#059669' }}>{formatValue(change?.to)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
