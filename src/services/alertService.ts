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
import { fromDoc, fromDocs, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Alert, AlertWithCustomer, Customer, LoanTrack } from '@/types/database'

const COL = 'alerts'

async function attachRelations(alerts: Alert[]): Promise<AlertWithCustomer[]> {
  const customerIds = Array.from(new Set(alerts.map((a) => a.customer_id).filter(Boolean)))
  const trackIds = Array.from(new Set(alerts.map((a) => a.loan_track_id).filter(Boolean) as string[]))

  const customerMap = new Map<string, Customer>()
  const trackMap = new Map<string, LoanTrack>()

  await Promise.all([
    ...customerIds.map(async (cid) => {
      const snap = await getDoc(doc(db, 'customers', cid))
      if (snap.exists()) customerMap.set(cid, fromDoc<Customer>(snap))
    }),
    ...trackIds.map(async (tid) => {
      const snap = await getDoc(doc(db, 'loan_tracks', tid))
      if (snap.exists()) trackMap.set(tid, fromDoc<LoanTrack>(snap))
    }),
  ])

  return alerts.map((a) => ({
    ...a,
    customer: customerMap.get(a.customer_id),
    loan_track: a.loan_track_id ? trackMap.get(a.loan_track_id) : undefined,
  }))
}

export const alertService = {
  async getAll(filters?: { status?: string; urgency?: 'urgent' | 'warning' | 'normal' }): Promise<{ data: AlertWithCustomer[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const constraints: QueryConstraint[] = [where('user_id', '==', uid)]
      if (filters?.status) constraints.push(where('status', '==', filters.status))
      if (filters?.urgency === 'urgent') constraints.push(where('days_until_end', '<', 60))
      else if (filters?.urgency === 'warning') {
        constraints.push(where('days_until_end', '>=', 60), where('days_until_end', '<', 120))
      } else if (filters?.urgency === 'normal') {
        constraints.push(where('days_until_end', '>=', 120))
      }
      constraints.push(orderBy('days_until_end', 'asc'))

      const snap = await getDocs(query(collection(db, COL), ...constraints))
      const alerts = fromDocs<Alert>(snap.docs)
      const data = await attachRelations(alerts)
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
