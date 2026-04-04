import { useState, useMemo } from 'react'
import { PieChart as PieChartIcon, Download } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#1a4f8a', '#2563a8', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

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
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <PieChartIcon className="text-[#1a4f8a]" size={28} />
        מחשבון כלכלת משפחה
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">הכנסות</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">הכנסה לווה 1</label>
                <input type="number" value={income1} onChange={e => setIncome1(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">הכנסה לווה 2</label>
                <input type="number" value={income2} onChange={e => setIncome2(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-1">החזר משכנתא מבוקש</label>
              <input type="number" value={mortgagePayment} onChange={e => setMortgagePayment(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">הוצאות חודשיות</h2>
            <div className="space-y-3">
              {expenses.map((expense, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-48">{expense.category}</span>
                  <input type="number" value={expense.amount} onChange={e => updateExpense(idx, +e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" />
                  <span className="text-sm text-gray-400 w-20">{formatCurrency(expense.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">סיכום</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">סה"כ הכנסות</span><span className="font-bold text-green-600">{formatCurrency(totalIncome)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">סה"כ הוצאות</span><span className="font-medium text-gray-900">{formatCurrency(totalExpenses)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">משכנתא</span><span className="font-medium text-[#1a4f8a]">{formatCurrency(mortgagePayment)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">סה"כ הוצאות + משכנתא</span><span className="font-bold text-gray-900">{formatCurrency(totalWithMortgage)}</span></div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">נשאר</span>
                <span className={`text-xl font-bold ${remaining >= 3000 ? 'text-green-600' : remaining >= 0 ? 'text-orange-500' : 'text-red-600'}`}>{formatCurrency(remaining)}</span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="mt-4">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div className="bg-gray-400 h-full" style={{ width: `${(totalExpenses / totalIncome) * 100}%` }} />
                  <div className="bg-[#1a4f8a] h-full" style={{ width: `${(mortgagePayment / totalIncome) * 100}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>הוצאות: {((totalExpenses / totalIncome) * 100).toFixed(0)}%</span>
                <span>משכנתא: {dti.toFixed(0)}%</span>
                <span>מרווח: {((remaining / totalIncome) * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Recommendation */}
            <div className={`mt-4 p-3 rounded-lg text-sm ${isHealthy ? 'bg-green-50 text-green-700' : remaining >= 0 ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
              {recommendation}
            </div>

            {remaining < 3000 && remaining >= 0 && (
              <div className="mt-2 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                המרווח פחות מ-3,000 ₪ - מומלץ לבחון הפחתת ההחזר או צמצום הוצאות
              </div>
            )}
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">חלוקת הוצאות</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {chartData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <button className="w-full flex items-center justify-center gap-2 bg-[#1a4f8a] text-white py-2.5 rounded-lg hover:bg-[#143d6b]">
            <Download size={18} />
            הורד PDF
          </button>
        </div>
      </div>
    </div>
  )
}
