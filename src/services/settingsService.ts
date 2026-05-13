import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { fromDoc, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { AdvisorSettings } from '@/types/database'

const SETTINGS_DOC = 'profile'

function settingsRef(uid: string) {
  return doc(db, 'users', uid, 'advisor_settings', SETTINGS_DOC)
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
