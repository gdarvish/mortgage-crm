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
import type { Disbursement } from '@/types/database'

const COL = 'disbursements'

export const disbursementService = {
  async getByCustomer(customerId: string): Promise<{ data: Disbursement[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, COL),
          where('user_id', '==', uid),
          where('customer_id', '==', customerId),
          orderBy('due_date', 'asc'),
        )
      )
      return { data: fromDocs<Disbursement>(snap.docs), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(disbursement: Omit<Disbursement, 'id' | 'created_at' | 'user_id'>): Promise<{ data: Disbursement | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...disbursement,
        user_id: uid,
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Disbursement>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Disbursement>): Promise<{ data: Disbursement | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Disbursement>(snap), error: null }
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
