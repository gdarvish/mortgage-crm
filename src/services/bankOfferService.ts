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
import { calculateMonthlyPayment, calculateTotalPayment } from '@/utils/mortgageCalculations'
import type { BankOffer } from '@/types/database'

const COL = 'bank_offers'

/** Monthly payment and total cost across all tracks of an offer. */
export function offerTotals(offer: BankOffer) {
  const monthly = offer.tracks.reduce(
    (s, t) => s + calculateMonthlyPayment(t.amount, t.interest_rate, t.period_months), 0
  )
  const total = offer.tracks.reduce(
    (s, t) => s + calculateTotalPayment(t.amount, t.interest_rate, t.period_months), 0
  )
  return { monthly: Math.round(monthly), total: Math.round(total) }
}

/** Latest round per bank, most-improved offer surfaced for comparison. */
export function latestOffersPerBank(offers: BankOffer[]): BankOffer[] {
  const byBank = new Map<string, BankOffer>()
  for (const o of offers) {
    const current = byBank.get(o.bank_name)
    if (!current || o.round > current.round) byBank.set(o.bank_name, o)
  }
  return Array.from(byBank.values())
}

export const bankOfferService = {
  async getByMortgage(mortgageId: string): Promise<{ data: BankOffer[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, COL),
          where('user_id', '==', uid),
          where('mortgage_id', '==', mortgageId),
          orderBy('created_at', 'desc'),
        )
      )
      return { data: fromDocs<BankOffer>(snap.docs), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(offer: Omit<BankOffer, 'id' | 'created_at' | 'user_id'>): Promise<{ data: BankOffer | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...offer,
        user_id: uid,
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<BankOffer>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<BankOffer>): Promise<{ data: BankOffer | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<BankOffer>(snap), error: null }
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
