import { useState } from 'react'
import { DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'

const mockCommissions = [
  { id: '1', customerName: 'דוד אברהם', loanAmount: 1800000, amount: 12600, status: 'שולם', paymentDate: '2026-03-15' },
  { id: '2', customerName: 'שרה לוי', loanAmount: 1300000, amount: 9100, status: 'ממתין', paymentDate: null },
  { id: '3', customerName: 'רחל מזרחי', loanAmount: 750000, amount: 5250, status: 'ממתין', paymentDate: null },
  { id: '4', customerName: 'אמיר חדד', loanAmount: 950000, amount: 6650, status: 'שולם', paymentDate: '2026-02-20' },
  { id: '5', customerName: 'יעקב שמעון', loanAmount: 1500000, amount: 10500, status: 'שולם', paymentDate: '2026-01-10' },
]

const monthlyData = [
  { month: 'ינו', amount: 10500 }, { month: 'פבר', amount: 6650 }, { month: 'מרץ', amount: 12600 },
  { month: 'אפר', amount: 0 },
]

export default function CommissionsPage() {
  const [statusFilter, setStatusFilter] = useState('הכל')

  const filtered = mockCommissions.filter(c => statusFilter === 'הכל' || c.status === statusFilter)
  const totalPaid = mockCommissions.filter(c => c.status === 'שולם').reduce((s, c) => s + c.amount, 0)
  const totalPending = mockCommissions.filter(c => c.status === 'ממתין').reduce((s, c) => s + c.amount, 0)

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <DollarSign className="text-[#1a4f8a]" size={28} />
        עמלות
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4" style={{ borderRight: '4px solid #22c55e' }}>
          <CheckCircle className="text-green-500" size={24} />
          <div><p className="text-xl font-bold text-gray-900">{formatCurrency(totalPaid)}</p><p className="text-sm text-gray-500">שולם</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4" style={{ borderRight: '4px solid #f59e0b' }}>
          <Clock className="text-yellow-500" size={24} />
          <div><p className="text-xl font-bold text-gray-900">{formatCurrency(totalPending)}</p><p className="text-sm text-gray-500">ממתין</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4" style={{ borderRight: '4px solid #1a4f8a' }}>
          <TrendingUp className="text-[#1a4f8a]" size={24} />
          <div><p className="text-xl font-bold text-gray-900">{formatCurrency(totalPaid + totalPending)}</p><p className="text-sm text-gray-500">סה"כ</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">הכנסות לפי חודש</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="amount" fill="#1a4f8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">רשימת עמלות</h2>
            <div className="flex gap-1 mr-auto">
              {['הכל', 'שולם', 'ממתין'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs rounded-lg ${statusFilter === s ? 'bg-[#1a4f8a] text-white' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {filtered.map(c => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{c.customerName}</p>
                  <p className="text-sm text-gray-500">הלוואה: {formatCurrency(c.loanAmount)}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-[#1a4f8a]">{formatCurrency(c.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'שולם' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span>
                  {c.paymentDate && <p className="text-xs text-gray-400 mt-1">{formatDate(c.paymentDate)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
