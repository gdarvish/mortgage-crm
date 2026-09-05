import { describe, it, expect } from 'vitest'
import { alertTargetDate, liveDaysLeft, liveUrgency } from './alertUrgency'
import type { Alert, Document, Mortgage } from '@/types/database'

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

function alert(over: Partial<Alert>): Alert {
  return {
    id: 'a1',
    user_id: 'u1',
    customer_id: 'c1',
    loan_track_id: 't1',
    alert_type: 'track_ending',
    alert_date: null,
    days_until_end: null,
    status: 'פתוח',
    snoozed_until: null,
    created_at: new Date().toISOString(),
    ...over,
  }
}

describe('liveDaysLeft', () => {
  it('recomputes from the track end date, ignoring the stored snapshot', () => {
    // Written 90 days ago with 150 days left; 60 remain today.
    const a = alert({ days_until_end: 150, track_end_date: inDays(60) })
    expect(liveDaysLeft(a)).toBe(60)
  })

  it('reclassifies a stale "תקין" alert as "דחוף"', () => {
    const a = alert({ days_until_end: 150, urgency: 'תקין', track_end_date: inDays(59) })
    expect(liveUrgency(liveDaysLeft(a))).toBe('דחוף')
  })

  it('dates a document alert from the document expiry', () => {
    const a = alert({ alert_type: 'document_expiring', document_id: 'd1', days_until_end: 30 })
    const documents = new Map<string, Document>([
      ['d1', { expires_at: inDays(5) } as Document],
    ])
    expect(liveDaysLeft(a, documents)).toBe(5)
    expect(liveUrgency(liveDaysLeft(a, documents))).toBe('דחוף')
  })

  it('dates an approval alert from the mortgage approval expiry', () => {
    const a = alert({ alert_type: 'approval_expiring', mortgage_id: 'm1', days_until_end: 30 })
    const mortgages = new Map<string, Mortgage>([
      ['m1', { approval_expires_at: inDays(12) } as Mortgage],
    ])
    expect(liveDaysLeft(a, undefined, mortgages)).toBe(12)
  })

  it('dates a refinance station alert from its metadata', () => {
    const a = alert({ alert_type: 'refinance_opportunity', metadata: { station_date: inDays(45) } })
    expect(liveDaysLeft(a)).toBe(45)
  })

  it('falls back to the stored snapshot with no target date', () => {
    expect(liveDaysLeft(alert({ days_until_end: 42 }))).toBe(42)
  })

  it('returns null when there is neither a target nor a snapshot', () => {
    expect(liveDaysLeft(alert({}))).toBeNull()
  })

  it('goes negative once the target has passed', () => {
    expect(liveDaysLeft(alert({ track_end_date: inDays(-10) }))).toBe(-10)
  })

  it('resolves the target date it uses', () => {
    const end = inDays(30)
    expect(alertTargetDate(alert({ track_end_date: end }))).toBe(end)
  })
})

describe('liveUrgency', () => {
  it('bands at 60 and 120 days', () => {
    expect(liveUrgency(59)).toBe('דחוף')
    expect(liveUrgency(60)).toBe('אזהרה')
    expect(liveUrgency(119)).toBe('אזהרה')
    expect(liveUrgency(120)).toBe('תקין')
    expect(liveUrgency(null)).toBe('תקין')
  })
})
