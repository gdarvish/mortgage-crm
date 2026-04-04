import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, TrendingUp, UserPlus, DollarSign, Bell, CheckSquare, Clock, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#1a4f8a', '#2563a8', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6']

// Mock data
const summaryCards = [
  { label: 'לקוחות פעילים', value: 47, icon: Users, color: '#1a4f8a' },
  { label: 'עסקאות החודש', value: 5, icon: TrendingUp, color: '#22c55e' },
  { label: 'לידים חדשים', value: 12, icon: UserPlus, color: '#f59e0b' },
  { label: 'הכנסה חודשית', value: 34500, icon: DollarSign, color: '#8b5cf6', isCurrency: true },
]

const mockAlerts = [
  { id: '1', customerName: 'יוסי כהן', trackType: 'פריים', daysLeft: 32, customerId: '1' },
  { id: '2', customerName: 'שרה לוי', trackType: 'קל"צ', daysLeft: 78, customerId: '2' },
  { id: '3', customerName: 'דוד אברהם', trackType: 'משתנה צמודה', daysLeft: 145, customerId: '3' },
  { id: '4', customerName: 'רחל מזרחי', trackType: 'קל"ב', daysLeft: 55, customerId: '4' },
]

const mockTasks = [
  { id: '1', title: 'להתקשר ליוסי כהן - מסמכים חסרים', priority: 'גבוהה', customerName: 'יוסי כהן', done: false },
  { id: '2', title: 'לשלוח הצעת תמהיל לשרה לוי', priority: 'בינונית', customerName: 'שרה לוי', done: false },
  { id: '3', title: 'פגישה עם דוד אברהם - 14:00', priority: 'דחופה', customerName: 'דוד אברהם', done: false },
  { id: '4', title: 'להגיש תיק לבנק לאומי - רחל מזרחי', priority: 'גבוהה', customerName: 'רחל מזרחי', done: true },
]

const pipelineStages = [
  { name: 'ליד', customers: [
    { name: 'מוטי פרץ', amount: 1200000, days: 3 },
    { name: 'אסתר גולד', amount: 800000, days: 1 },
  ]},
  { name: 'פגישה', customers: [
    { name: 'יעקב שמעון', amount: 1500000, days: 5 },
  ]},
  { name: 'מסמכים', customers: [
    { name: 'יוסי כהן', amount: 900000, days: 12 },
    { name: 'נועה ברק', amount: 1100000, days: 7 },
  ]},
  { name: 'הגשה', customers: [
    { name: 'שרה לוי', amount: 1300000, days: 4 },
  ]},
  { name: 'אישור', customers: [
    { name: 'רחל מזרחי', amount: 750000, days: 2 },
  ]},
  { name: 'סגירה', customers: [
    { name: 'דוד אברהם', amount: 1800000, days: 1 },
  ]},
]

const monthlyDeals = [
  { month: 'ינו', deals: 3 }, { month: 'פבר', deals: 5 }, { month: 'מרץ', deals: 4 },
  { month: 'אפר', deals: 7 }, { month: 'מאי', deals: 6 }, { month: 'יונ', deals: 4 },
  { month: 'יול', deals: 8 }, { month: 'אוג', deals: 3 }, { month: 'ספט', deals: 6 },
  { month: 'אוק', deals: 5 }, { month: 'נוב', deals: 7 }, { month: 'דצמ', deals: 5 },
]

const sourceData = [
  { name: 'הפניה', value: 35 }, { name: 'פייסבוק', value: 20 },
  { name: 'אתר', value: 15 }, { name: 'וואטסאפ', value: 12 },
  { name: 'טלפון', value: 10 }, { name: 'אחר', value: 8 },
]

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

export default function DashboardPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState(mockTasks)

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
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
            {mockAlerts.map((alert) => {
              const colors = getAlertColor(alert.daysLeft)
              return (
                <div
                  key={alert.id}
                  onClick={() => navigate(`/customers/${alert.customerId}`)}
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${colors.bg}`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className={colors.text} />
                    <div>
                      <p className="font-medium text-gray-900">{alert.customerName}</p>
                      <p className="text-sm text-gray-500">מסלול: {alert.trackType}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.badge}`}>
                    {alert.daysLeft} ימים
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <CheckSquare size={18} className="text-[#1a4f8a]" />
            <h2 className="font-semibold text-gray-900">משימות להיום</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 flex items-center gap-3">
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    task.done ? 'bg-[#1a4f8a] border-[#1a4f8a]' : 'border-gray-300 hover:border-[#1a4f8a]'
                  }`}
                >
                  {task.done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  <p className={`text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
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
            {pipelineStages.map((stage, idx) => (
              <div key={stage.name} className="flex-1 min-w-[150px]">
                <div className="text-center mb-3">
                  <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                    {stage.name} ({stage.customers.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {stage.customers.map((customer, cIdx) => (
                    <div
                      key={cIdx}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <p className="font-medium text-sm text-gray-900">{customer.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatCurrency(customer.amount)}</p>
                      <p className="text-xs text-gray-400 mt-1">{customer.days} ימים בשלב</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Deals Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-4">עסקאות לפי חודש</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyDeals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value} עסקאות`, 'כמות']} />
              <Bar dataKey="deals" fill="#1a4f8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-4">לקוחות לפי מקור</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {sourceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} לקוחות`, 'כמות']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
