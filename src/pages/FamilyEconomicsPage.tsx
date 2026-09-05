import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PieChart as PieChartIcon, Download, Save, Loader2 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/ui'
import { CustomerPicker } from '@/components/customer/CustomerPicker'
import { useCustomer } from '@/hooks/queries/useCustomers'
import { customerService } from '@/services/customerService'
import { exportFamilyEconomicsPdf } from '@/utils/pdfExport'
import {
  CATEGORY_LABELS,
  budgetFromCustomer,
  budgetFromFinancialData,
  defaultBudget,
  summarizeBudget,
  toFinancialData,
  type BudgetInput,
} from '@/utils/familyEconomics'
import type { Customer } from '@/types/database'

const COLORS = ['#059669', '#34d399', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

const inputClass = 'w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-[13px] text-[#1c1917] outline-none focus:border-[#059669] bg-white'

export default function FamilyEconomicsPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerId = searchParams.get('customerId')

  const [budget, setBudget] = useState<BudgetInput>(defaultBudget)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data: customer } = useCustomer(customerId ?? undefined)

  // One hydration per customer: after that the form belongs to the advisor,
  // and a background refetch must not overwrite what they are typing.
  const hydratedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!customer) {
      if (!customerId) hydratedFor.current = null
      return
    }
    if (hydratedFor.current === customer.id) return
    hydratedFor.current = customer.id
    const saved = budgetFromFinancialData(customer.financial_data)
    // Nothing saved yet — the case's own income figures beat the demo ones.
    setBudget(prev => ({ ...prev, ...(saved ?? budgetFromCustomer(customer)) }))
  }, [customer, customerId])

  const setCustomerId = useCallback((id: string | null) => {
    hydratedFor.current = null
    const next = new URLSearchParams(searchParams)
    if (id) next.set('customerId', id)
    else next.delete('customerId')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const updateExpense = (idx: number, amount: number) => {
    setBudget(prev => ({
      ...prev,
      expenses: prev.expenses.map((e, i) => (i === idx ? { ...e, amount } : e)),
    }))
  }

  const summary = summarizeBudget(budget)
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : undefined

  const saveToCustomer = async () => {
    if (!customerId) return
    setSaving(true)
    const { error } = await customerService.update(customerId, {
      financial_data: toFinancialData(budget),
    })
    setSaving(false)
    if (error) {
      toast.error('שגיאה בשמירת הנתונים', error.message)
      return
    }
    // The saved budget is now the hydration source for this customer.
    hydratedFor.current = null
    qc.invalidateQueries({ queryKey: ['customer', customerId] })
    qc.invalidateQueries({ queryKey: ['customers'] })
    toast.success('הנתונים נשמרו בתיק הלקוח')
  }

  const downloadPdf = async () => {
    setExporting(true)
    try {
      await exportFamilyEconomicsPdf({
        customerName,
        income1: budget.income1,
        income2: budget.income2,
        mortgagePayment: budget.mortgagePayment,
        expenses: budget.expenses.map(e => ({ label: CATEGORY_LABELS[e.category], amount: e.amount })),
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        totalWithMortgage: summary.totalWithMortgage,
        remaining: summary.remaining,
        dti: summary.dti,
        message: summary.message,
      })
    } catch (e) {
      toast.error('שגיאה בהפקת ה-PDF', e instanceof Error ? e.message : undefined)
    } finally {
      setExporting(false)
    }
  }

  const chartData = [
    ...budget.expenses.map(e => ({ name: CATEGORY_LABELS[e.category], value: e.amount })),
    { name: 'משכנתא', value: budget.mortgagePayment },
  ]

  const remainingColor = summary.status === 'over' ? '#dc2626'
    : summary.status === 'tight' ? '#d97706'
      : '#059669'
  const statusStyle = summary.status === 'over'
    ? { background: '#fee2e2', color: '#dc2626' }
    : summary.status === 'tight'
      ? { background: '#fef3c7', color: '#d97706' }
      : { background: '#d1fae5', color: '#065f46' }

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div>
        <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
          <PieChartIcon size={22} style={{ color: '#059669' }} />
          מחשבון כלכלת משפחה
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>ניתוח הכנסות, הוצאות ויכולת עמידה במשכנתא</p>
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <CustomerPicker
          selected={(customer as Customer | null | undefined) ?? null}
          onSelect={c => setCustomerId(c.id)}
          onClear={() => setCustomerId(null)}
        >
          <button
            type="button"
            onClick={() => void saveToCustomer()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: '#059669' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            שמור ללקוח
          </button>
        </CustomerPicker>
        {!customerId && (
          <p className="mt-2 text-[12px]" style={{ color: '#a8a29e' }}>
            בחירת לקוח טוענת את הנתונים השמורים בתיק ומאפשרת לשמור אותם בחזרה.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Input */}
        <div className="lg:col-span-2 space-y-4">
          <div style={{ ...cardStyle, padding: 20 }}>
            <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>הכנסות</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }} htmlFor="income1">הכנסה לווה 1</label>
                <input id="income1" type="number" min="0" value={budget.income1} onChange={e => setBudget(p => ({ ...p, income1: Math.max(0, +e.target.value) }))} className={inputClass} dir="ltr" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }} htmlFor="income2">הכנסה לווה 2</label>
                <input id="income2" type="number" min="0" value={budget.income2} onChange={e => setBudget(p => ({ ...p, income2: Math.max(0, +e.target.value) }))} className={inputClass} dir="ltr" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }} htmlFor="mortgage-payment">החזר משכנתא מבוקש</label>
              <input id="mortgage-payment" type="number" min="0" value={budget.mortgagePayment} onChange={e => setBudget(p => ({ ...p, mortgagePayment: Math.max(0, +e.target.value) }))} className={inputClass} dir="ltr" />
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 20 }}>
            <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>הוצאות חודשיות</h2>
            <div className="space-y-3">
              {budget.expenses.map((expense, idx) => (
                <div key={expense.category} className="flex items-center gap-3">
                  <label className="text-[13px] flex-1 min-w-0" style={{ color: '#57534e' }} htmlFor={`expense-${expense.category}`}>
                    {CATEGORY_LABELS[expense.category]}
                  </label>
                  <input
                    id={`expense-${expense.category}`}
                    type="number" min="0" dir="ltr"
                    value={expense.amount}
                    onChange={e => updateExpense(idx, Math.max(0, +e.target.value))}
                    className={`${inputClass} w-28 shrink-0`}
                  />
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
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>סה"כ הכנסות</span><span className="text-[13px] font-semibold" style={{ color: '#059669' }}>{formatCurrency(summary.totalIncome)}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>סה"כ הוצאות</span><span className="text-[13px] font-semibold" style={{ color: '#1c1917' }}>{formatCurrency(summary.totalExpenses)}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>משכנתא</span><span className="text-[13px] font-semibold" style={{ color: '#059669' }}>{formatCurrency(budget.mortgagePayment)}</span></div>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #f5f4f2' }}><span className="text-[13px]" style={{ color: '#57534e' }}>סה"כ הוצאות + משכנתא</span><span className="text-[13px] font-bold" style={{ color: '#1c1917' }}>{formatCurrency(summary.totalWithMortgage)}</span></div>
              <div className="flex justify-between py-2">
                <span className="text-[13px]" style={{ color: '#57534e' }}>נשאר</span>
                <span className="text-[18px] font-black" style={{ color: remainingColor }}>{formatCurrency(summary.remaining)}</span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="mt-4">
              <div className="h-3 rounded-full overflow-hidden" style={{ background: '#f5f4f2' }}>
                <div className="h-full flex">
                  <div className="h-full" style={{ width: `${Math.min(summary.expensePct, 100)}%`, background: '#a8a29e' }} />
                  <div className="h-full" style={{ width: `${Math.min(summary.dti, 100)}%`, background: '#059669' }} />
                </div>
              </div>
              <div className="flex justify-between text-[11px] mt-1" style={{ color: '#a8a29e' }}>
                <span>הוצאות: {summary.expensePct.toFixed(0)}%</span>
                <span>משכנתא: {summary.dti.toFixed(0)}%</span>
                <span>מרווח: {summary.remainingPct.toFixed(0)}%</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl text-[13px] font-semibold" style={statusStyle}>
              {summary.message}
            </div>

            {summary.status === 'tight' && (
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
            type="button"
            onClick={() => void downloadPdf()}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ borderRadius: 12, background: '#059669', padding: '10px 0', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            הורד PDF
          </button>
        </div>
      </div>
    </div>
  )
}
