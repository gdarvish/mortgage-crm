import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, TrendingUp, UserPlus, DollarSign, Bell, AlertTriangle,
  Loader2, Plus, CheckSquare, Check, type LucideIcon,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'
import { useCountUp, useMounted } from '@/hooks/useCountUp'
import {
  useDashboardData, useCompleteTask,
  type DashboardData, type DashboardTask, type DashboardAlert,
} from '@/hooks/queries/useDashboard'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import type { Customer } from '@/types/database'

const statusOrder = ['ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה'] as const
const hebrewMonths = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const hebrewMonthsLong = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

const PIPELINE_COLORS: Record<string, string> = {
  'ליד': '#6366f1',
  'פגישה': '#f59e0b',
  'מסמכים': '#f97316',
  'הגשה': '#8b5cf6',
  'אישור': '#10b981',
  'סגירה': '#059669',
}

const SOURCE_PALETTE = ['#059669', '#d97706', '#8b5cf6', '#2563eb', '#dc2626', '#0ea5e9']

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
interface KpiSpec {
  label: string
  rawValue: number
  format: 'number' | 'currency'
  sub: string
  iconName: LucideIcon
  iconColor: string
}

function KPICard({ label, rawValue, format, sub, iconName: Icon, iconColor, index }: KpiSpec & { index: number }) {
  const t = useTheme()
  const count = useCountUp(rawValue, 1100, index * 90)
  const [hov, setHov] = useState(false)

  const display = format === 'currency' ? formatCurrency(count) : String(count)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: t.cardBg,
        borderRadius: 20,
        padding: '24px 26px',
        boxShadow: hov ? t.shadowHover : t.shadow,
        border: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        animation: 'fadeUp 0.5s ease backwards',
        animationDelay: `${index * 0.08}s`,
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 12, color: t.textMuted, fontWeight: 500, marginBottom: 8, letterSpacing: '0.03em' }}>{label}</p>
          <p style={{ fontSize: 30, fontWeight: 800, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{display}</p>
        </div>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: iconColor + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease',
            transform: hov ? 'scale(1.12) rotate(-6deg)' : 'scale(1)',
          }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>
      </div>
      {sub && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>{sub}</span>
        </div>
      )}
    </div>
  )
}

