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
import type { Borrower } from '@/types/database'

const COL = 'borrowers'

/**
 * Household income for DTI: the primary borrower plus any co-borrowers
 * (role 'לווה שני'). Guarantors ('ערב') never add income. Falls back to the
 * customer's legacy partner_income when there are no borrower records yet.
 */
export function totalHouseholdIncome(
  primaryIncome: number | null | undefined,
  partnerIncome: number | null | undefined,
  borrowers: Borrower[],
): number {
  const base = primaryIncome ?? 0
  const coBorrowers = borrowers.filter(b => b.role === 'לווה שני')
  if (coBorrowers.length === 0) return base + (partnerIncome ?? 0)
  return base + coBorrowers.reduce((sum, b) => sum + (b.monthly_income ?? 0), 0)
}

export const borrowerService = {
  async getByCustomer(customerId: string): Promise<{ data: Borrower[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, COL),
          where('user_id', '==', uid),
          where('customer_id', '==', customerId),
          orderBy('created_at', 'asc'),
        )
      )
      return { data: fromDocs<Borrower>(snap.docs), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(borrower: Omit<Borrower, 'id' | 'created_at' | 'user_id'>): Promise<{ data: Borrower | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...borrower,
        user_id: uid,
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Borrower>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Borrower>): Promise<{ data: Borrower | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Borrower>(snap), error: null }
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
