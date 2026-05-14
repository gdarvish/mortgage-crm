import { useState } from 'react'
import { PieChart as PieChartIcon, Download } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#059669', '#34d399', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

interface Expense {
  category: string
  amount: number
}

export default function FamilyEconomicsPage() {
  const [income1, setIncome1] = useState(15000)
  const [income2, setIncome2] = useState(12000)
  const [mortgagePayment, setMortgagePayment] = useState(5500)
  const [expenses, setExpenses] = useState<Expense[]>([
    { category: 'דיור (ארנונה, ועד בית)', amount: 1500 },
    { category: 'מזון', amount: 3500 },
    { category: 'רכב', amount: 2500 },
    { category: 'חינוך', amount: 3000 },
    { category: 'בילויים', amount: 1500 },
    { category: 'חסכונות', amount: 2000 },
    { category: 'אחר', amount: 1000 },
  ])

  const updateExpense = (idx: number, amount: number) => {
    setExpenses(expenses.map((e, i) => i === idx ? { ...e, amount } : e))
  }

  const totalIncome = income1 + income2
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalWithMortgage = totalExpenses + mortgagePayment
  const remaining = totalIncome - totalWithMortgage
  const dti = totalIncome > 0 ? (mortgagePayment / totalIncome) * 100 : 0

  const chartData = [...expenses.map(e => ({ name: e.category, value: e.amount })), { name: 'משכנתא', value: mortgagePayment }]

  const isHealthy = remaining >= 3000
  const recommendation = remaining >= 5000 ? 'מצב כלכלי מצוין - יש מרווח נוח' :
    remaining >= 3000 ? 'מצב תקין - מומלץ לשמור על מרווח' :
    remaining >= 0 ? 'מצב צפוף - שקול להפחית החזר' : 'חריגה מההכנסה!'

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div>
        <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
          <PieChartIcon size={22} style={{ color: '#059669' }} />
          מחשבון כלכלת משפחה
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>ניתוח הכנסות, הוצאות ויכולת עמידה במשכנתא</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Input */}
        <div className="lg:col-span-2 space-y-4">
          <div style={{ ...cardStyle, padding: 20 }}>
            <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>הכנסות</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>הכנסה לווה 1</label>
                <input type="number" value={income1} onChange={e => setIncome1(+e.target.value)} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-[13px] text-[#1c1917] outline-none focus:border-[#059669] bg-white" dir="ltr" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>הכנסה לווה 2</label>
                <input type="number" value={income2} onChange={e => setIncome2(+e.target.value)} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-[13px] text-[#1c1917] outline-none focus:border-[#059669] bg-white" dir="ltr" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>החזר משכנתא מבוקש</label>
              <input type="number" value={mortgagePayment} onChange={e => setMortgagePayment(+e.target.value)} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-[13px] text-[#1c1917] outline-none focus:border-[#059669] bg-white" dir="ltr" />
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 20 }}>
            <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>הוצאות חודשיות</h2>
            <div className="space-y-3">
              {expenses.map((expense, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-[13px] flex-1 min-w-0" style={{ color: '#57534e' }}>{expense.category}</span>
                  <input type="number" value={expense.amount} onChange={e => updateExpense(idx, +e.target.value)} className="w-28 shrink-0 px-3 py-2 border border-[#e7e5e4] rounded-lg text-[13px] text-[#1c1917] outline-none focus:border-[#059669] bg-white" dir="ltr" />
                  <span className="text-[12px] w-24 shrink-0 text-left" style={{ color: '#a8a29e' }}>{formatCurrency(expense.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div style={{ ...cardStyle, padding: 20 }}>
            <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>סיכום</h2>
            <div className="space-y-1">
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>סה"כ הכנסות</span><span className="text-[13px] font-semibold" style={{ color: '#059669' }}>{formatCurrency(totalIncome)}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>סה"כ הוצאות</span><span className="text-[13px] font-semibold" style={{ color: '#1c1917' }}>{formatCurrency(totalExpenses)}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>משכנתא</span><span className="text-[13px] font-semibold" style={{ color: '#059669' }}>{formatCurrency(mortgagePayment)}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>סה"כ הוצאות + משכנתא</span><span className="text-[13px] font-bold" style={{ color: '#1c1917' }}>{formatCurrency(totalWithMortgage)}</span></div>
              <div className="flex justify-between py-2">
                <span className="text-[13px]" style={{ color: '#57534e' }}>נשאר</span>
                <span className="text-[18px] font-black" style={{ color: remaining >= 3000 ? '#059669' : remaining >= 0 ? '#d97706' : '#dc2626' }}>{formatCurrency(remaining)}</span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="mt-4">
              <div className="h-3 rounded-full overflow-hidden" style={{ background: '#f5f4f2' }}>
                <div className="h-full flex">
                  <div className="h-full" style={{ width: `${(totalExpenses / totalIncome) * 100}%`, background: '#a8a29e' }} />
                  <div className="h-full" style={{ width: `${(mortgagePayment / totalIncome) * 100}%`, background: '#059669' }} />
                </div>
              </div>
              <div className="flex justify-between text-[11px] mt-1" style={{ color: '#a8a29e' }}>
                <span>הוצאות: {((totalExpenses / totalIncome) * 100).toFixed(0)}%</span>
                <span>משכנתא: {dti.toFixed(0)}%</span>
                <span>מרווח: {((remaining / totalIncome) * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Recommendation */}
            <div
              className="mt-4 p-3 rounded-xl text-[13px] font-semibold"
              style={{
                background: isHealthy ? '#d1fae5' : remaining >= 0 ? '#fef3c7' : '#fee2e2',
                color: isHealthy ? '#065f46' : remaining >= 0 ? '#d97706' : '#dc2626',
              }}
            >
              {recommendation}
            </div>

            {remaining < 3000 && remaining >= 0 && (
              <div className="mt-2 p-3 rounded-xl text-[13px]" style={{ background: '#fef3c7', color: '#d97706' }}>
                המרווח פחות מ-3,000 ₪ - מומלץ לבחון הפחתת ההחזר או צמצום הוצאות
              </div>
            )}
          </div>

          {/* Pie Chart */}
          <div style={{ ...cardStyle, padding: 20 }}>
            <h2 className="text-[15px] font-bold mb-3" style={{ color: '#1c1917' }}>חלוקת הוצאות</h2>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {chartData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 10, border: '1px solid #e7e5e4', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <button
            className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white transition-all hover:opacity-90"
            style={{ borderRadius: 12, background: '#059669', padding: '10px 0', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
          >
            <Download size={16} />
            הורד PDF
          </button>
        </div>
      </div>
    </div>
  )
}
