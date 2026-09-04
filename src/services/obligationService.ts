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
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Obligation } from '@/types/database'

const COL = 'obligations'

/**
 * The DTI helpers are pure and live in @/utils/dti so that they can be tested
 * and reused without pulling in the Firebase client. Re-exported here because
 * callers naturally reach for them alongside the service.
 */
export {
  DEFAULT_DTI_MONTHS_THRESHOLD,
  shouldIncludeInDti,
  isCountedInDti,
  monthsUntilEnd,
  totalMonthlyObligations,
} from '@/utils/dti'

export const obligationService = {
  async getByCustomer(customerId: string): Promise<{ data: Obligation[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, COL),
          where('user_id', '==', uid),
          where('customer_id', '==', customerId),
          orderBy('created_at', 'desc'),
        )
      )
      return { data: fromDocs<Obligation>(snap.docs), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(obligation: Omit<Obligation, 'id' | 'created_at' | 'user_id'>): Promise<{ data: Obligation | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...obligation,
        user_id: uid,
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Obligation>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Obligation>): Promise<{ data: Obligation | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Obligation>(snap), error: null }
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
