import { useState, useMemo } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface Loan {
  type: string
  balance: number
  monthlyPayment: number
  interestRate: number
  remainingMonths: number
  earlyRepaymentFee: number
}

const loanTypes = ['רכב', 'אישי', 'כרטיס אשראי', 'קו אשראי', 'אחר']

const emptyLoan: Loan = { type: 'אישי', balance: 0, monthlyPayment: 0, interestRate: 0, remainingMonths: 0, earlyRepaymentFee: 0 }

export default function ConsolidationCalculatorPage() {
  const [loans, setLoans] = useState<Loan[]>([
    { type: 'רכב', balance: 80000, monthlyPayment: 2200, interestRate: 6.5, remainingMonths: 48, earlyRepaymentFee: 1500 },
    { type: 'אישי', balance: 50000, monthlyPayment: 1800, interestRate: 8.0, remainingMonths: 36, earlyRepaymentFee: 800 },
    { type: 'כרטיס אשראי', balance: 25000, monthlyPayment: 1200, interestRate: 12.0, remainingMonths: 24, earlyRepaymentFee: 0 },
  ])
  const [consolidatedRate, setConsolidatedRate] = useState(4.5)
  const [consolidatedMonths, setConsolidatedMonths] = useState(120)

  const addLoan = () => setLoans([...loans, { ...emptyLoan }])
  const removeLoan = (idx: number) => setLoans(loans.filter((_, i) => i !== idx))
  const updateLoan = (idx: number, field: keyof Loan, value: number | string) => {
    setLoans(loans.map((l, i) => i === idx ? { ...l, [field]: typeof l[field] === 'number' ? +value : value } : l))
  }

  const analysis = useMemo(() => {
    const totalBalance = loans.reduce((s, l) => s + l.balance, 0)
    const totalMonthly = loans.reduce((s, l) => s + l.monthlyPayment, 0)
    const totalFees = loans.reduce((s, l) => s + l.earlyRepaymentFee, 0)
    const consolidatedBalance = totalBalance + totalFees

    const r = consolidatedRate / 100 / 12
    const newMonthly = r > 0
      ? (consolidatedBalance * r * Math.pow(1 + r, consolidatedMonths)) / (Math.pow(1 + r, consolidatedMonths) - 1)
      : consolidatedBalance / consolidatedMonths

    const monthlySaving = totalMonthly - newMonthly
    const totalExistingCost = loans.reduce((s, l) => s + l.monthlyPayment * l.remainingMonths, 0)
    const totalNewCost = newMonthly * consolidatedMonths + totalFees
    const totalSaving = totalExistingCost - totalNewCost

    return {
      totalBalance, totalMonthly, totalFees, consolidatedBalance,
      newMonthly: Math.round(newMonthly),
      monthlySaving: Math.round(monthlySaving),
      yearlySaving: Math.round(monthlySaving * 12),
      totalSaving: Math.round(totalSaving),
      breakEvenMonths: monthlySaving > 0 ? Math.ceil(totalFees / monthlySaving) : Infinity,
    }
  }, [loans, consolidatedRate, consolidatedMonths])

  const chartData = loans.map(l => ({
    name: l.type,
    current: l.monthlyPayment,
    share: Math.round((l.balance / (analysis.totalBalance || 1)) * analysis.newMonthly),
  }))

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Layers className="text-[#1a4f8a]" size={28} />
        מחשבון איחוד הלוואות
      </h1>

      {/* Loans Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">הלוואות קיימות</h2>
          <button onClick={addLoan} className="text-sm bg-[#1a4f8a] text-white px-3 py-1.5 rounded-lg hover:bg-[#143d6b] flex items-center gap-1">
            <Plus size={14} /> הוסף הלוואה
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-right p-2">סוג</th>
                <th className="text-right p-2">יתרה</th>
                <th className="text-right p-2">החזר חודשי</th>
                <th className="text-right p-2">ריבית %</th>
                <th className="text-right p-2">חודשים</th>
                <th className="text-right p-2">עמלת פירעון</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="p-2"><select value={loan.type} onChange={e => updateLoan(idx, 'type', e.target.value)} className="w-full px-2 py-1.5 border rounded bg-white">{loanTypes.map(t => <option key={t}>{t}</option>)}</select></td>
                  <td className="p-2"><input type="number" value={loan.balance} onChange={e => updateLoan(idx, 'balance', e.target.value)} className="w-full px-2 py-1.5 border rounded" dir="ltr" /></td>
                  <td className="p-2"><input type="number" value={loan.monthlyPayment} onChange={e => updateLoan(idx, 'monthlyPayment', e.target.value)} className="w-full px-2 py-1.5 border rounded" dir="ltr" /></td>
                  <td className="p-2"><input type="number" step="0.1" value={loan.interestRate} onChange={e => updateLoan(idx, 'interestRate', e.target.value)} className="w-full px-2 py-1.5 border rounded" dir="ltr" /></td>
                  <td className="p-2"><input type="number" value={loan.remainingMonths} onChange={e => updateLoan(idx, 'remainingMonths', e.target.value)} className="w-full px-2 py-1.5 border rounded" dir="ltr" /></td>
                  <td className="p-2"><input type="number" value={loan.earlyRepaymentFee} onChange={e => updateLoan(idx, 'earlyRepaymentFee', e.target.value)} className="w-full px-2 py-1.5 border rounded" dir="ltr" /></td>
                  <td className="p-2"><button onClick={() => removeLoan(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consolidation Parameters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">פרמטרי איחוד</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">ריבית איחוד %</label>
            <input type="number" step="0.1" value={consolidatedRate} onChange={e => setConsolidatedRate(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">תקופה (חודשים)</label>
            <input type="number" value={consolidatedMonths} onChange={e => setConsolidatedMonths(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">סיכום</h2>
          <div className="space-y-3">
            {[
              { label: 'סה"כ חוב', value: formatCurrency(analysis.totalBalance) },
              { label: 'החזר חודשי כיום', value: formatCurrency(analysis.totalMonthly) },
              { label: 'החזר חודשי חדש', value: formatCurrency(analysis.newMonthly), highlight: true },
              { label: 'חיסכון חודשי', value: formatCurrency(analysis.monthlySaving), green: true },
              { label: 'חיסכון שנתי', value: formatCurrency(analysis.yearlySaving), green: true },
              { label: 'חיסכון כולל', value: formatCurrency(analysis.totalSaving), green: true },
              { label: 'עמלות פירעון', value: formatCurrency(analysis.totalFees) },
              { label: 'Break-Even', value: analysis.breakEvenMonths === Infinity ? 'N/A' : `${analysis.breakEvenMonths} חודשים` },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-600">{item.label}</span>
                <span className={`font-medium ${item.green ? 'text-green-600' : item.highlight ? 'text-[#1a4f8a] font-bold' : 'text-gray-900'}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">השוואת החזרים</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={v => `₪${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="current" name="החזר נוכחי" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="share" name="חלק באיחוד" fill="#1a4f8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
