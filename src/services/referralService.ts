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
import { fromDoc, fromDocs, requireUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { ReferralPartner } from '@/types/database'

const COL = 'referral_partners'

export const referralService = {
  async getAll(): Promise<{ data: ReferralPartner[] | null; error: FirestoreError | null }> {
    try {
      const uid = requireUserId()
      const q = query(
        collection(db, COL),
        where('user_id', '==', uid),
        orderBy('total_referrals', 'desc')
      )
      const snap = await getDocs(q)
      return { data: fromDocs<ReferralPartner>(snap.docs), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getById(id: string): Promise<{ data: ReferralPartner | null; error: FirestoreError | null }> {
    try {
      const snap = await getDoc(doc(db, COL, id))
      if (!snap.exists()) return { data: null, error: null }
      return { data: fromDoc<ReferralPartner>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(partner: Omit<ReferralPartner, 'id' | 'created_at'>): Promise<{ data: ReferralPartner | null; error: FirestoreError | null }> {
    try {
      const uid = requireUserId()
      const payload = {
        ...partner,
        user_id: uid,
        total_referrals: partner.total_referrals ?? 0,
        converted_referrals: partner.converted_referrals ?? 0,
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<ReferralPartner>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<ReferralPartner>): Promise<{ data: ReferralPartner | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<ReferralPartner>(snap), error: null }
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

  async getWithStats() {
    const { data: partners, error } = await this.getAll()
    if (error || !partners) return { data: null, error }

    const withStats = partners.map((p) => ({
      ...p,
      conversionRate:
        p.total_referrals > 0
          ? Math.round((p.converted_referrals / p.total_referrals) * 100)
          : 0,
    }))

    return { data: withStats, error: null }
  },
}
