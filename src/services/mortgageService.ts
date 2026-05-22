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
  writeBatch,
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

async function attachRelations(mortgage: Mortgage): Promise<MortgageWithTracks> {
  const [tracksSnap, responsesSnap] = await Promise.all([
    getDocs(query(collection(db, 'loan_tracks'), where('mortgage_id', '==', mortgage.id))),
    getDocs(query(collection(db, 'bank_responses'), where('mortgage_id', '==', mortgage.id))),
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
      const snap = await getDocs(
        query(
          collection(db, 'mortgages'),
          where('customer_id', '==', customerId),
          orderBy('created_at', 'desc')
        )
      )
      const mortgages = fromDocs<Mortgage>(snap.docs)
      const data = await Promise.all(mortgages.map(attachRelations))
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getById(id: string): Promise<{ data: MortgageWithTracks | null; error: FirestoreError | null }> {
    try {
      const snap = await getDoc(doc(db, 'mortgages', id))
      if (!snap.exists()) return { data: null, error: null }
      const data = await attachRelations(fromDoc<Mortgage>(snap))
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

  /** Atomically create a mortgage ("mix") together with all of its loan tracks. */
  async createWithTracks(
    mortgage: Omit<Mortgage, 'id' | 'created_at'>,
    tracks: Omit<LoanTrack, 'id' | 'created_at' | 'user_id' | 'mortgage_id'>[]
  ): Promise<{ data: Mortgage | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const batch = writeBatch(db)
      const mortgageRef = doc(collection(db, 'mortgages'))
      batch.set(mortgageRef, {
        ...mortgage,
        user_id: uid,
        type: mortgage.type ?? 'חדשה',
        status: mortgage.status ?? 'טיוטה',
        created_at: serverTimestamp(),
      })
      for (const track of tracks) {
        const trackRef = doc(collection(db, 'loan_tracks'))
        batch.set(trackRef, {
          ...track,
          mortgage_id: mortgageRef.id,
          user_id: uid,
          is_existing: track.is_existing ?? false,
          created_at: serverTimestamp(),
        })
      }
      await batch.commit()
      const snap = await getDoc(mortgageRef)
      return { data: fromDoc<Mortgage>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  /** Atomically delete a mortgage ("mix") together with its loan tracks. */
  async deleteWithTracks(
    mortgageId: string,
    trackIds: string[]
  ): Promise<{ error: FirestoreError | null }> {
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'mortgages', mortgageId))
      for (const trackId of trackIds) {
        batch.delete(doc(db, 'loan_tracks', trackId))
      }
      await batch.commit()
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
