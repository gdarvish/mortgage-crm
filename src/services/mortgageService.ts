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
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, withUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type {
  Mortgage,
  MortgageWithTracks,
  MortgageSource,
  MortgageVersionSnapshot,
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
        version: mortgage.version ?? 1,
        version_label: mortgage.version_label ?? null,
        parent_mortgage_id: mortgage.parent_mortgage_id ?? null,
        source: mortgage.source ?? 'advisor',
        snapshot: mortgage.snapshot ?? null,
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

  /**
   * Creates the next version of a mix on a case.
   *
   * A version is never edited in place: an advisor negotiating with a bank
   * needs to show what was asked for, what came back, and what was agreed, so
   * each round is its own record pointing at the one it came from. The
   * snapshot is frozen at creation — a version must not re-price itself when
   * market rates move.
   */
  async createVersion(input: {
    customerId: string
    /** The version this one is derived from; null for the first. */
    parent: Mortgage | null
    label: string | null
    source: MortgageSource
    propertyPrice: number | null
    propertyType: Mortgage['property_type']
    ownCapital: number | null
    loanAmount: number
    status?: Mortgage['status']
    snapshot: MortgageVersionSnapshot
    tracks: Omit<LoanTrack, 'id' | 'created_at' | 'user_id' | 'mortgage_id'>[]
  }): Promise<{ data: Mortgage | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      // Version numbers run per case, so a new one always sits above every
      // existing version rather than above its own parent only.
      const existing = await getDocs(query(
        collection(db, 'mortgages'),
        where('user_id', '==', uid),
        where('customer_id', '==', input.customerId),
      ))
      const highest = fromDocs<Mortgage>(existing.docs)
        .reduce((max, m) => Math.max(max, m.version ?? 1), 0)

      const { data: mortgage, error } = await this.create({
        customer_id: input.customerId,
        type: input.parent?.type ?? 'חדשה',
        property_price: input.propertyPrice,
        property_type: input.propertyType,
        own_capital: input.ownCapital,
        loan_amount: input.loanAmount,
        status: input.status ?? 'טיוטה',
        compliance_status: null,
        notes: null,
        version: highest + 1,
        version_label: input.label,
        parent_mortgage_id: input.parent?.id ?? null,
        source: input.source,
        snapshot: input.snapshot,
      })
      if (error || !mortgage) return { data: null, error: error ?? { message: 'יצירת גרסה נכשלה' } }

      const { error: tracksError } = await this.replaceTracks(mortgage.id, input.tracks)
      if (tracksError) return { data: null, error: tracksError }
      return { data: mortgage, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  /**
   * Replace a mortgage's whole track set in one atomic batch.
   *
   * Saving an edited mix is a replace, not an append: deleting the old tracks
   * and adding the new ones as separate calls can leave the case with a
   * half-written mix if the tab is closed midway, so both halves go into a
   * single writeBatch.
   */
  async replaceTracks(
    mortgageId: string,
    tracks: Omit<LoanTrack, 'id' | 'created_at' | 'user_id' | 'mortgage_id'>[],
  ): Promise<{ error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const existing = await getDocs(query(
        collection(db, 'loan_tracks'),
        where('user_id', '==', uid),
        where('mortgage_id', '==', mortgageId),
      ))
      const batch = writeBatch(db)
      existing.docs.forEach((d) => batch.delete(d.ref))
      for (const track of tracks) {
        batch.set(doc(collection(db, 'loan_tracks')), {
          ...track,
          user_id: uid,
          mortgage_id: mortgageId,
          is_existing: track.is_existing ?? false,
          created_at: serverTimestamp(),
        })
      }
      await batch.commit()
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
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
