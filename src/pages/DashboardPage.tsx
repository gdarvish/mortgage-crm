import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, TrendingUp, UserPlus, DollarSign, Bell, CheckSquare,
  Clock, AlertTriangle, Loader2,
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

const COLORS = ['#1a4f8a', '#2563a8', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6']
const statusOrder = ['ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']
const hebrewMonths = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

function getAlertColor(days: number) {
  if (days < 60) return { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' }
  if (days < 120) return { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' }
  return { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700' }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'דחופה': return 'bg-red-100 text-red-700'
    case 'גבוהה': return 'bg-orange-100 text-orange-700'
    case 'בינונית': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

interface DashboardAlert extends Alert {
  customer_name?: string
  track_type?: string
}

interface DashboardTask extends Task {
  customer_name?: string
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [commissionTotal, setCommissionTotal] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const uid = auth.currentUser?.uid
    if (!uid) {
      setLoading(false)
      return
    }

    const [customersSnap, tasksSnap, alertsSnap, commissionsSnap] = await Promise.all([
      getDocs(query(collection(db, 'customers'), where('user_id', '==', uid), orderBy('created_at', 'desc'))),
      getDocs(query(
        collection(db, 'tasks'),
        where('user_id', '==', uid),
        where('status', '!=', 'הושלמה'),
        orderBy('due_date', 'asc'),
        limit(10)
      )),
      getDocs(query(
        collection(db, 'alerts'),
        where('user_id', '==', uid),
        where('status', '==', 'פתוח'),
        orderBy('days_until_end', 'asc'),
        limit(10)
      )),
      getDocs(query(collection(db, 'commissions'), where('user_id', '==', uid), where('status', '==', 'שולם'))),
    ])

    const customersData = fromDocs<Customer>(customersSnap.docs)
    setCustomers(customersData)

    const tasksData = fromDocs<Task>(tasksSnap.docs)
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

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleTask = async (id: string) => {
    try {
      await updateDoc(doc(db, 'tasks', id), { status: 'הושלמה' })
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      console.error('toggleTask failed', e)
    }
  }

  // Compute summary data from real customers
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const activeCustomers = customers.length
  const dealsThisMonth = customers.filter(c => c.status === 'סגירה' && c.created_at >= thisMonthStart).length
  const newLeads = customers.filter(c => c.status === 'ליד' && c.created_at >= thisMonthStart).length

  const summaryCards = [
    { label: 'לקוחות פעילים', value: activeCustomers, icon: Users, color: '#1a4f8a' },
    { label: 'עסקאות החודש', value: dealsThisMonth, icon: TrendingUp, color: '#22c55e' },
    { label: 'לידים חדשים', value: newLeads, icon: UserPlus, color: '#f59e0b' },
    { label: 'עמלות ששולמו', value: commissionTotal, icon: DollarSign, color: '#8b5cf6', isCurrency: true },
  ]

  // Pipeline from real data
  const pipelineStages = statusOrder.map(status => ({
    name: status,
    customers: customers
      .filter(c => c.status === status)
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        days: Math.max(0, Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))),
      })),
  }))

  // Source pie chart
  const sourceCounts: Record<string, number> = {}
  customers.forEach(c => {
    const source = c.lead_source || 'אחר'
    sourceCounts[source] = (sourceCounts[source] || 0) + 1
  })
  const sourceData = Object.entries(sourceCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Monthly chart — last 12 months
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
        <Loader2 size={32} className="text-[#1a4f8a] animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4" style={{ borderRight: `4px solid ${card.color}` }}>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.color + '15' }}>
              <card.icon size={24} style={{ color: card.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 font-[var(--font-heebo)]">
                {card.isCurrency ? formatCurrency(card.value) : card.value}
              </p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts + Tasks Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Bell size={18} className="text-[#1a4f8a]" />
            <h2 className="font-semibold text-gray-900">התראות מסלולים</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">אין התראות פתוחות</div>
            ) : alerts.map((alert) => {
              const colors = getAlertColor(alert.days_until_end || 999)
              return (
                <div
                  key={alert.id}
                  onClick={() => navigate(`/customers/${alert.customer_id}`)}
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${colors.bg}`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className={colors.text} />
                    <div>
                      <p className="font-medium text-gray-900">{alert.customer_name}</p>
                      <p className="text-sm text-gray-500">מסלול: {alert.track_type}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.badge}`}>
                    {alert.days_until_end} ימים
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <CheckSquare size={18} className="text-[#1a4f8a]" />
            <h2 className="font-semibold text-gray-900">משימות פתוחות</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">אין משימות פתוחות</div>
            ) : tasks.map((task) => (
              <div key={task.id} className="p-4 flex items-center gap-3">
                <button
                  onClick={() => toggleTask(task.id)}
                  className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors border-gray-300 hover:border-[#1a4f8a]"
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{task.title}</p>
                  {task.customer_name && (
                    <p className="text-xs text-gray-400">{task.customer_name}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Clock size={18} className="text-[#1a4f8a]" />
          <h2 className="font-semibold text-gray-900">פייפליין לקוחות</h2>
        </div>
        <div className="p-4 overflow-x-auto">
          <div className="flex gap-4 min-w-[900px]">
            {pipelineStages.map((stage) => (
              <div key={stage.name} className="flex-1 min-w-[150px]">
                <div className="text-center mb-3">
                  <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                    {stage.name} ({stage.customers.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {stage.customers.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <p className="font-medium text-sm text-gray-900">{customer.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{customer.days} ימים בשלב</p>
                    </div>
                  ))}
                  {stage.customers.length === 0 && (
                    <p className="text-center text-xs text-gray-300 py-4">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-4">לקוחות חדשים לפי חודש</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyDeals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v} לקוחות`, 'כמות']} />
              <Bar dataKey="deals" fill="#1a4f8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-4">לקוחות לפי מקור</h2>
          {sourceData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">אין נתונים עדיין</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {sourceData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} לקוחות`, 'כמות']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
