import { describe, it, expect } from 'vitest'
import {
  validateIsraeliId,
  validateIsraeliPhone,
  normalizePhone,
  validateEmail,
  validatePersonalForm,
} from './israeliValidations'

describe('validateIsraeliId', () => {
  it('validates known valid ID', () => {
    expect(validateIsraeliId('123456782')).toBe(true)
  })

  it('pads short IDs with leading zeros', () => {
    expect(validateIsraeliId('12345678')).toBe(false)
    expect(validateIsraeliId('000000018')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateIsraeliId('')).toBe(false)
  })

  it('rejects alphabetic input', () => {
    expect(validateIsraeliId('abcdefghi')).toBe(false)
  })

  it('rejects ID with wrong checksum', () => {
    expect(validateIsraeliId('123456789')).toBe(false)
  })

  it('strips whitespace and dashes', () => {
    expect(validateIsraeliId('12345 6782')).toBe(true)
    expect(validateIsraeliId('123-456-782')).toBe(true)
  })

  it('rejects more than 9 digits', () => {
    expect(validateIsraeliId('1234567890')).toBe(false)
  })
})

describe('validateIsraeliPhone', () => {
  it('accepts valid mobile number 050', () => {
    expect(validateIsraeliPhone('0501234567')).toBe(true)
  })

  it('accepts valid mobile number 054', () => {
    expect(validateIsraeliPhone('054-1234567')).toBe(true)
  })

  it('accepts valid landline 02', () => {
    expect(validateIsraeliPhone('02-1234567')).toBe(true)
  })

  it('accepts international format 972', () => {
    expect(validateIsraeliPhone('972501234567')).toBe(true)
  })

  it('accepts +972 with spaces', () => {
    expect(validateIsraeliPhone('+972-50-123-4567')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateIsraeliPhone('')).toBe(false)
  })

  it('rejects too short number', () => {
    expect(validateIsraeliPhone('050123')).toBe(false)
  })

  it('rejects non-Israeli prefix', () => {
    expect(validateIsraeliPhone('0601234567')).toBe(false)
  })
})

describe('normalizePhone', () => {
  it('converts 0-prefix to 972', () => {
    expect(normalizePhone('0501234567')).toBe('972501234567')
  })

  it('keeps 972-prefix unchanged', () => {
    expect(normalizePhone('972501234567')).toBe('972501234567')
  })

  it('strips non-digit chars', () => {
    expect(normalizePhone('050-123-4567')).toBe('972501234567')
  })
})

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.co.il')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false)
  })

  it('rejects missing @', () => {
    expect(validateEmail('testexample.com')).toBe(false)
  })

  it('rejects missing TLD', () => {
    expect(validateEmail('test@example')).toBe(false)
  })

  it('rejects with spaces', () => {
    expect(validateEmail('test @example.com')).toBe(false)
  })
})

describe('validatePersonalForm', () => {
  it('returns no errors for valid form', () => {
    const errors = validatePersonalForm({
      id_number: '123456782',
      phone: '0501234567',
      email: 'test@example.com',
      first_name: 'ישראל',
      last_name: 'ישראלי',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('skips empty optional fields', () => {
    const errors = validatePersonalForm({})
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns error for invalid ID', () => {
    const errors = validatePersonalForm({ id_number: '111111111' })
    expect(errors.id_number).toBeDefined()
  })

  it('returns error for short first name', () => {
    const errors = validatePersonalForm({ first_name: 'א' })
    expect(errors.first_name).toBeDefined()
  })

  it('returns error for invalid phone', () => {
    const errors = validatePersonalForm({ phone: '1234' })
    expect(errors.phone).toBeDefined()
  })

  it('returns error for invalid email', () => {
    const errors = validatePersonalForm({ email: 'not-email' })
    expect(errors.email).toBeDefined()
  })

  it('returns multiple errors at once', () => {
    const errors = validatePersonalForm({
      id_number: 'abc',
      phone: '123',
      email: 'bad',
      first_name: 'a',
      last_name: '',
    })
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(4)
  })
})
