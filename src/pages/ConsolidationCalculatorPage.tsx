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

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
    border: '1px solid #e7e5e4',
  }
  const inputCls = 'w-full px-2 py-1.5 border border-[#e7e5e4] rounded-lg bg-white text-[13px] text-[#1c1917] outline-none focus:border-[#059669]'

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div>
        <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
          <Layers size={22} style={{ color: '#059669' }} />
          מחשבון איחוד הלוואות
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>השווה וחשב איחוד הלוואות קיימות למשכנתא</p>
      </div>

      {/* Loans Table */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold" style={{ color: '#1c1917' }}>הלוואות קיימות</h2>
          <button
            onClick={addLoan}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white px-3 py-1.5 transition-all hover:opacity-90"
            style={{ borderRadius: 10, background: '#059669' }}
          >
            <Plus size={14} /> הוסף הלוואה
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: '#faf9f7' }}>
                <th className="text-right p-2 font-semibold" style={{ color: '#a8a29e' }}>סוג</th>
                <th className="text-right p-2 font-semibold" style={{ color: '#a8a29e' }}>יתרה</th>
                <th className="text-right p-2 font-semibold" style={{ color: '#a8a29e' }}>החזר חודשי</th>
                <th className="text-right p-2 font-semibold" style={{ color: '#a8a29e' }}>ריבית %</th>
                <th className="text-right p-2 font-semibold" style={{ color: '#a8a29e' }}>חודשים</th>
                <th className="text-right p-2 font-semibold" style={{ color: '#a8a29e' }}>עמלת פירעון</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid #f5f4f2' }}>
                  <td className="p-2"><select value={loan.type} onChange={e => updateLoan(idx, 'type', e.target.value)} className={inputCls}>{loanTypes.map(t => <option key={t}>{t}</option>)}</select></td>
                  <td className="p-2"><input type="number" value={loan.balance} onChange={e => updateLoan(idx, 'balance', e.target.value)} className={inputCls} dir="ltr" /></td>
                  <td className="p-2"><input type="number" value={loan.monthlyPayment} onChange={e => updateLoan(idx, 'monthlyPayment', e.target.value)} className={inputCls} dir="ltr" /></td>
                  <td className="p-2"><input type="number" step="0.1" value={loan.interestRate} onChange={e => updateLoan(idx, 'interestRate', e.target.value)} className={inputCls} dir="ltr" /></td>
                  <td className="p-2"><input type="number" value={loan.remainingMonths} onChange={e => updateLoan(idx, 'remainingMonths', e.target.value)} className={inputCls} dir="ltr" /></td>
                  <td className="p-2"><input type="number" value={loan.earlyRepaymentFee} onChange={e => updateLoan(idx, 'earlyRepaymentFee', e.target.value)} className={inputCls} dir="ltr" /></td>
                  <td className="p-2"><button onClick={() => removeLoan(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consolidation Parameters */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>פרמטרי איחוד</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>ריבית איחוד %</label>
            <input type="number" step="0.1" value={consolidatedRate} onChange={e => setConsolidatedRate(+e.target.value)} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-[13px] text-[#1c1917] outline-none focus:border-[#059669] bg-white" dir="ltr" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>תקופה (חודשים)</label>
            <input type="number" value={consolidatedMonths} onChange={e => setConsolidatedMonths(+e.target.value)} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-[13px] text-[#1c1917] outline-none focus:border-[#059669] bg-white" dir="ltr" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div style={{ ...cardStyle, padding: 20 }}>
          <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>סיכום</h2>
          <div className="space-y-1">
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
              <div key={item.label} className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}>
                <span className="text-[13px]" style={{ color: '#57534e' }}>{item.label}</span>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: item.green ? '#059669' : item.highlight ? '#059669' : '#1c1917', fontWeight: item.highlight ? 700 : undefined }}
                >{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 20 }}>
          <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>השוואת החזרים</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f4f2" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#a8a29e' }} />
              <YAxis tickFormatter={v => `₪${v}`} tick={{ fontSize: 12, fill: '#a8a29e' }} />
              <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 10, border: '1px solid #e7e5e4', fontSize: 13 }} />
              <Bar dataKey="current" name="החזר נוכחי" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="share" name="חלק באיחוד" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
