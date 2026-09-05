import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  getCountFromServer,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, loadRelated, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import { liveDaysLeft, liveUrgency } from '@/utils/alertUrgency'
import type { Alert, AlertWithCustomer, Customer, LoanTrack, Document, Mortgage } from '@/types/database'

const COL = 'alerts'

const URGENCY_LABELS = {
  urgent: 'דחוף',
  warning: 'אזהרה',
  normal: 'תקין',
} as const

async function attachRelations(alerts: Alert[]): Promise<AlertWithCustomer[]> {
  const customerIds = Array.from(new Set(alerts.map((a) => a.customer_id).filter(Boolean)))
  const trackIds = Array.from(new Set(alerts.map((a) => a.loan_track_id).filter(Boolean) as string[]))
  const documentIds = Array.from(new Set(alerts.map((a) => a.document_id).filter(Boolean) as string[]))
  const mortgageIds = Array.from(new Set(alerts.map((a) => a.mortgage_id).filter(Boolean) as string[]))

  const customerMap = new Map<string, Customer>()
  const trackMap = new Map<string, LoanTrack>()
  const documentMap = new Map<string, Document>()
  const mortgageMap = new Map<string, Mortgage>()

  // Single-document reads, so ownership is enforced per document by the rules
  // rather than a user_id filter. A document that is missing or not ours must
  // not sink the whole list — the alert simply keeps whatever it can be dated
  // from — which is what loadRelated guarantees.
  const load = async <T>(col: string, id: string, into: Map<string, T>) => {
    const value = await loadRelated<T>(col, id)
    if (value) into.set(id, value)
  }

  await Promise.all([
    ...customerIds.map((cid) => load<Customer>('customers', cid, customerMap)),
    ...trackIds.map((tid) => load<LoanTrack>('loan_tracks', tid, trackMap)),
    ...documentIds.map((did) => load<Document>('documents', did, documentMap)),
    ...mortgageIds.map((mid) => load<Mortgage>('mortgages', mid, mortgageMap)),
  ])

  return alerts.map((a) => {
    const daysLeft = liveDaysLeft(a, documentMap, mortgageMap)
    return {
      ...a,
      customer: customerMap.get(a.customer_id),
      loan_track: a.loan_track_id ? trackMap.get(a.loan_track_id) : undefined,
      live_days_left: daysLeft,
      live_urgency: liveUrgency(daysLeft),
    }
  })
}

export const alertService = {
  async getAll(filters?: { status?: string; urgency?: 'urgent' | 'warning' | 'normal' }): Promise<{ data: AlertWithCustomer[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const constraints: QueryConstraint[] = [where('user_id', '==', uid)]
      if (filters?.status) constraints.push(where('status', '==', filters.status))
      // Urgency is no longer filtered server-side: the stored days_until_end it
      // used to key off is stale by construction. The query shape stays
      // user_id + status + orderBy(days_until_end), which the existing index
      // already covers; urgency is applied below against the live value.
      constraints.push(orderBy('days_until_end', 'asc'))

      const snap = await getDocs(query(collection(db, COL), ...constraints))
      const alerts = fromDocs<Alert>(snap.docs)
      const withRelations = await attachRelations(alerts)
      const wanted = filters?.urgency && URGENCY_LABELS[filters.urgency]
      const data = (wanted ? withRelations.filter(a => a.live_urgency === wanted) : withRelations)
        .sort((a, b) => (a.live_days_left ?? Infinity) - (b.live_days_left ?? Infinity))
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Alert>): Promise<{ data: Alert | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Alert>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async snooze(id: string, until: string) {
    return this.update(id, { snoozed_until: until, status: 'נדחה' })
  },

  async markHandled(id: string) {
    return this.update(id, { status: 'טופל', handled_at: new Date().toISOString() })
  },

  async getActiveCount(): Promise<{ count: number; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const res = await getCountFromServer(
        query(collection(db, COL), where('user_id', '==', uid), where('status', '==', 'פתוח'))
      )
      return { count: res.data().count, error: null }
    } catch (e) {
      return { count: 0, error: toError(e) }
    }
  },
}
