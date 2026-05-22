import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CheckSquare, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'
import { useAlerts, useMarkAlertHandled } from '@/hooks/queries/useAlerts'
import { toast } from '@/components/ui'

interface AlertItem {
  id: string
  customerName: string
  customerId: string
  trackType: string
  daysLeft: number
  amount: number
  initials: string
}

export default function AlertsPage() {
  const t = useTheme()
  const navigate = useNavigate()
  const [snoozed, setSnoozed] = useState<string[]>([])

  const { data: rawAlerts = [], isLoading: loading } = useAlerts({ status: 'פתוח' })
  const markHandled = useMarkAlertHandled()

  const alerts: AlertItem[] = rawAlerts
    .map((a) => {
      const name = a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : 'לקוח לא ידוע'
      return {
        id: a.id,
        customerName: name,
        customerId: a.customer_id,
        trackType: a.track_type || a.loan_track?.type || 'לא ידוע',
        daysLeft: a.days_until_end ?? 0,
        amount: a.track_amount ?? a.loan_track?.amount ?? 0,
        initials: name.charAt(0) || '?',
      }
    })
    .sort((x, y) => x.daysLeft - y.daysLeft)

  const active = alerts.filter((a) => !snoozed.includes(a.id))

  const snooze = (id: string) => setSnoozed((p) => (p.includes(id) ? p : [...p, id]))

  const handleSnooze = (id: string) => {
    snooze(id)
    markHandled.mutate(id, {
      onSuccess: () => toast.success('ההתראה נדחתה'),
      onError: (err) => {
        setSnoozed((p) => p.filter((x) => x !== id))
        toast.error('שגיאה בעדכון התראה', err.message)
      },
    })
  }

  const urgent = active.filter((a) => a.daysLeft < 60).length
  const warning = active.filter((a) => a.daysLeft >= 60 && a.daysLeft < 120).length
  const ok = active.filter((a) => a.daysLeft >= 120).length

  const getAlertStyle = (days: number) => {
    if (days < 60) return { col: '#dc2626', bg: '#fee2e2', label: 'דחוף' }
    if (days < 120) return { col: '#d97706', bg: '#fef3c7', label: 'בקרוב' }
    return { col: t.success, bg: t.successBg, label: 'תקין' }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <Loader2 size={32} style={{ color: t.primary }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
        <div style={{ marginBottom: 28, animation: 'fadeUp 0.4s ease backwards' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>התראות מסלולים</h1>
          <p style={{ fontSize: 13, color: t.textMuted }}>מסלולים המתקרבים לסיום תקופה</p>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'דחוף', count: urgent, col: '#dc2626', bg: '#fee2e2', icon: AlertTriangle, sub: 'פחות מ-60 יום' },
            { label: 'בקרוב', count: warning, col: '#d97706', bg: '#fef3c7', icon: Bell, sub: '60–120 יום' },
            { label: 'תקין', count: ok, col: t.success, bg: t.successBg, icon: CheckSquare, sub: 'מעל 120 יום' },
          ].map((c, i) => {
            const CardIcon = c.icon
            return (
              <div
                key={c.label}
                style={{
                  background: t.cardBg,
                  borderRadius: 18,
                  padding: '20px 24px',
                  boxShadow: t.shadow,
                  border: `1px solid ${t.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  animation: `fadeUp 0.4s ease ${i * 0.08 + 0.05}s backwards`,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: c.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CardIcon size={22} color={c.col} />
                </div>
                <div>
                  <p style={{ fontSize: 28, fontWeight: 800, color: c.col, lineHeight: 1 }}>{c.count}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 3 }}>{c.label}</p>
                  <p style={{ fontSize: 11, color: t.textMuted }}>{c.sub}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Alert list */}
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
          {active.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: t.successBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <CheckSquare size={22} color={t.success} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: t.text }}>אין התראות פעילות</p>
            </div>
          ) : (
            active.map((a, i) => (
              <AlertRow
                key={a.id}
                alert={a}
                isLast={i === active.length - 1}
                index={i}
                t={t}
                getAlertStyle={getAlertStyle}
                onSnooze={handleSnooze}
                onProfile={() => navigate(`/customers/${a.customerId}`)}
                snoozing={markHandled.isPending && markHandled.variables === a.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

interface AlertRowProps {
  alert: AlertItem
  isLast: boolean
  index: number
  t: ReturnType<typeof useTheme>
  getAlertStyle: (days: number) => { col: string; bg: string; label: string }
  onSnooze: (id: string) => void
  onProfile: () => void
  snoozing: boolean
}

function AlertRow({ alert, isLast, index, t, getAlertStyle, onSnooze, onProfile, snoozing }: AlertRowProps) {
  const [hov, setHov] = useState(false)
  const as = getAlertStyle(alert.daysLeft)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '18px 24px',
        borderBottom: isLast ? 'none' : `1px solid ${t.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        background: hov ? t.bg : 'transparent',
        transform: hov ? 'translateX(4px)' : 'translateX(0)',
        transition: 'all 0.18s ease',
        animation: `slideInRight 0.4s ease ${index * 0.07 + 0.35}s backwards`,
      }}
    >
      <div
        className={alert.daysLeft < 60 ? 'crm-urgent' : ''}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: as.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={20} color={as.col} />
      </div>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: t.primary + '18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 13,
          color: t.primary,
          flexShrink: 0,
        }}
      >
        {alert.initials}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{alert.customerName}</p>
        <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
          מסלול {alert.trackType} · {formatCurrency(alert.amount)}
        </p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: as.col, lineHeight: 1 }}>{alert.daysLeft}</p>
        <p style={{ fontSize: 11, color: t.textMuted }}>ימים לסיום</p>
      </div>
      <span
        style={{
          padding: '4px 14px',
          borderRadius: 20,
          background: as.bg,
          color: as.col,
          fontSize: 12,
          fontWeight: 700,
          minWidth: 54,
          textAlign: 'center',
        }}
      >
        {as.label}
      </span>
      <div style={{ display: 'flex', gap: 8, opacity: hov ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
        <button
          onClick={() => onSnooze(alert.id)}
          disabled={snoozing}
          className="crm-btn"
          style={{
            background: t.bg,
            color: t.textSub,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Heebo,sans-serif',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: snoozing ? 0.5 : 1,
          }}
        >
          {snoozing && <Loader2 size={12} className="animate-spin" />}
          נדחה
        </button>
        <button
          onClick={onProfile}
          className="crm-btn"
          style={{
            background: t.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Heebo,sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          לפרופיל
        </button>
      </div>
    </div>
  )
}
