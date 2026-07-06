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

export const DEFAULT_DTI_MONTHS_THRESHOLD = 18

/**
 * The 18-month rule: an obligation counts toward DTI when it still has more
 * than `thresholdMonths` left to run (or has no end date). Banks ignore
 * obligations that expire within the window because they will not burden the
 * borrower over the mortgage term.
 */
export function shouldIncludeInDti(
  endDate: string | null | undefined,
  thresholdMonths = DEFAULT_DTI_MONTHS_THRESHOLD,
): boolean {
  if (!endDate) return true
  const end = new Date(endDate).getTime()
  if (Number.isNaN(end)) return true
  const cutoff = Date.now() + thresholdMonths * 30.44 * 24 * 60 * 60 * 1000
  return end > cutoff
}

/** Sum of the monthly repayments that actually enter the DTI calculation. */
export function totalMonthlyObligations(obligations: Obligation[]): number {
  return obligations
    .filter(o => o.include_in_dti)
    .reduce((sum, o) => sum + (o.monthly_payment || 0), 0)
}

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
