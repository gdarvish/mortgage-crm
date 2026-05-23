import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { fromDoc, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { AdvisorSettings } from '@/types/database'

const SETTINGS_DOC = 'profile'
const RATES_DOC = 'rates'

function settingsRef(uid: string) {
  return doc(db, 'users', uid, 'advisor_settings', SETTINGS_DOC)
}

function ratesRef(uid: string) {
  return doc(db, 'users', uid, 'settings', RATES_DOC)
}

export interface BankRate {
  bank: string
  prime: number
  fixedNonLinked: number // קל"צ
  fixedLinked: number // קל"ב
  variableLinked: number // מ"צ
  variableNotLinked: number // מ"ל
}

export interface RatesDoc {
  bankRates: BankRate[]
  prime: number
  boiRate: number
  lastCpi: number
  updated_at: string
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

  async getRates(): Promise<{ data: RatesDoc | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDoc(ratesRef(uid))
      if (!snap.exists()) return { data: null, error: null }
      return { data: fromDoc<RatesDoc>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async saveRates(rates: RatesDoc): Promise<{ error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload: RatesDoc = { ...rates, updated_at: new Date().toISOString() }
      await setDoc(ratesRef(uid), payload, { merge: true })
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async uploadLogo(file: File, existingUrl?: string): Promise<{ url: string | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      // A5-04: delete old logo blob before uploading a new one
      if (existingUrl) {
        try {
          const oldRef = ref(storage, existingUrl)
          await deleteObject(oldRef)
        } catch {
          // ignore — orphan cleanup is best-effort
        }
      }
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
