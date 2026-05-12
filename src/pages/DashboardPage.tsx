import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, TrendingUp, UserPlus, DollarSign, Bell, AlertTriangle,
  Loader2, Plus, CheckSquare,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { fromDoc, fromDocs } from '@/services/_firestoreHelpers'
import type { Customer, Task, Alert, Commission, LoanTrack } from '@/types/database'

const statusOrder = ['ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']
const hebrewMonths = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const PIPELINE_COLORS: Record<string, string> = {
  'ליד': '#6366f1',
  'פגישה': '#f59e0b',
  'מסמכים': '#f97316',
  'הגשה': '#8b5cf6',
  'אישור': '#10b981',
  'סגירה': '#059669',
}

const SOURCE_COLORS = ['#059669', '#2563eb', '#d97706', '#8b5cf6', '#dc2626', '#10b981']

interface DashboardAlert extends Alert {
  customer_name?: string
  track_type?: string
}

interface DashboardTask extends Task {
  customer_name?: string
}

function useCountUp(target: number, duration = 1100, active = true) {
  const [count, setCount] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!active || target === 0) {
      setCount(target)
      return
    }
    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration, active])

  return count
}

function KpiCard({
  label, value, icon: Icon, color, isCurrency = false, trend, index,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  isCurrency?: boolean
  trend: string
  index: number
}) {
  const [hovered, setHovered] = useState(false)
  const displayed = useCountUp(value, 1100)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="animate-fade-up"
      style={{
        animationDelay: `${index * 80}ms`,
        background: '#ffffff',
        borderRadius: 20,
        padding: '24px 26px',
        boxShadow: hovered
          ? '0 4px 24px rgba(28,25,23,0.14)'
          : '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-medium" style={{ color: '#57534e' }}>{label}</p>
          <p className="text-[28px] font-black leading-none tabular-nums" style={{ color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
            {isCurrency ? formatCurrency(displayed) : displayed}
          </p>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
            style={{
              animation: 'trendPop 0.45s 0.6s backwards',
              background: color + '18',
              color,
            }}
          >
            {trend}
          </span>
        </div>
        <div
          className="flex items-center justify-center shrink-0 transition-transform duration-200"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: color + '15',
            transform: hovered ? 'rotate(-6deg) scale(1.12)' : 'none',
          }}
        >
          <Icon size={22} style={{ color }} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [commissionTotal, setCommissionTotal] = useState(0)
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    const uid = auth.currentUser?.uid
    if (!uid) {
      setLoading(false)
      return
    }

    try {
      const [customersSnap, tasksSnap, alertsSnap, commissionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'customers'), where('user_id', '==', uid), orderBy('created_at', 'desc'))),
        getDocs(query(
          collection(db, 'tasks'),
          where('user_id', '==', uid),
          orderBy('due_date', 'asc'),
          limit(50)
        )),
        getDocs(query(
          collection(db, 'alerts'),
          where('user_id', '==', uid),
          where('status', '==', 'פתוח'),
          orderBy('days_until_end', 'asc'),
          limit(8)
        )),
        getDocs(query(collection(db, 'commissions'), where('user_id', '==', uid), where('status', '==', 'שולם'))),
      ])

      const customersData = fromDocs<Customer>(customersSnap.docs)
      setCustomers(customersData)

      const tasksData = fromDocs<Task>(tasksSnap.docs)
        .filter(t => t.status !== 'הושלמה')
        .slice(0, 10)
      const taskCustomerIds = Array.from(new Set(tasksData.map(t => t.customer_id).filter(Boolean) as string[]))
      const customerMap: Record<string, string> = {}
      await Promise.all(taskCustomerIds.map(async (cid) => {
        const snap = await getDoc(doc(db, 'customers', cid))
        if (snap.exists()) {
          const c = fromDoc<Customer>(snap)
          customerMap[cid] = `${c.first_name} ${c.last_name}`
        }
      }))
      setTasks(tasksData.map(t => ({
        ...t,
        customer_name: t.customer_id ? customerMap[t.customer_id] : undefined,
      })))

      const alertsData = fromDocs<Alert>(alertsSnap.docs)
      if (alertsData.length > 0) {
        const alertCustomerIds = Array.from(new Set(alertsData.map(a => a.customer_id)))
        const alertTrackIds = Array.from(new Set(alertsData.map(a => a.loan_track_id).filter(Boolean) as string[]))

        const [custMap, trackMap] = await Promise.all([
          (async () => {
            const map: Record<string, string> = {}
            await Promise.all(alertCustomerIds.map(async (cid) => {
              const snap = await getDoc(doc(db, 'customers', cid))
              if (snap.exists()) {
                const c = fromDoc<Customer>(snap)
                map[cid] = `${c.first_name} ${c.last_name}`
              }
            }))
            return map
          })(),
          (async () => {
            const map: Record<string, string> = {}
            await Promise.all(alertTrackIds.map(async (tid) => {
              const snap = await getDoc(doc(db, 'loan_tracks', tid))
              if (snap.exists()) {
                const t = fromDoc<LoanTrack>(snap)
                map[tid] = t.type || '—'
              }
            }))
            return map
          })(),
        ])

        setAlerts(alertsData.map(a => ({
          ...a,
          customer_name: custMap[a.customer_id] || 'לא ידוע',
          track_type: a.loan_track_id ? (trackMap[a.loan_track_id] || '—') : '—',
        })))
      } else {
        setAlerts([])
      }

      const commissionsData = fromDocs<Commission>(commissionsSnap.docs)
      setCommissionTotal(commissionsData.reduce((sum, c) => sum + (c.amount || 0), 0))
    } catch (e) {
      console.error('Dashboard fetchData failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleTask = async (id: string) => {
    setCheckedTasks(prev => new Set(prev).add(id))
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'tasks', id), { status: 'הושלמה' })
        setTasks(prev => prev.filter(t => t.id !== id))
      } catch (e) {
        console.error('toggleTask failed', e)
      }
      setCheckedTasks(prev => { const s = new Set(prev); s.delete(id); return s })
    }, 380)
  }

  const now = new Date()
  const todayStr = `${hebrewDays[now.getDay()]}, ${now.getDate()} ב${['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][now.getMonth()]} ${now.getFullYear()}`
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const activeCustomers = customers.length
  const dealsThisMonth = customers.filter(c => c.status === 'סגירה' && c.created_at >= thisMonthStart).length
  const newLeads = customers.filter(c => c.status === 'ליד' && c.created_at >= thisMonthStart).length

  const kpiCards = [
    { label: 'לקוחות פעילים', value: activeCustomers, icon: Users,      color: '#059669', trend: '+12%' },
    { label: 'עסקאות החודש',  value: dealsThisMonth,  icon: TrendingUp, color: '#10b981', trend: '+50%' },
    { label: 'לידים חדשים',   value: newLeads,         icon: UserPlus,  color: '#d97706', trend: '+8%' },
    { label: 'עמלות ששולמו',  value: commissionTotal, icon: DollarSign, color: '#8b5cf6', trend: '+22%', isCurrency: true },
  ]

  // Pipeline
  const pipelineCounts = statusOrder.map(s => ({
    status: s,
    count: customers.filter(c => c.status === s).length,
  }))
  const totalPipeline = pipelineCounts.reduce((sum, s) => sum + s.count, 0) || 1

  // Charts
  const sourceCounts: Record<string, number> = {}
  customers.forEach(c => {
    const source = c.lead_source || 'אחר'
    sourceCounts[source] = (sourceCounts[source] || 0) + 1
  })
  const sourceData = Object.entries(sourceCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const monthlyDeals: { month: string; deals: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const count = customers.filter(c => {
      const cd = new Date(c.created_at)
      return cd >= d && cd <= monthEnd
    }).length
    monthlyDeals.push({ month: hebrewMonths[d.getMonth()], deals: count })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: '#059669' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-[1360px] mx-auto">
      {/* Greeting header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 26, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
            שלום, יועץ משכנתאות
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: '#a8a29e' }}>
            {todayStr} &nbsp;·&nbsp; {tasks.length} משימות פתוחות
          </p>
        </div>
        <button
          onClick={() => navigate('/customers/new')}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.96] shrink-0"
          style={{
            borderRadius: 12,
            background: '#059669',
            boxShadow: '0 4px 14px rgba(5,150,105,0.27)',
          }}
        >
          <Plus size={15} />
          לקוח חדש
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <KpiCard key={card.label} {...card} index={i} isCurrency={card.isCurrency ?? false} />
        ))}
      </div>

      {/* Pipeline Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '22px 26px',
          boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
        }}
      >
        <p className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>פייפליין לקוחות</p>
        <div className="flex gap-[3px] w-full overflow-hidden" style={{ height: 10, borderRadius: 8 }}>
          {pipelineCounts.map(({ status, count }) => (
            <div
              key={status}
              title={`${status}: ${count}`}
              style={{
                width: `${(count / totalPipeline) * 100}%`,
                background: PIPELINE_COLORS[status] || '#a8a29e',
                borderRadius: 8,
                transition: 'width 0.7s cubic-bezier(0.25,1,0.5,1)',
                minWidth: count > 0 ? 4 : 0,
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {pipelineCounts.map(({ status, count }) => (
            <button
              key={status}
              onClick={() => navigate('/customers')}
              className="flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium transition-transform duration-150 hover:-translate-y-[2px]"
              style={{
                borderRadius: 20,
                border: `1.5px solid ${PIPELINE_COLORS[status] || '#a8a29e'}`,
                color: PIPELINE_COLORS[status] || '#a8a29e',
                background: (PIPELINE_COLORS[status] || '#a8a29e') + '10',
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 6, height: 6, background: PIPELINE_COLORS[status] || '#a8a29e' }}
              />
              {status}
              <span className="font-bold">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Alerts + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Alerts */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: '#f5f4f2' }}>
            <Bell size={16} style={{ color: '#059669' }} />
            <h2 className="text-[15px] font-bold" style={{ color: '#1c1917' }}>התראות מסלולים</h2>
          </div>
          <div>
            {alerts.length === 0 ? (
              <div className="py-10 text-center text-[13px]" style={{ color: '#a8a29e' }}>אין התראות פתוחות</div>
            ) : alerts.map((alert, i) => {
              const days = alert.days_until_end || 999
              const isUrgent = days < 60
              const isSoon = days < 120
              const color = isUrgent ? '#dc2626' : isSoon ? '#d97706' : '#059669'
              const bgColor = isUrgent ? '#fee2e2' : isSoon ? '#fef3c7' : '#d1fae5'

              return (
                <div
                  key={alert.id}
                  onClick={() => navigate(`/customers/${alert.customer_id}`)}
                  className="flex items-center justify-between px-6 py-3 cursor-pointer border-b transition-all duration-150"
                  style={{
                    borderColor: '#f5f4f2',
                    animationName: 'slideInRight',
                    animationDuration: '0.35s',
                    animationDelay: `${i * 70}ms`,
                    animationFillMode: 'backwards',
                    animationTimingFunction: 'ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '')}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle
                      size={16}
                      style={{
                        color,
                        animation: isUrgent ? 'urgentPulse 2s infinite' : undefined,
                      }}
                    />
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: '#1c1917' }}>{alert.customer_name}</p>
                      <p className="text-[12px]" style={{ color: '#a8a29e' }}>מסלול: {alert.track_type}</p>
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
                    style={{ background: bgColor, color }}
                  >
                    {days} ימים
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tasks */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: '#f5f4f2' }}>
            <CheckSquare size={16} style={{ color: '#059669' }} />
            <h2 className="text-[15px] font-bold" style={{ color: '#1c1917' }}>משימות פתוחות</h2>
            <span
              className="mr-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#d1fae5', color: '#059669' }}
            >
              {tasks.length}
            </span>
          </div>
          <div>
            {tasks.length === 0 ? (
              <div className="py-10 text-center text-[13px]" style={{ color: '#a8a29e' }}>אין משימות פתוחות</div>
            ) : tasks.map((task) => {
              const checked = checkedTasks.has(task.id)
              const priorityStyle: Record<string, { bg: string; color: string }> = {
                'דחופה': { bg: '#fee2e2', color: '#dc2626' },
                'גבוהה': { bg: '#ffedd5', color: '#ea580c' },
                'בינונית': { bg: '#dbeafe', color: '#1d4ed8' },
                'נמוכה':  { bg: '#f1f5f9', color: '#64748b' },
              }
              const ps = priorityStyle[task.priority] || { bg: '#f1f5f9', color: '#64748b' }

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-6 py-3 border-b"
                  style={{ borderColor: '#f5f4f2' }}
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="shrink-0 flex items-center justify-center transition-all duration-150"
                    style={{
                      width: 21,
                      height: 21,
                      borderRadius: 6,
                      border: `2px solid ${checked ? '#059669' : '#d6d3d1'}`,
                      background: checked ? '#059669' : 'transparent',
                      animation: checked ? 'checkBounce 0.38s ease' : undefined,
                    }}
                    aria-label="סמן כהושלם"
                  >
                    {checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: '#1c1917' }}>{task.title}</p>
                    {task.customer_name && (
                      <p className="text-[11px]" style={{ color: '#a8a29e' }}>{task.customer_name}</p>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: ps.bg, color: ps.color }}
                  >
                    {task.priority}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '22px 26px',
            boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
          }}
        >
          <p className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>לקוחות חדשים לפי חודש</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyDeals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f4f2" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(v) => [`${v} לקוחות`, 'כמות']}
                contentStyle={{ borderRadius: 10, border: '1px solid #e7e5e4', fontSize: 12 }}
              />
              <Bar dataKey="deals" fill="#059669" radius={[6, 6, 0, 0]} animationDuration={750} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '22px 26px',
            boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
          }}
        >
          <p className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>לקוחות לפי מקור</p>
          {sourceData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-[13px]" style={{ color: '#a8a29e' }}>
              אין נתונים עדיין
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#e7e5e4' }}
                  animationDuration={750}
                >
                  {sourceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${v} לקוחות`, 'כמות']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e7e5e4', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
