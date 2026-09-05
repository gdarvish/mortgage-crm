import { useState } from 'react'
import { DollarSign, TrendingUp, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCommissions } from '@/hooks/queries/useCommissions'
import { useChartTheme } from '@/theme/chartTheme'

const hebrewMonths = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

type CommissionRow = {
  id: string
  customerName: string
  loanAmount: number
  amount: number
  status: string
  paymentDate: string | null
  createdAt: string
}

export default function CommissionsPage() {
  const chart = useChartTheme()
  const [statusFilter, setStatusFilter] = useState('הכל')

  const { data: rawCommissions = [], isLoading: loading } = useCommissions()

  const commissions: CommissionRow[] = rawCommissions.map(c => ({
    id: c.id,
    customerName: c.customer
      ? `${c.customer.first_name} ${c.customer.last_name}`
      : 'לא ידוע',
    loanAmount: c.mortgage?.loan_amount ?? 0,
    amount: c.amount ?? 0,
    status: c.status ?? 'ממתין',
    paymentDate: c.payment_date ?? null,
    createdAt: c.created_at ?? '',
  }))

  const filtered = commissions.filter(c => statusFilter === 'הכל' || c.status === statusFilter)
  const totalPaid    = commissions.filter(c => c.status === 'שולם').reduce((s, c) => s + c.amount, 0)
  const totalPending = commissions.filter(c => c.status === 'ממתין').reduce((s, c) => s + c.amount, 0)

  // Monthly bar chart — last 6 months
  const now = new Date()
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const amount = commissions
      .filter(c => c.status === 'שולם' && c.paymentDate && new Date(c.paymentDate) >= d && new Date(c.paymentDate) <= monthEnd)
      .reduce((s, c) => s + c.amount, 0)
    return { month: hebrewMonths[d.getMonth()], amount }
  })

  const cardStyle = {
    background: 'var(--color-card)',
    borderRadius: 20,
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
    padding: '22px 24px',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: 'var(--color-primary)' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="crm-page animate-fade-in space-y-5">
      <div>
        <h1 className="font-black" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>עמלות</h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{commissions.length} עמלות במערכת</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'שולם',    value: totalPaid,              icon: CheckCircle, color: '#059669' },
          { label: 'ממתין',   value: totalPending,           icon: Clock,       color: '#d97706' },
          { label: 'סה"כ',    value: totalPaid + totalPending, icon: TrendingUp, color: '#059669' },
        ].map((card) => (
          <div key={card.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: card.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <card.icon size={20} style={{ color: card.color }} />
            </div>
            <div>
              <p className="font-black tabular-nums" style={{ fontSize: 22, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>{formatCurrency(card.value)}</p>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart */}
        <div style={cardStyle}>
          <p className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>הכנסות לפי חודש</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid {...chart.grid} />
              <XAxis dataKey="month" tick={chart.tick(11)} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} tick={chart.tick(11)} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={chart.tooltip} />
              <Bar dataKey="amount" fill={chart.series} radius={[6, 6, 0, 0]} animationDuration={750} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* List */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
            <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>רשימת עמלות</h2>
            <div className="flex gap-1 mr-auto">
              {['הכל', 'שולם', 'ממתין'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1 text-[12px] font-semibold transition-all"
                  style={{
                    borderRadius: 20,
                    background: statusFilter === s ? 'var(--color-primary)' : 'var(--color-border-light)',
                    color: statusFilter === s ? 'var(--color-primary-text)' : 'var(--color-text-sub)',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: 'var(--color-text-muted)' }}>אין עמלות</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
              {filtered.map(c => (
                <div key={c.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{c.customerName}</p>
                    {c.loanAmount > 0 && <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>הלוואה: {formatCurrency(c.loanAmount)}</p>}
                  </div>
                  <div className="text-left flex flex-col items-end gap-1">
                    <p className="font-black tabular-nums text-[15px]" style={{ color: 'var(--color-primary)' }}>{formatCurrency(c.amount)}</p>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: c.status === 'שולם' ? 'var(--color-success-bg)' : 'var(--color-accent-bg)',
                        color: c.status === 'שולם' ? '#065f46' : '#b45309',
                      }}
                    >{c.status}</span>
                    {c.paymentDate && <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{formatDate(c.paymentDate)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
