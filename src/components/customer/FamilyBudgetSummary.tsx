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
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-sub)]">
            <PieChart size={16} className="text-[var(--color-primary)]" />
            טרם נשמרה כלכלת משפחה ללקוח זה
          </div>
          <Link to={openHref} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:underline">
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
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <PieChart size={16} className="text-[var(--color-primary)]" />
          נתונים מכלכלת המשפחה
          {savedAt && <span className="text-xs font-normal text-[var(--color-text-muted)]">· עודכן {formatDate(savedAt)}</span>}
        </div>
        <Link to={openHref} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:underline">
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
          <div key={item.label} className="rounded-lg bg-[var(--color-bg)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">{item.label}</p>
            <p className="text-sm font-bold text-[var(--color-text)] mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        {budget.expenses.map(e => (
          <li key={e.category} className="flex justify-between py-1 text-[13px] border-b border-[var(--color-border-light)]">
            <span className="text-[var(--color-text-sub)]">{CATEGORY_LABELS[e.category]}</span>
            <span className="text-[var(--color-text)]">{formatCurrency(e.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
