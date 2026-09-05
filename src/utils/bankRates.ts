import type { BankRate, RatesDoc } from '@/types/database'

/**
 * Pure helpers for the advisor's rate board. Kept free of the Firebase client
 * so the normalisation and staleness rules can be tested directly.
 */

/** A rate board that has not been touched for this long is flagged as stale. */
export const RATES_STALE_MS = 7 * 24 * 60 * 60 * 1000

/** Rates above this are a typo, not a quote — the inputs clamp to it. */
export const MAX_RATE = 20

export const DEFAULT_BANK_RATES: readonly BankRate[] = [
  { bank: 'בנק הפועלים', prime: 6.0, fixedNonLinked: 4.45, fixedLinked: 3.75, variableLinked: 3.20, variableNotLinked: 5.15 },
  { bank: 'בנק לאומי', prime: 6.0, fixedNonLinked: 4.50, fixedLinked: 3.80, variableLinked: 3.25, variableNotLinked: 5.20 },
  { bank: 'בנק דיסקונט', prime: 6.0, fixedNonLinked: 4.40, fixedLinked: 3.70, variableLinked: 3.15, variableNotLinked: 5.05 },
  { bank: 'בנק מזרחי', prime: 6.0, fixedNonLinked: 4.55, fixedLinked: 3.85, variableLinked: 3.30, variableNotLinked: 5.25 },
  { bank: 'בנק בינלאומי', prime: 6.0, fixedNonLinked: 4.35, fixedLinked: 3.65, variableLinked: 3.10, variableNotLinked: 5.00 },
]

/** Seed values shown before anything has been saved. Never written on its own. */
export function defaultRatesDoc(): RatesDoc {
  return {
    bankRates: DEFAULT_BANK_RATES.map((b) => ({ ...b })),
    prime: 6.0,
    boiRate: 4.5,
    lastCpi: 0.3,
    updated_at: '',
  }
}

function toRate(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (!Number.isFinite(n) || n < 0 || n > MAX_RATE) return fallback
  return n
}

function normalizeBankRate(raw: unknown): BankRate | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const bank = typeof r.bank === 'string' ? r.bank.trim() : ''
  if (!bank) return null
  const variableLinked = toRate(r.variableLinked, 0)
  return {
    bank,
    prime: toRate(r.prime, 0),
    fixedNonLinked: toRate(r.fixedNonLinked, 0),
    fixedLinked: toRate(r.fixedLinked, 0),
    variableLinked,
    // Boards saved before the מ"ל column existed carry no value for it.
    // Falling back to the linked variable rate keeps the row readable
    // instead of showing a misleading 0.00%.
    variableNotLinked: toRate(r.variableNotLinked, variableLinked),
  }
}

/**
 * Coerces a stored document (or a localStorage cache entry) into a usable
 * board. Returns null when there is nothing worth rendering, so the caller
 * can fall back to the seed rather than paint an empty table.
 */
export function normalizeRatesDoc(raw: unknown): RatesDoc | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const list = Array.isArray(r.bankRates) ? r.bankRates : []
  const bankRates = list.map(normalizeBankRate).filter((b): b is BankRate => b !== null)
  if (!bankRates.length) return null
  const seed = defaultRatesDoc()
  return {
    bankRates,
    prime: toRate(r.prime, seed.prime),
    boiRate: toRate(r.boiRate, seed.boiRate),
    lastCpi: toRate(r.lastCpi, seed.lastCpi),
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  }
}

/**
 * Applies a Bank of Israel reading over a board. Only the two headline
 * figures move — the per-bank quotes are the advisor's own and are never
 * overwritten by the feed.
 */
export function applyBoiReading(
  current: RatesDoc,
  boi: { prime: number; boiRate: number },
): RatesDoc {
  return {
    ...current,
    prime: toRate(boi.prime, current.prime),
    boiRate: toRate(boi.boiRate, current.boiRate),
  }
}

/** True once the board is old enough that the advisor should re-check it. */
export function isRatesStale(rates: RatesDoc, now: number = Date.now()): boolean {
  if (!rates.updated_at) return false
  const ts = new Date(rates.updated_at).getTime()
  if (!Number.isFinite(ts)) return false
  return now - ts > RATES_STALE_MS
}

/** Parses one edit-form field, keeping the previous value on nonsense input. */
export function parseRateInput(value: string, previous: number): number {
  if (value.trim() === '') return 0
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return previous
  return Math.min(Math.max(n, 0), MAX_RATE)
}
