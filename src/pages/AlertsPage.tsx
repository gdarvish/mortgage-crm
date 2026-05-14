import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle, RefreshCw, User, Loader2 } from 'lucide-react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { formatCurrency } from '@/lib/utils'

interface AlertItem {
  id: string
  customerName: string
  customerId: string
  trackType: string
  daysLeft: number
  status: string
  amount: number
  interestRate: number
}

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

function getUrgency(days: number) {
  if (days < 60)  return { label: 'דחוף', bg: '#fee2e2', color: '#dc2626', dot: '#dc2626' }
  if (days < 120) return { label: 'אזהרה', bg: '#fef3c7', color: '#d97706', dot: '#d97706' }
  return                { label: 'תקין',   bg: '#d1fae5', color: '#065f46', dot: '#059669' }
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'urgent' | 'warning' | 'normal'>('all')
  const [handled, setHandled] = useState<Set<string>>(new Set())

  const fetchAlerts = useCallback(async () => {
    const uid = auth.currentUser?.uid
    if (!uid) { setLoading(false); return }
    setLoading(true)
    try {
      // 1. Fetch customers for name lookup
      const custSnap = await getDocs(query(collection(db, 'customers'), where('user_id', '==', uid)))
      const custMap: Record<string, string> = {}
      custSnap.docs.forEach(d => {
        const c = d.data()
        custMap[d.id] = `${c.first_name} ${c.last_name}`
      })

      // 2. Fetch mortgages → build mortgageId → customerId map
      const mortSnap = await getDocs(query(collection(db, 'mortgages'), where('user_id', '==', uid)))
      const mortMap: Record<string, string> = {}
      mortSnap.docs.forEach(d => { mortMap[d.id] = d.data().customer_id })
      const mortgageIds = mortSnap.docs.map(d => d.id)

      if (mortgageIds.length === 0) {
        setAlerts([])
        return
      }

      // 3. Fetch loan_tracks for those mortgages (chunked by 30 for Firestore 'in' limit)
      const chunks: string[][] = []
      for (let i = 0; i < mortgageIds.length; i += 30) chunks.push(mortgageIds.slice(i, i + 30))
      const trackDocs = (
        await Promise.all(
          chunks.map(chunk =>
            getDocs(query(collection(db, 'loan_tracks'), where('mortgage_id', 'in', chunk)))
          )
        )
      ).flatMap(s => s.docs)

      // 4. Build alert items
      const now = new Date()
      const items: AlertItem[] = []
      trackDocs.forEach(d => {
        const t = d.data()
        if (!t.end_date) return
        const endDate = new Date(t.end_date)
        const daysLeft = Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (daysLeft < 0 || daysLeft > 180) return
        const customerId = mortMap[t.mortgage_id] ?? ''
        items.push({
          id: d.id,
          customerName: custMap[customerId] ?? 'לקוח לא ידוע',
          customerId,
          trackType: t.type ?? 'לא ידוע',
          daysLeft,
          status: 'פתוח',
          amount: t.balance ?? t.amount ?? 0,
          interestRate: t.interest_rate ?? 0,
        })
      })

      items.sort((a, b) => a.daysLeft - b.daysLeft)
      setAlerts(items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const markHandled = (id: string) => setHandled(prev => new Set([...prev, id]))

  const filtered = alerts.filter(a => {
    if (filter === 'urgent')  return a.daysLeft < 60
    if (filter === 'warning') return a.daysLeft >= 60 && a.daysLeft < 120
    if (filter === 'normal')  return a.daysLeft >= 120
    return true
  })

  const counts = {
    all: alerts.length,
    urgent: alerts.filter(a => a.daysLeft < 60).length,
    warning: alerts.filter(a => a.daysLeft >= 60 && a.daysLeft < 120).length,
    normal: alerts.filter(a => a.daysLeft >= 120).length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: '#059669' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
            <Bell size={22} style={{ color: '#059669' }} />
            התראות מסלולים
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>{alerts.length} התראות פעילות</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all' as const,     label: 'הכל',   count: counts.all,     bg: '#f5f4f2', color: '#57534e', activeBg: '#1c1917', activeColor: '#fafaf9' },
          { key: 'urgent' as const,  label: 'דחוף',  count: counts.urgent,  bg: '#fee2e2', color: '#dc2626', activeBg: '#dc2626', activeColor: '#fff' },
          { key: 'warning' as const, label: 'אזהרה', count: counts.warning, bg: '#fef3c7', color: '#d97706', activeBg: '#d97706', activeColor: '#fff' },
          { key: 'normal' as const,  label: 'תקין',  count: counts.normal,  bg: '#d1fae5', color: '#065f46', activeBg: '#059669', activeColor: '#fff' },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-4 py-2 text-[13px] font-semibold transition-all"
            style={{
              borderRadius: 20,
              background: filter === f.key ? f.activeBg : f.bg,
              color: filter === f.key ? f.activeColor : f.color,
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Alert cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20" style={cardStyle}>
          <CheckCircle size={40} style={{ color: '#a7f3d0' }} className="mb-3" />
          <p className="text-[15px] font-semibold" style={{ color: '#57534e' }}>אין התראות בקטגוריה זו</p>
          <p className="text-[13px] mt-1" style={{ color: '#a8a29e' }}>כל המסלולים תקינים</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert, i) => {
            const urgency = getUrgency(alert.daysLeft)
            const isHandled = handled.has(alert.id)
            return (
              <div
                key={alert.id}
                style={{
                  ...cardStyle,
                  padding: '16px 20px',
                  opacity: isHandled ? 0.5 : 1,
                  animationName: 'fadeUp',
                  animationDuration: '0.35s',
                  animationDelay: `${i * 40}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: urgency.dot, flexShrink: 0 }} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[14px] font-bold" style={{ color: '#1c1917' }}>{alert.customerName}</h3>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: urgency.bg, color: urgency.color }}
                        >
                          {alert.daysLeft} ימים
                        </span>
                        {isHandled && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f5f4f2', color: '#a8a29e' }}>טופל</span>
                        )}
                      </div>
                      <p className="text-[13px] mt-0.5" style={{ color: '#57534e' }}>
                        מסלול {alert.trackType} · {formatCurrency(alert.amount)} · {alert.interestRate}%
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap shrink-0">
                    <button
                      onClick={() => navigate(`/customers/${alert.customerId}`)}
                      className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: '#f5f4f2', color: '#57534e' }}
                    >
                      <User size={12} /> תיק לקוח
                    </button>
                    <button
                      onClick={() => navigate('/refinance')}
                      className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: '#d1fae5', color: '#065f46' }}
                    >
                      <RefreshCw size={12} /> מחשבון מחזור
                    </button>
                    {!isHandled && (
                      <button
                        onClick={() => markHandled(alert.id)}
                        className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: '#d1fae5', color: '#065f46' }}
                      >
                        <CheckCircle size={12} /> טופל
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
