import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('he-IL').format(num)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'היום'
  if (diffDays === 1) return 'אתמול'
  if (diffDays < 7) return `לפני ${diffDays} ימים`
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`
  if (diffDays < 365) return `לפני ${Math.floor(diffDays / 30)} חודשים`
  return `לפני ${Math.floor(diffDays / 365)} שנים`
}

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0) return principal / months
  const monthlyRate = annualRate / 100 / 12
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  )
}

export function generateToken(): string {
  return crypto.randomUUID()
}

/**
 * חישוב תאריך תפוגה לטוקן ציבורי (ISO).
 * @param daysValid מספר ימי תוקף (ברירת מחדל 30)
 */
export function tokenExpiration(daysValid = 30): string {
  const date = new Date()
  date.setDate(date.getDate() + daysValid)
  return date.toISOString()
}

/**
 * בדיקה אם טוקן פג תוקף. טוקנים ישנים ללא תאריך תפוגה נחשבים תקפים.
 */
export function isTokenExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}
