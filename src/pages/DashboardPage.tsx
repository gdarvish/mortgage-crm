import { useState } from 'react'
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
import { useCountUp } from '@/hooks/useCountUp'
import { useDashboardData, useCompleteTask, PIPELINE_STATUSES } from '@/hooks/queries/useDashboard'
import TodayMeetingsWidget from '@/components/TodayMeetingsWidget'
import RefinanceOpportunitiesWidget from '@/components/RefinanceOpportunitiesWidget'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

const statusOrder = PIPELINE_STATUSES
const hebrewMonths = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const PIPELINE_COLORS: Record<string, string> = {
  'ליד': '#6366f1',
  'פגישה': '#f59e0b',
  'מסמכים': '#f97316',
  'הגשה': '#8b5cf6',
  'אישור': '#10b981',
  'ביצוע': '#14b8a6',
  'סגירה': '#059669',
}

const SOURCE_COLORS = ['#059669', '#2563eb', '#d97706', '#8b5cf6', '#dc2626', '#10b981']

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
      className="crm-card crm-card-lift animate-fade-up"
      style={{
        animationDelay: `${index * 80}ms`,
        padding: '24px 26px',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-sub)' }}>{label}</p>
          <p className="text-[28px] font-black leading-none tabular-nums" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>
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
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set())

  const { data, isLoading: loading } = useDashboardData()
  const completeTask = useCompleteTask()

  const advisorName = data?.advisorName ?? ''
  const customers = data?.customers ?? []
  const customersTruncated = data?.customersTruncated ?? false
  const totals = data?.totals
  const tasks = data?.tasks ?? []
  const alerts = data?.alerts ?? []
  const commissionTotal = data?.commissionTotal ?? 0

  const toggleTask = (id: string) => {
    setCheckedTasks(prev => new Set(prev).add(id))
    setTimeout(() => {
      completeTask.mutate(id, {
        onSettled: () => {
          setCheckedTasks(prev => { const s = new Set(prev); s.delete(id); return s })
        },
      })
    }, 380)
  }

  const now = new Date()
  const todayStr = `${hebrewDays[now.getDay()]}, ${now.getDate()} ב${['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][now.getMonth()]} ${now.getFullYear()}`

  // Counted server-side, so these stay exact however large the book grows —
  // only the charts below read documents, and they are capped.
  const activeCustomers = totals?.customers ?? 0
  const dealsThisMonth = totals?.dealsThisMonth ?? 0
  const newLeads = totals?.newLeadsThisMonth ?? 0

  const kpiCards = [
    { label: 'לקוחות פעילים', value: activeCustomers, icon: Users,      color: '#059669', trend: '+12%' },
    { label: 'עסקאות החודש',  value: dealsThisMonth,  icon: TrendingUp, color: '#10b981', trend: '+50%' },
    { label: 'לידים חדשים',   value: newLeads,         icon: UserPlus,  color: '#d97706', trend: '+8%' },
    { label: 'עמלות ששולמו',  value: commissionTotal, icon: DollarSign, color: '#8b5cf6', trend: '+22%', isCurrency: true },
  ]

  // Pipeline
  const pipelineCounts = statusOrder.map(s => ({
    status: s,
    count: totals?.pipeline[s] ?? 0,
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
        <Loader2 size={32} style={{ color: 'var(--color-primary)' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="crm-page animate-fade-in space-y-6">
      {/* Greeting header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 26, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>
            שלום, {advisorName || 'יועץ משכנתאות'}
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--color-text-muted)' }}>
            {todayStr} &nbsp;·&nbsp; {tasks.length} משימות פתוחות
          </p>
        </div>
        <button
          onClick={() => navigate('/customers')}
          className="crm-btn-primary flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.96] shrink-0"
          style={{
            borderRadius: 12,
            background: 'var(--color-primary)',
            boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 27%, transparent)',
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

      <RefinanceOpportunitiesWidget />

      <TodayMeetingsWidget />

      {/* Pipeline Bar */}
      <div
        style={{
          background: 'var(--color-card)',
          borderRadius: 20,
          padding: '22px 26px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <p className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>פייפליין לקוחות</p>
        <div className="flex gap-[3px] w-full overflow-hidden" style={{ height: 10, borderRadius: 8 }}>
          {pipelineCounts.map(({ status, count }) => (
            <div
              key={status}
              title={`${status}: ${count}`}
              style={{
                width: `${(count / totalPipeline) * 100}%`,
                background: PIPELINE_COLORS[status] || 'var(--color-text-muted)',
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
                border: `1.5px solid ${PIPELINE_COLORS[status] || 'var(--color-text-muted)'}`,
                color: PIPELINE_COLORS[status] || 'var(--color-text-muted)',
                background: (PIPELINE_COLORS[status] || '#a8a29e') + '10',
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 6, height: 6, background: PIPELINE_COLORS[status] || 'var(--color-text-muted)' }}
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
            background: 'var(--color-card)',
            borderRadius: 20,
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
            <Bell size={16} style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>התראות מסלולים</h2>
          </div>
          <div>
            {alerts.length === 0 ? (
              <div className="py-10 text-center text-[13px]" style={{ color: 'var(--color-text-muted)' }}>אין התראות פתוחות</div>
            ) : alerts.map((alert, i) => {
              // Live, recomputed on read — the stored days_until_end is a
              // snapshot from when the alert was created.
              const days = alert.live_days_left ?? 999
              const isUrgent = days < 60
              const isSoon = days < 120
              const color = isUrgent ? 'var(--color-danger)' : isSoon ? 'var(--color-accent)' : 'var(--color-primary)'
              const bgColor = isUrgent ? 'var(--color-danger-bg)' : isSoon ? 'var(--color-accent-bg)' : 'var(--color-success-bg)'

              return (
                <div
                  key={alert.id}
                  onClick={() => navigate(`/customers/${alert.customer_id}`)}
                  className="flex items-center justify-between px-6 py-3 cursor-pointer border-b transition-all duration-150"
                  style={{
                    borderColor: 'var(--color-border-light)',
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
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{alert.customer_name}</p>
                      <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>מסלול: {alert.track_type}</p>
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
            background: 'var(--color-card)',
            borderRadius: 20,
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
            <CheckSquare size={16} style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>משימות פתוחות</h2>
            <span
              className="mr-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-success-bg)', color: 'var(--color-primary)' }}
            >
              {tasks.length}
            </span>
          </div>
          <div>
            {tasks.length === 0 ? (
              <div className="py-10 text-center text-[13px]" style={{ color: 'var(--color-text-muted)' }}>אין משימות פתוחות</div>
            ) : tasks.map((task) => {
              const checked = checkedTasks.has(task.id)
              const priorityStyle: Record<string, { bg: string; color: string }> = {
                'דחופה': { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
                'גבוהה': { bg: '#ffedd5', color: '#ea580c' },
                'בינונית': { bg: '#dbeafe', color: '#1d4ed8' },
                'נמוכה':  { bg: '#f1f5f9', color: '#64748b' },
              }
              const ps = priorityStyle[task.priority] || { bg: '#f1f5f9', color: '#64748b' }

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-6 py-3 border-b"
                  style={{ borderColor: 'var(--color-border-light)' }}
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="shrink-0 flex items-center justify-center transition-all duration-150"
                    style={{
                      width: 21,
                      height: 21,
                      borderRadius: 6,
                      border: `2px solid ${checked ? 'var(--color-primary)' : '#d6d3d1'}`,
                      background: checked ? 'var(--color-primary)' : 'transparent',
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
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>{task.title}</p>
                    {task.customer_name && (
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{task.customer_name}</p>
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
      {customersTruncated && (
        <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
          הגרפים מחושבים על {customers.length} הלקוחות האחרונים. מספרי ה-KPI והצינור מלאים ומדויקים.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          style={{
            background: 'var(--color-card)',
            borderRadius: 20,
            padding: '22px 26px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>לקוחות חדשים לפי חודש</p>
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
            background: 'var(--color-card)',
            borderRadius: 20,
            padding: '22px 26px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>לקוחות לפי מקור</p>
          {sourceData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
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

      {/* Activity feed */}
      <ActivityFeed />
    </div>
  )
}
