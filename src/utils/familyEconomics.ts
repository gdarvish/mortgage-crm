import type { Customer, ExpenseCategory, FinancialData } from '@/types/database'

/**
 * The household budget behind the family economics page, as pure functions.
 *
 * The page persists onto the customer document, so the shape written there
 * and the shape read back are both defined here rather than inline in JSX.
 */

export interface ExpenseLine {
  category: ExpenseCategory
  amount: number
}

export interface BudgetInput {
  income1: number
  income2: number
  mortgagePayment: number
  expenses: ExpenseLine[]
}

/** The label shown for each bucket — longer than the stored category name. */
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  'דיור': 'דיור (ארנונה, ועד בית)',
  'מזון': 'מזון',
  'רכב': 'רכב',
  'חינוך': 'חינוך',
  'בילויים': 'בילויים',
  'חיסכון': 'חסכונות',
  'אחר': 'אחר',
}

export const EXPENSE_CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[]

export const DEFAULT_EXPENSES: readonly ExpenseLine[] = [
  { category: 'דיור', amount: 1500 },
  { category: 'מזון', amount: 3500 },
  { category: 'רכב', amount: 2500 },
  { category: 'חינוך', amount: 3000 },
  { category: 'בילויים', amount: 1500 },
  { category: 'חיסכון', amount: 2000 },
  { category: 'אחר', amount: 1000 },
]

export function defaultBudget(): BudgetInput {
  return {
    income1: 15_000,
    income2: 12_000,
    mortgagePayment: 5_500,
    expenses: DEFAULT_EXPENSES.map((e) => ({ ...e })),
  }
}

/** A negative or non-numeric shekel figure is a typo, not a budget line. */
function toAmount(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function isCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && value in CATEGORY_LABELS
}

/**
 * Reads a stored budget back into the form. Returns null when the customer
 * has nothing saved, so the caller can fall back to seeding from the case.
 */
export function budgetFromFinancialData(fd: FinancialData | null | undefined): Partial<BudgetInput> | null {
  if (!fd || typeof fd !== 'object') return null
  const out: Partial<BudgetInput> = {}
  const income1 = toAmount(fd.income1)
  const income2 = toAmount(fd.income2)
  const mortgagePayment = toAmount(fd.mortgagePayment)
  if (income1 !== null) out.income1 = income1
  if (income2 !== null) out.income2 = income2
  if (mortgagePayment !== null) out.mortgagePayment = mortgagePayment
  if (Array.isArray(fd.expenses)) {
    const expenses = fd.expenses
      .map((e) => {
        const amount = toAmount(e?.amount)
        if (amount === null || !isCategory(e?.category)) return null
        return { category: e.category, amount }
      })
      .filter((e): e is ExpenseLine => e !== null)
    if (expenses.length) out.expenses = expenses
  }
  return Object.keys(out).length ? out : null
}

/**
 * Seeds the incomes from the case when the customer has no budget saved yet.
 * Better than showing the demo figures next to a real customer's name.
 */
export function budgetFromCustomer(customer: Customer): Partial<BudgetInput> {
  const out: Partial<BudgetInput> = {}
  const income1 = toAmount(customer.monthly_income)
  const income2 = toAmount(customer.partner_income)
  if (income1 !== null) out.income1 = income1
  if (income2 !== null) out.income2 = income2
  return out
}

export function toFinancialData(budget: BudgetInput, now: Date = new Date()): FinancialData {
  return {
    income1: budget.income1,
    income2: budget.income2,
    mortgagePayment: budget.mortgagePayment,
    expenses: budget.expenses.map((e) => ({ category: e.category, amount: e.amount })),
    updated_at: now.toISOString(),
  }
}

export type BudgetStatus = 'comfortable' | 'adequate' | 'tight' | 'over'

export interface BudgetSummary {
  totalIncome: number
  totalExpenses: number
  totalWithMortgage: number
  remaining: number
  /** Mortgage payment as a share of income — the bank's headline ratio. */
  dti: number
  expensePct: number
  remainingPct: number
  status: BudgetStatus
  message: string
}

const STATUS_MESSAGES: Record<BudgetStatus, string> = {
  comfortable: 'מצב כלכלי מצוין — יש מרווח נוח',
  adequate: 'מצב תקין — מומלץ לשמור על מרווח',
  tight: 'מצב צפוף — שקול להפחית את ההחזר',
  over: 'חריגה מההכנסה!',
}

export function summarizeBudget(budget: BudgetInput): BudgetSummary {
  const totalIncome = budget.income1 + budget.income2
  const totalExpenses = budget.expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalWithMortgage = totalExpenses + budget.mortgagePayment
  const remaining = totalIncome - totalWithMortgage

  // Every percentage divides by income. With no income entered the answer is
  // "unknown", not NaN — which is what the bars used to render.
  const pct = (value: number) => (totalIncome > 0 ? (value / totalIncome) * 100 : 0)

  const status: BudgetStatus =
    remaining >= 5000 ? 'comfortable'
      : remaining >= 3000 ? 'adequate'
        : remaining >= 0 ? 'tight'
          : 'over'

  return {
    totalIncome,
    totalExpenses,
    totalWithMortgage,
    remaining,
    dti: pct(budget.mortgagePayment),
    expensePct: pct(totalExpenses),
    remainingPct: pct(remaining),
    status,
    message: STATUS_MESSAGES[status],
  }
}
