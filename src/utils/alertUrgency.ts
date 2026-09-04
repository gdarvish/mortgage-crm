import type { Alert, Document, Mortgage } from '@/types/database'

const DAY_MS = 86_400_000

/**
 * The date an alert is counting down to, by alert type.
 *
 * `days_until_end` on the stored alert is only a snapshot taken when it was
 * written: an alert created 90 days ago with 150 days left still claims 150,
 * and is still classified 'תקין' when 60 remain. Everything user-facing should
 * date the alert from its target instead.
 */
export function alertTargetDate(
  a: Alert,
  documents?: Map<string, Document>,
  mortgages?: Map<string, Mortgage>,
): string | null {
  switch (a.alert_type) {
    case 'document_expiring':
      return (a.document_id ? documents?.get(a.document_id)?.expires_at : null) ?? null
    case 'approval_expiring':
      return (a.mortgage_id ? mortgages?.get(a.mortgage_id)?.approval_expires_at : null) ?? null
    default: {
      const station = (a.metadata as { station_date?: string } | null | undefined)?.station_date
      return a.track_end_date ?? station ?? null
    }
  }
}

/**
 * Days left as of now. Falls back to the stored snapshot only when the alert
 * has no target date at all to count down to.
 */
export function liveDaysLeft(
  a: Alert,
  documents?: Map<string, Document>,
  mortgages?: Map<string, Mortgage>,
): number | null {
  const target = alertTargetDate(a, documents, mortgages)
  const time = target ? new Date(target).getTime() : NaN
  if (Number.isNaN(time)) return a.days_until_end ?? null
  return Math.round((time - Date.now()) / DAY_MS)
}

export function liveUrgency(days: number | null): NonNullable<Alert['urgency']> {
  if (days === null) return 'תקין'
  return days < 60 ? 'דחוף' : days < 120 ? 'אזהרה' : 'תקין'
}
