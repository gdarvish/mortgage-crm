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
import { fromDoc, fromDocs, awaitUserId, withUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type {
  Mortgage,
  MortgageWithTracks,
  LoanTrack,
  BankResponse,
} from '@/types/database'

/**
 * Firestore rules are filters-with-teeth, not filters: a query that does not
 * narrow to the caller's own user_id is rejected wholesale with
 * `permission-denied`. Every collection query below must carry it.
 */
async function attachRelations(mortgage: Mortgage, uid: string): Promise<MortgageWithTracks> {
  const [tracksSnap, responsesSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'loan_tracks'),
      where('user_id', '==', uid),
      where('mortgage_id', '==', mortgage.id),
    )),
    getDocs(query(
      collection(db, 'bank_responses'),
      where('user_id', '==', uid),
      where('mortgage_id', '==', mortgage.id),
    )),
  ])
  return {
    ...mortgage,
    loan_tracks: fromDocs<LoanTrack>(tracksSnap.docs),
    bank_responses: fromDocs<BankResponse>(responsesSnap.docs),
  }
}

export const mortgageService = {
  async getByCustomer(customerId: string): Promise<{ data: MortgageWithTracks[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, 'mortgages'),
          where('user_id', '==', uid),
          where('customer_id', '==', customerId),
          orderBy('created_at', 'desc')
        )
      )
      const mortgages = fromDocs<Mortgage>(snap.docs)
      const data = await Promise.all(mortgages.map((m) => attachRelations(m, uid)))
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getById(id: string): Promise<{ data: MortgageWithTracks | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDoc(doc(db, 'mortgages', id))
      if (!snap.exists()) return { data: null, error: null }
      const data = await attachRelations(fromDoc<Mortgage>(snap), uid)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(mortgage: Omit<Mortgage, 'id' | 'created_at'>): Promise<{ data: Mortgage | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...mortgage,
        user_id: uid,
        type: mortgage.type ?? 'חדשה',
        status: mortgage.status ?? 'טיוטה',
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, 'mortgages'), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Mortgage>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Mortgage>): Promise<{ data: Mortgage | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, 'mortgages', id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Mortgage>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async delete(id: string): Promise<{ error: FirestoreError | null }> {
    try {
      await deleteDoc(doc(db, 'mortgages', id))
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async addTrack(track: Omit<LoanTrack, 'id' | 'created_at' | 'user_id'>): Promise<{ data: LoanTrack | null; error: FirestoreError | null }> {
    try {
      const payload = await withUserId({
        ...track,
        is_existing: track.is_existing ?? false,
        created_at: serverTimestamp(),
      })
      const ref = await addDoc(collection(db, 'loan_tracks'), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<LoanTrack>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async updateTrack(id: string, updates: Partial<LoanTrack>): Promise<{ data: LoanTrack | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, 'loan_tracks', id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<LoanTrack>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async deleteTrack(id: string): Promise<{ error: FirestoreError | null }> {
    try {
      await deleteDoc(doc(db, 'loan_tracks', id))
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async addBankResponse(response: Omit<BankResponse, 'id' | 'created_at' | 'user_id'>): Promise<{ data: BankResponse | null; error: FirestoreError | null }> {
    try {
      const payload = await withUserId({
        ...response,
        created_at: serverTimestamp(),
      })
      const ref = await addDoc(collection(db, 'bank_responses'), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<BankResponse>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async deleteBankResponse(id: string): Promise<{ error: FirestoreError | null }> {
    try {
      await deleteDoc(doc(db, 'bank_responses', id))
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },
}
