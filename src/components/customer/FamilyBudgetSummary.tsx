import { Link } from 'react-router-dom'
import { PieChart, ArrowLeft } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CATEGORY_LABELS, budgetFromFinancialData, defaultBudget, summarizeBudget } from '@/utils/familyEconomics'
import type { Customer } from '@/types/database'

/**
 * Read-only view of the budget saved from the family economics calculator.
 * The numbers are edited there, not here — this is the case's record of them.
 */
export function FamilyBudgetSummary({ customer }: { customer: Customer }) {
  const saved = budgetFromFinancialData(customer.financial_data)
  const openHref = `/family-economics?customerId=${customer.id}`

  if (!saved) {
    return (
      <div className="rounded-xl border border-[#e7e5e4] bg-[#faf9f7] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-[#57534e]">
            <PieChart size={16} className="text-[#059669]" />
            טרם נשמרה כלכלת משפחה ללקוח זה
          </div>
          <Link to={openHref} className="inline-flex items-center gap-1 text-sm font-semibold text-[#059669] hover:underline">
            פתח את המחשבון
            <ArrowLeft size={14} />
          </Link>
        </div>
      </div>
    )
  }

  const budget = { ...defaultBudget(), ...saved }
  const summary = summarizeBudget(budget)
  const savedAt = customer.financial_data?.updated_at

  return (
    <div className="rounded-xl border border-[#e7e5e4] bg-white p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1c1917]">
          <PieChart size={16} className="text-[#059669]" />
          נתונים מכלכלת המשפחה
          {savedAt && <span className="text-xs font-normal text-[#a8a29e]">· עודכן {formatDate(savedAt)}</span>}
        </div>
        <Link to={openHref} className="inline-flex items-center gap-1 text-sm font-semibold text-[#059669] hover:underline">
          ערוך במחשבון
          <ArrowLeft size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {[
          { label: 'סה"כ הכנסות', value: formatCurrency(summary.totalIncome) },
          { label: 'סה"כ הוצאות', value: formatCurrency(summary.totalExpenses) },
          { label: 'החזר משכנתא', value: formatCurrency(budget.mortgagePayment) },
          { label: 'נשאר פנוי', value: formatCurrency(summary.remaining) },
        ].map(item => (
          <div key={item.label} className="rounded-lg bg-[#faf9f7] p-3">
            <p className="text-xs text-[#a8a29e]">{item.label}</p>
            <p className="text-sm font-bold text-[#1c1917] mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        {budget.expenses.map(e => (
          <li key={e.category} className="flex justify-between py-1 text-[13px] border-b border-[#f5f4f2]">
            <span className="text-[#57534e]">{CATEGORY_LABELS[e.category]}</span>
            <span className="text-[#1c1917]">{formatCurrency(e.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
