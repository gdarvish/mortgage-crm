import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle, RefreshCw, User } from 'lucide-react'

const mockAlerts = [
  { id: '1', customerName: 'יוסי כהן', customerId: '1', trackType: 'פריים', daysLeft: 32, status: 'פתוח', amount: 300000, interestRate: 6.0 },
  { id: '2', customerName: 'רחל מזרחי', customerId: '4', trackType: 'קל"צ', daysLeft: 55, status: 'פתוח', amount: 400000, interestRate: 5.2 },
  { id: '3', customerName: 'שרה לוי', customerId: '2', trackType: 'משתנה צמודה', daysLeft: 78, status: 'פתוח', amount: 250000, interestRate: 3.8 },
  { id: '4', customerName: 'דוד אברהם', customerId: '3', trackType: 'קל"ב', daysLeft: 145, status: 'פתוח', amount: 500000, interestRate: 3.5 },
  { id: '5', customerName: 'נועה ברק', customerId: '8', trackType: 'פריים', daysLeft: 170, status: 'טופל', amount: 350000, interestRate: 6.2 },
]

function getUrgency(days: number) {
  if (days < 60) return { label: 'דחוף', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' }
  if (days < 120) return { label: 'אזהרה', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' }
  return { label: 'תקין', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' }
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'urgent' | 'warning' | 'normal'>('all')
  const [alerts, setAlerts] = useState(mockAlerts)

  const filtered = alerts.filter(a => {
    if (filter === 'urgent') return a.daysLeft < 60
    if (filter === 'warning') return a.daysLeft >= 60 && a.daysLeft < 120
    if (filter === 'normal') return a.daysLeft >= 120
    return true
  })

  const markHandled = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'טופל' } : a))

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Bell className="text-[#1a4f8a]" size={28} />
        התראות מסלולים
      </h1>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all' as const, label: 'הכל', count: alerts.length },
          { key: 'urgent' as const, label: 'דחוף', count: alerts.filter(a => a.daysLeft < 60).length },
          { key: 'warning' as const, label: 'אזהרה', count: alerts.filter(a => a.daysLeft >= 60 && a.daysLeft < 120).length },
          { key: 'normal' as const, label: 'תקין', count: alerts.filter(a => a.daysLeft >= 120).length },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-[#1a4f8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {filtered.map(alert => {
          const urgency = getUrgency(alert.daysLeft)
          return (
            <div key={alert.id} className={`bg-white rounded-xl shadow-sm border p-4 ${alert.status === 'טופל' ? 'opacity-60' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${urgency.dot}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{alert.customerName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${urgency.color}`}>{alert.daysLeft} ימים</span>
                      {alert.status === 'טופל' && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">טופל</span>}
                    </div>
                    <p className="text-sm text-gray-500">מסלול {alert.trackType} · ₪{alert.amount.toLocaleString()} · {alert.interestRate}%</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/customers/${alert.customerId}`)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1"><User size={12} /> תיק לקוח</button>
                  <button onClick={() => navigate('/refinance')} className="text-xs bg-[#e8f0fe] text-[#1a4f8a] px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1"><RefreshCw size={12} /> מחשבון מחזור</button>
                  <button onClick={() => markHandled(alert.id)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 flex items-center gap-1"><CheckCircle size={12} /> טופל</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle size={48} className="mx-auto text-green-300 mb-3" />
          <p className="text-gray-500">אין התראות</p>
        </div>
      )}
    </div>
  )
}
