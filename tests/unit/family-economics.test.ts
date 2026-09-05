import { describe, it, expect } from 'vitest'
import {
  CATEGORY_LABELS,
  DEFAULT_EXPENSES,
  budgetFromCustomer,
  budgetFromFinancialData,
  defaultBudget,
  summarizeBudget,
  toFinancialData,
} from '@/utils/familyEconomics'
import type { Customer, FinancialData } from '@/types/database'

/**
 * The budget now round-trips through the customer document, so what is
 * written has to survive being read back — including from a document some
 * other version of the app wrote.
 */

const now = new Date().toISOString()

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'c1', user_id: 'u1', first_name: 'ישראל', last_name: 'ישראלי',
    id_number: null, phone: null, email: null, address: null,
    marital_status: null, children: 0,
    monthly_income: null, partner_income: null, own_capital: null,
    existing_obligations: 0, lead_source: null, status: 'ליד', notes: null,
    referral_partner_id: null, questionnaire_token: null, questionnaire_completed: false,
    created_at: now, updated_at: now, ...over,
  }
}

describe('summarizeBudget', () => {
  it('adds the incomes and every expense line', () => {
    const s = summarizeBudget({
      income1: 15_000, income2: 12_000, mortgagePayment: 5_500,
      expenses: [{ category: 'מזון', amount: 3_500 }, { category: 'רכב', amount: 2_500 }],
    })
    expect(s.totalIncome).toBe(27_000)
    expect(s.totalExpenses).toBe(6_000)
    expect(s.totalWithMortgage).toBe(11_500)
    expect(s.remaining).toBe(15_500)
  })

  it('reports zero rather than NaN when no income is entered', () => {
    const s = summarizeBudget({ income1: 0, income2: 0, mortgagePayment: 5_000, expenses: [] })
    expect(s.dti).toBe(0)
    expect(s.expensePct).toBe(0)
    expect(s.remainingPct).toBe(0)
    expect(Number.isNaN(s.dti)).toBe(false)
  })

  it('measures the mortgage against income, not against total spend', () => {
    const s = summarizeBudget({ income1: 10_000, income2: 0, mortgagePayment: 4_000, expenses: [{ category: 'מזון', amount: 3_000 }] })
    expect(s.dti).toBeCloseTo(40, 5)
  })

  it('grades the margin', () => {
    const base = { income1: 20_000, income2: 0, expenses: [] }
    expect(summarizeBudget({ ...base, mortgagePayment: 14_000 }).status).toBe('comfortable')
    expect(summarizeBudget({ ...base, mortgagePayment: 16_500 }).status).toBe('adequate')
    expect(summarizeBudget({ ...base, mortgagePayment: 19_000 }).status).toBe('tight')
    expect(summarizeBudget({ ...base, mortgagePayment: 21_000 }).status).toBe('over')
  })

  it('puts the boundaries on the healthier side', () => {
    const base = { income1: 20_000, income2: 0, expenses: [] }
    expect(summarizeBudget({ ...base, mortgagePayment: 15_000 }).status).toBe('comfortable')
    expect(summarizeBudget({ ...base, mortgagePayment: 17_000 }).status).toBe('adequate')
    expect(summarizeBudget({ ...base, mortgagePayment: 20_000 }).status).toBe('tight')
  })
})

describe('toFinancialData', () => {
  it('writes the stored category name, not the display label', () => {
    const fd = toFinancialData(defaultBudget())
    expect(fd.expenses?.map(e => e.category)).toEqual(DEFAULT_EXPENSES.map(e => e.category))
    expect(CATEGORY_LABELS['דיור']).toBe('דיור (ארנונה, ועד בית)')
  })

  it('stamps the save time', () => {
    const at = new Date('2026-09-05T10:00:00.000Z')
    expect(toFinancialData(defaultBudget(), at).updated_at).toBe(at.toISOString())
  })

  it('round-trips through budgetFromFinancialData', () => {
    const budget = defaultBudget()
    expect(budgetFromFinancialData(toFinancialData(budget))).toEqual(budget)
  })
})

describe('budgetFromFinancialData', () => {
  it('reports nothing to restore for a customer with no budget', () => {
    expect(budgetFromFinancialData(null)).toBeNull()
    expect(budgetFromFinancialData(undefined)).toBeNull()
    expect(budgetFromFinancialData({})).toBeNull()
  })

  it('restores a partial budget without inventing the missing fields', () => {
    const restored = budgetFromFinancialData({ income1: 9_000 })
    expect(restored).toEqual({ income1: 9_000 })
  })

  it('drops lines with an unknown category or a negative amount', () => {
    const fd = {
      expenses: [
        { category: 'מזון', amount: 1_000 },
        { category: 'קריפטו', amount: 500 },
        { category: 'רכב', amount: -200 },
      ],
    } as unknown as FinancialData
    expect(budgetFromFinancialData(fd)?.expenses).toEqual([{ category: 'מזון', amount: 1_000 }])
  })

  it('ignores a non-numeric income rather than propagating NaN', () => {
    const fd = { income1: 'הרבה', income2: 5_000 } as unknown as FinancialData
    expect(budgetFromFinancialData(fd)).toEqual({ income2: 5_000 })
  })
})

describe('budgetFromCustomer', () => {
  it('seeds the incomes from the case', () => {
    expect(budgetFromCustomer(customer({ monthly_income: 18_000, partner_income: 7_000 })))
      .toEqual({ income1: 18_000, income2: 7_000 })
  })

  it('leaves the seed alone when the case has no income on file', () => {
    expect(budgetFromCustomer(customer())).toEqual({})
  })
})
