import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Meeting, Customer } from '@/types/database'

const COL = 'meetings'

export type MeetingWithCustomer = Meeting & { customer?: { first_name: string; last_name: string } }

async function attachCustomerNames(meetings: Meeting[]): Promise<MeetingWithCustomer[]> {
  const ids = Array.from(new Set(meetings.map(m => m.customer_id).filter(Boolean) as string[]))
  if (ids.length === 0) return meetings
  const map = new Map<string, { first_name: string; last_name: string }>()
  await Promise.all(ids.map(async cid => {
    const snap = await getDoc(doc(db, 'customers', cid))
    if (snap.exists()) {
      const c = fromDoc<Customer>(snap)
      map.set(cid, { first_name: c.first_name, last_name: c.last_name })
    }
  }))
  return meetings.map(m => ({ ...m, customer: m.customer_id ? map.get(m.customer_id) : undefined }))
}

export const meetingService = {
  async getAll(): Promise<{ data: MeetingWithCustomer[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(collection(db, COL), where('user_id', '==', uid), orderBy('starts_at', 'asc'))
      )
      const data = await attachCustomerNames(fromDocs<Meeting>(snap.docs))
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getToday(): Promise<{ data: MeetingWithCustomer[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(); end.setHours(23, 59, 59, 999)
      const snap = await getDocs(
        query(
          collection(db, COL),
          where('user_id', '==', uid),
          where('starts_at', '>=', Timestamp.fromDate(start).toDate().toISOString()),
          where('starts_at', '<=', Timestamp.fromDate(end).toDate().toISOString()),
          orderBy('starts_at', 'asc'),
        )
      )
      const data = await attachCustomerNames(fromDocs<Meeting>(snap.docs))
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(meeting: Omit<Meeting, 'id' | 'created_at' | 'user_id' | 'reminder_sent'>): Promise<{ data: Meeting | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...meeting,
        user_id: uid,
        reminder_sent: false,
        duration_minutes: meeting.duration_minutes || 60,
        status: meeting.status ?? 'מתוכננת',
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Meeting>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Meeting>): Promise<{ data: Meeting | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Meeting>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async delete(id: string): Promise<{ error: FirestoreError | null }> {
    try {
      await deleteDoc(doc(db, COL, id))
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },
}