// ─── PIPELINE BAR ─────────────────────────────────────────────────────────────
function PipelineBar({ customers }: { customers: Customer[] }) {
  const t = useTheme()
  const navigate = useNavigate()
  const mounted = useMounted(250)
  const [hovIdx, setHovIdx] = useState<number | null>(null)

  const pipeline = statusOrder.map((status) => ({
    status,
    count: customers.filter((c) => c.status === status).length,
    color: PIPELINE_COLORS[status],
  }))
  const total = pipeline.reduce((s, p) => s + p.count, 0)

  return (
    <div
      style={{
        background: t.cardBg,
        borderRadius: 20,
        padding: '22px 26px',
        boxShadow: t.shadow,
        border: `1px solid ${t.border}`,
        animation: 'fadeUp 0.5s ease 0.32s backwards',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>פייפליין לקוחות</h3>
        <span style={{ fontSize: 12, color: t.textMuted }}>{total} סה"כ</span>
      </div>

      {/* Animated segmented bar */}
      <div style={{ display: 'flex', gap: 3, height: 10, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        {pipeline.map((p, i) => (
          <div key={p.status} style={{ flex: p.count || 0.0001, overflow: 'hidden', borderRadius: 4 }}>
            <div
              style={{
                width: mounted ? '100%' : '0%',
                height: '100%',
                background: p.color,
                opacity: hovIdx === null ? 0.8 : hovIdx === i ? 1 : 0.35,
                transition: `width 0.8s cubic-bezier(0.25,1,0.5,1) ${i * 0.07 + 0.05}s, opacity 0.2s ease`,
                borderRadius: 4,
              }}
            />
          </div>
        ))}
      </div>

      {/* Stage pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {pipeline.map((p, i) => (
          <div
            key={p.status}
            onClick={() => navigate('/customers')}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: t.bg,
              borderRadius: 10,
              border: `1px solid ${hovIdx === i ? p.color + '60' : t.border}`,
              cursor: 'pointer',
              flex: '1 1 auto',
              transform: hovIdx === i ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'transform 0.18s ease, border-color 0.15s ease, box-shadow 0.18s ease',
              boxShadow: hovIdx === i ? `0 4px 14px ${p.color}30` : 'none',
              animation: `fadeUp 0.4s ease ${i * 0.06 + 0.35}s backwards`,
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
                transform: hovIdx === i ? 'scale(1.4)' : 'scale(1)',
                transition: 'transform 0.18s ease',
              }}
            />
            <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{p.status}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: p.color, marginRight: 'auto' }}>{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ALERTS PANEL ─────────────────────────────────────────────────────────────
function AlertRow({ alert, index }: { alert: DashboardAlert; index: number }) {
  const t = useTheme()
  const navigate = useNavigate()
  const [hov, setHov] = useState(false)

  const days = alert.days_until_end ?? 999
  const urgent = days < 60
  const warn = days < 120
  const col = urgent ? t.danger : warn ? t.accent : t.success
  const bg = urgent ? t.dangerBg : warn ? t.accentBg : t.successBg

  return (
    <div
      onClick={() => navigate(`/customers/${alert.customer_id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '14px 22px',
        borderBottom: `1px solid ${t.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        background: hov ? t.bg : 'transparent',
        transform: hov ? 'translateX(4px)' : 'translateX(0)',
        transition: 'background 0.15s ease, transform 0.18s ease',
        animation: `slideInRight 0.4s ease ${index * 0.09 + 0.55}s backwards`,
      }}
    >
      <div
        className={urgent ? 'crm-urgent' : ''}
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={17} style={{ color: col }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{alert.customer_name}</p>
        <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>מסלול {alert.track_type}</p>
      </div>
      <span
        style={{
          padding: '4px 12px',
          borderRadius: 20,
          background: bg,
          color: col,
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          transition: 'transform 0.15s ease',
          transform: hov ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {days} ימים
      </span>
    </div>
  )
}

function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const t = useTheme()
  return (
    <div
      style={{
        background: t.cardBg,
        borderRadius: 20,
        boxShadow: t.shadow,
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
        animation: 'fadeUp 0.5s ease 0.42s backwards',
      }}
    >
      <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: t.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={15} style={{ color: t.accent }} />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>התראות מסלולים</h3>
        <span
          style={{
            marginRight: 'auto',
            background: t.danger,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 20,
            animation: 'scaleIn 0.4s ease 0.7s backwards',
          }}
        >
          {alerts.length}
        </span>
      </div>
      {alerts.length === 0 ? (
        <div style={{ padding: '40px 22px', textAlign: 'center', fontSize: 13, color: t.textMuted }}>אין התראות פתוחות</div>
      ) : (
        alerts.map((a, i) => <AlertRow key={a.id} alert={a} index={i} />)
      )}
    </div>
  )
}

// ─── TASKS PANEL ──────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  'דחופה': { bg: '#fee2e2', text: '#dc2626' },
  'גבוהה': { bg: '#ffedd5', text: '#ea580c' },
  'בינונית': { bg: '#dbeafe', text: '#1d4ed8' },
  'נמוכה': { bg: '#f1f5f9', text: '#64748b' },
}

function TaskRow({
  task, index, checked, justChecked, onToggle,
}: {
  task: DashboardTask
  index: number
  checked: boolean
  justChecked: boolean
  onToggle: (id: string) => void
}) {
  const t = useTheme()
  const [hov, setHov] = useState(false)
  const pc = PRIORITY_COLORS[task.priority] ?? { bg: '#f1f5f9', text: '#64748b' }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '13px 22px',
        borderBottom: `1px solid ${t.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: checked ? 0.4 : 1,
        background: hov && !checked ? t.bg : 'transparent',
        transition: 'opacity 0.3s ease, background 0.15s ease',
        animation: `slideInRight 0.4s ease ${index * 0.07 + 0.62}s backwards`,
      }}
    >
      <button
        onClick={() => onToggle(task.id)}
        aria-label="סמן כהושלם"
        style={{
          width: 21,
          height: 21,
          borderRadius: 6,
          border: `2px solid ${checked ? t.primary : hov ? t.primary + '80' : t.border}`,
          background: checked ? t.primary : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.15s ease',
          transform: hov && !checked ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        {checked && (
          <span className={justChecked ? 'crm-check-bounce' : ''} style={{ display: 'flex' }}>
            <Check size={11} strokeWidth={3} style={{ color: '#fff' }} />
          </span>
        )}
      </button>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: t.text,
            textDecoration: checked ? 'line-through' : 'none',
            transition: 'text-decoration 0.15s',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {task.title}
        </p>
        {task.customer_name && (
          <p style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{task.customer_name}</p>
        )}
      </div>
      <span
        style={{
          padding: '3px 10px',
          borderRadius: 20,
          background: pc.bg,
          color: pc.text,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {task.priority}
      </span>
    </div>
  )
}

function TasksPanel({
  tasks, checkedTasks, justChecked, onToggle,
}: {
  tasks: DashboardTask[]
  checkedTasks: Set<string>
  justChecked: string | null
  onToggle: (id: string) => void
}) {
  const t = useTheme()
  const open = tasks.filter((tk) => !checkedTasks.has(tk.id)).length

  return (
    <div
      style={{
        background: t.cardBg,
        borderRadius: 20,
        boxShadow: t.shadow,
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
        animation: 'fadeUp 0.5s ease 0.48s backwards',
      }}
    >
      <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: t.primary + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckSquare size={15} style={{ color: t.primary }} />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>משימות פתוחות</h3>
        <span
          style={{
            marginRight: 'auto',
            background: t.primary,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 20,
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            display: 'inline-block',
            transform: `scale(${justChecked ? 0.7 : 1})`,
          }}
        >
          {open}
        </span>
      </div>
      {tasks.length === 0 ? (
        <div style={{ padding: '40px 22px', textAlign: 'center', fontSize: 13, color: t.textMuted }}>אין משימות פתוחות</div>
      ) : (
        tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            index={i}
            checked={checkedTasks.has(task.id)}
            justChecked={justChecked === task.id}
            onToggle={onToggle}
          />
        ))
      )}
    </div>
  )
}

// ─── MINI BAR CHART ───────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { month: string; deals: number }[] }) {
  const t = useTheme()
  const mounted = useMounted(350)
  const [hovIdx, setHovIdx] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.deals))

  return (
    <div
      style={{
        background: t.cardBg,
        borderRadius: 20,
        padding: '22px 26px',
        boxShadow: t.shadow,
        border: `1px solid ${t.border}`,
        animation: 'fadeUp 0.5s ease 0.56s backwards',
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 22 }}>לקוחות חדשים לפי חודש</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
        {data.map((d, i) => {
          const isHov = hovIdx === i
          const isLast = i === data.length - 1
          const pct = (d.deals / max) * 100
          return (
            <div
              key={i}
              onMouseEnter={() => setHovIdx(i)}
              onMouseLeave={() => setHovIdx(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                height: '100%',
                justifyContent: 'flex-end',
                cursor: 'default',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isHov ? t.primary : t.textMuted,
                  opacity: mounted ? 1 : 0,
                  transform: isHov ? 'translateY(-2px)' : 'translateY(0)',
                  transition: `opacity 0.4s ease ${i * 0.05 + 0.4}s, transform 0.18s ease, color 0.18s ease`,
                }}
              >
                {d.deals}
              </span>
              <div
                style={{
                  width: '100%',
                  borderRadius: '7px 7px 0 0',
                  height: mounted ? `${pct}%` : '0%',
                  background: isLast || isHov ? t.primary : `linear-gradient(180deg, ${t.primary}70, ${t.primary}35)`,
                  minHeight: 4,
                  transform: isHov ? 'scaleX(1.12)' : 'scaleX(1)',
                  transformOrigin: 'bottom',
                  transition: `height 0.75s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.06 + 0.3}s, background 0.2s ease, transform 0.2s ease`,
                  boxShadow: isHov ? `0 0 14px ${t.primary}50` : 'none',
                }}
              />
              <span style={{ fontSize: 11, color: isHov ? t.primary : t.textMuted, transition: 'color 0.18s ease' }}>{d.month}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── SOURCE CHART ─────────────────────────────────────────────────────────────
function SourceChart({ sources }: { sources: { name: string; pct: number; color: string }[] }) {
  const t = useTheme()
  const mounted = useMounted(420)
  const [hovIdx, setHovIdx] = useState<number | null>(null)

  return (
    <div
      style={{
        background: t.cardBg,
        borderRadius: 20,
        padding: '22px 26px',
        boxShadow: t.shadow,
        border: `1px solid ${t.border}`,
        animation: 'fadeUp 0.5s ease 0.62s backwards',
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 22 }}>מקורות לידים</h3>
      {sources.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: t.textMuted }}>אין נתונים עדיין</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sources.map((s, i) => {
            const isHov = hovIdx === i
            return (
              <div key={s.name} onMouseEnter={() => setHovIdx(i)} onMouseLeave={() => setHovIdx(null)} style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: isHov ? t.text : t.textSub, fontWeight: isHov ? 600 : 500, transition: 'all 0.18s' }}>{s.name}</span>
                  <span style={{ fontSize: 13, color: isHov ? s.color : t.textMuted, fontWeight: 700, transition: 'color 0.18s' }}>{s.pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: t.border, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: mounted ? `${s.pct}%` : '0%',
                      background: s.color,
                      borderRadius: 4,
                      opacity: isHov ? 1 : 0.75,
                      transform: isHov ? 'scaleY(1.3)' : 'scaleY(1)',
                      transformOrigin: 'center',
                      transition: `width 0.85s cubic-bezier(0.25,1,0.5,1) ${i * 0.1 + 0.3}s, opacity 0.18s ease, transform 0.18s ease`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const t = useTheme()
  const navigate = useNavigate()
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set())
  const [justChecked, setJustChecked] = useState<string | null>(null)

  const { data, isLoading: loading } = useDashboardData()
  const completeTask = useCompleteTask()

  const empty: DashboardData = {
    advisorName: '', customers: [], tasks: [], alerts: [], commissionTotal: 0,
  }
  const { advisorName, customers, tasks, alerts, commissionTotal } = data ?? empty

  const toggleTask = (id: string) => {
    setCheckedTasks((prev) => new Set(prev).add(id))
    setJustChecked(id)
    setTimeout(() => setJustChecked(null), 400)
    setTimeout(() => {
      completeTask.mutate(id, {
        onSettled: () => {
          setCheckedTasks((prev) => {
            const s = new Set(prev)
            s.delete(id)
            return s
          })
        },
      })
    }, 380)
  }

  const now = new Date()
  const todayStr = `${hebrewDays[now.getDay()]}, ${now.getDate()} ב${hebrewMonthsLong[now.getMonth()]} ${now.getFullYear()}`
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // KPIs — all from real data
  const activeCustomers = customers.length
  const dealsThisMonth = customers.filter((c) => c.status === 'סגירה' && c.created_at >= thisMonthStart).length
  const newLeads = customers.filter((c) => c.status === 'ליד' && c.created_at >= thisMonthStart).length
  const inApproval = customers.filter((c) => c.status === 'אישור').length
  const urgentTasks = tasks.filter((tk) => tk.priority === 'דחופה').length

  const kpis: KpiSpec[] = [
    { label: 'לקוחות פעילים', rawValue: activeCustomers, format: 'number', sub: `${inApproval} בהליך אישור`, iconName: Users, iconColor: t.primary },
    { label: 'עסקאות החודש', rawValue: dealsThisMonth, format: 'number', sub: 'נסגרו החודש', iconName: TrendingUp, iconColor: '#10b981' },
    { label: 'לידים חדשים', rawValue: newLeads, format: 'number', sub: 'נוספו החודש', iconName: UserPlus, iconColor: t.accent },
    { label: 'עמלות ששולמו', rawValue: commissionTotal, format: 'currency', sub: 'מצטבר', iconName: DollarSign, iconColor: '#8b5cf6' },
  ]

  // Monthly chart — last 12 months of new customers
  const monthlyData: { month: string; deals: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const count = customers.filter((c) => {
      const cd = new Date(c.created_at)
      return cd >= d && cd <= monthEnd
    }).length
    monthlyData.push({ month: hebrewMonths[d.getMonth()], deals: count })
  }

  // Lead source distribution
  const sourceCounts: Record<string, number> = {}
  customers.forEach((c) => {
    const source = c.lead_source || 'אחר'
    sourceCounts[source] = (sourceCounts[source] || 0) + 1
  })
  const sourceTotal = Object.values(sourceCounts).reduce((s, v) => s + v, 0) || 1
  const sources = Object.entries(sourceCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ name: s.name, pct: Math.round((s.value / sourceTotal) * 100), color: SOURCE_PALETTE[i % SOURCE_PALETTE.length] }))

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
        <Loader2 size={32} className="animate-spin" style={{ color: t.primary }} />
      </div>
    )
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        {/* Greeting */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 28,
            animation: 'fadeUp 0.4s ease backwards',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: t.text, marginBottom: 5 }}>
              שלום, {advisorName || 'יועץ משכנתאות'} 👋
            </h1>
            <p style={{ fontSize: 14, color: t.textMuted }}>
              {todayStr} · {urgentTasks > 0 ? `${urgentTasks} משימות דחופות ממתינות` : `${tasks.length} משימות פתוחות`}
            </p>
          </div>
          <button
            onClick={() => navigate('/customers')}
            className="crm-btn-primary"
            style={{
              background: t.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '11px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: `0 4px 16px ${t.primary}45`,
              animation: 'fadeIn 0.5s ease 0.1s backwards',
              flexShrink: 0,
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            לקוח חדש
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 18, marginBottom: 22 }}>
          {kpis.map((k, i) => (
            <KPICard key={k.label} {...k} index={i} />
          ))}
        </div>

        {/* Pipeline */}
        <div style={{ marginBottom: 22 }}>
          <PipelineBar customers={customers} />
        </div>

        {/* Alerts + Tasks */}
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 18, marginBottom: 22 }}>
          <AlertsPanel alerts={alerts} />
          <TasksPanel tasks={tasks} checkedTasks={checkedTasks} justChecked={justChecked} onToggle={toggleTask} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]" style={{ gap: 18, marginBottom: 22 }}>
          <MiniBarChart data={monthlyData} />
          <SourceChart sources={sources} />
        </div>

        {/* Recent activity — real data, no design equivalent */}
        <ActivityFeed />
      </div>
    </div>
  )
}
