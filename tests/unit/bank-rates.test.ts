import { describe, it, expect } from 'vitest'
import {
  DEFAULT_BANK_RATES,
  MAX_RATE,
  RATES_STALE_MS,
  applyBoiReading,
  defaultRatesDoc,
  isRatesStale,
  normalizeRatesDoc,
  parseRateInput,
} from '@/utils/bankRates'

/**
 * The rate board is advisor-entered and round-trips through Firestore and
 * localStorage, so every value coming back in is untrusted: an older schema,
 * a hand-edited cache entry, or a half-typed number in the edit form.
 */

describe('defaultRatesDoc', () => {
  it('seeds the five banks and never shares their objects between calls', () => {
    const a = defaultRatesDoc()
    const b = defaultRatesDoc()
    expect(a.bankRates).toHaveLength(DEFAULT_BANK_RATES.length)
    a.bankRates[0].prime = 1
    expect(b.bankRates[0].prime).toBe(DEFAULT_BANK_RATES[0].prime)
  })

  it('starts unsaved', () => {
    expect(defaultRatesDoc().updated_at).toBe('')
  })

  it('gives every seed bank a מ"ל rate', () => {
    for (const bank of DEFAULT_BANK_RATES) {
      expect(bank.variableNotLinked).toBeGreaterThan(0)
    }
  })
})

describe('normalizeRatesDoc', () => {
  const stored = {
    bankRates: [
      { bank: 'בנק הפועלים', prime: 6, fixedNonLinked: 4.45, fixedLinked: 3.75, variableLinked: 3.2, variableNotLinked: 5.15 },
    ],
    prime: 6,
    boiRate: 4.5,
    lastCpi: 0.3,
    updated_at: '2026-09-01T00:00:00.000Z',
  }

  it('passes a well-formed document through', () => {
    expect(normalizeRatesDoc(stored)).toEqual(stored)
  })

  it('rejects anything that is not a board', () => {
    expect(normalizeRatesDoc(null)).toBeNull()
    expect(normalizeRatesDoc('rates')).toBeNull()
    expect(normalizeRatesDoc({})).toBeNull()
    expect(normalizeRatesDoc({ bankRates: [] })).toBeNull()
  })

  it('drops rows with no bank name rather than rendering a blank key', () => {
    const out = normalizeRatesDoc({ ...stored, bankRates: [...stored.bankRates, { bank: '  ', prime: 6 }] })
    expect(out?.bankRates).toHaveLength(1)
  })

  it('falls back to the מ"צ rate for boards saved before מ"ל existed', () => {
    const legacy = { ...stored, bankRates: [{ ...stored.bankRates[0], variableNotLinked: undefined }] }
    expect(normalizeRatesDoc(legacy)?.bankRates[0].variableNotLinked).toBe(3.2)
  })

  it('replaces out-of-range and non-numeric headline figures with the seed', () => {
    const seed = defaultRatesDoc()
    const out = normalizeRatesDoc({ ...stored, prime: -1, boiRate: 'x', lastCpi: 999 })
    expect(out?.prime).toBe(seed.prime)
    expect(out?.boiRate).toBe(seed.boiRate)
    expect(out?.lastCpi).toBe(seed.lastCpi)
  })

  it('treats a missing timestamp as never saved', () => {
    expect(normalizeRatesDoc({ ...stored, updated_at: 12345 })?.updated_at).toBe('')
  })
})

describe('applyBoiReading', () => {
  it('moves only the headline figures, never the advisor quotes', () => {
    const before = defaultRatesDoc()
    const after = applyBoiReading(before, { prime: 5.75, boiRate: 4.25 })
    expect(after.prime).toBe(5.75)
    expect(after.boiRate).toBe(4.25)
    expect(after.bankRates).toEqual(before.bankRates)
    expect(after.lastCpi).toBe(before.lastCpi)
  })

  it('keeps the current figures when the feed returns nonsense', () => {
    const before = defaultRatesDoc()
    const after = applyBoiReading(before, { prime: NaN, boiRate: 250 })
    expect(after.prime).toBe(before.prime)
    expect(after.boiRate).toBe(before.boiRate)
  })
})

describe('isRatesStale', () => {
  const now = Date.parse('2026-09-05T12:00:00.000Z')

  it('is quiet about a board that was never saved', () => {
    expect(isRatesStale(defaultRatesDoc(), now)).toBe(false)
  })

  it('flags a board older than a week', () => {
    const rates = { ...defaultRatesDoc(), updated_at: new Date(now - RATES_STALE_MS - 1000).toISOString() }
    expect(isRatesStale(rates, now)).toBe(true)
  })

  it('leaves a board saved within the week alone', () => {
    const rates = { ...defaultRatesDoc(), updated_at: new Date(now - RATES_STALE_MS + 1000).toISOString() }
    expect(isRatesStale(rates, now)).toBe(false)
  })

  it('does not flag an unparseable timestamp', () => {
    expect(isRatesStale({ ...defaultRatesDoc(), updated_at: 'yesterday' }, now)).toBe(false)
  })
})

describe('parseRateInput', () => {
  it('accepts a normal rate', () => {
    expect(parseRateInput('4.35', 6)).toBe(4.35)
  })

  it('lets the field be cleared to zero while typing', () => {
    expect(parseRateInput('', 6)).toBe(0)
  })

  it('keeps the previous value rather than writing NaN', () => {
    expect(parseRateInput('-', 6)).toBe(6)
    expect(parseRateInput('abc', 6)).toBe(6)
  })

  it('clamps a fat-fingered value into range', () => {
    expect(parseRateInput('450', 6)).toBe(MAX_RATE)
    expect(parseRateInput('-3', 6)).toBe(0)
  })
})
