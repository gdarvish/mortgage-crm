import type { Borrower } from '@/types/database'

/**
 * Household income for DTI: the primary borrower plus any co-borrowers
 * (role 'לווה שני'). Guarantors ('ערב') never add income. Falls back to the
 * customer's legacy partner_income when there are no borrower records yet.
 */
export function totalHouseholdIncome(
  primaryIncome: number | null | undefined,
  partnerIncome: number | null | undefined,
  borrowers: Borrower[],
): number {
  const base = primaryIncome ?? 0
  const coBorrowers = borrowers.filter(b => b.role === 'לווה שני')
  if (coBorrowers.length === 0) return base + (partnerIncome ?? 0)
  return base + coBorrowers.reduce((sum, b) => sum + (b.monthly_income ?? 0), 0)
}
