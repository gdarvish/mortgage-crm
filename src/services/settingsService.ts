import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { fromDoc, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { AdvisorSettings, RatesDoc } from '@/types/database'
import { normalizeRatesDoc } from '@/utils/bankRates'

const SETTINGS_DOC = 'profile'
const RATES_DOC = 'rates'

function settingsRef(uid: string) {
  return doc(db, 'users', uid, 'advisor_settings', SETTINGS_DOC)
}

function ratesRef(uid: string) {
  return doc(db, 'users', uid, 'settings', RATES_DOC)
}

export const settingsService = {
  async get(): Promise<{ data: AdvisorSettings | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDoc(settingsRef(uid))
      if (!snap.exists()) return { data: null, error: null }
      return { data: fromDoc<AdvisorSettings>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async upsert(settings: Partial<AdvisorSettings>): Promise<{ data: AdvisorSettings | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const ref = settingsRef(uid)
      await setDoc(ref, { ...settings, user_id: uid }, { merge: true })
      const snap = await getDoc(ref)
      return { data: fromDoc<AdvisorSettings>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  /**
   * The advisor's own rate board. Returns null when nothing has been saved
   * yet, or when the stored document is too damaged to render — the caller
   * falls back to the seed board in both cases.
   */
  async getRates(): Promise<{ data: RatesDoc | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDoc(ratesRef(uid))
      if (!snap.exists()) return { data: null, error: null }
      return { data: normalizeRatesDoc(snap.data()), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async saveRates(rates: RatesDoc): Promise<{ error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      await setDoc(ratesRef(uid), { ...rates, user_id: uid })
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async uploadLogo(file: File): Promise<{ url: string | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const ext = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${ext}`
      const fileRef = ref(storage, `logos/${uid}/${fileName}`)
      await uploadBytes(fileRef, file)
      const url = await getDownloadURL(fileRef)
      return { url, error: null }
    } catch (e) {
      return { url: null, error: toError(e) }
    }
  },
}
