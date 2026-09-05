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
import { ref, uploadBytes, deleteObject } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, storage, functions } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import { validateUploadFile } from '@/services/uploadValidation'
import { getChecklist } from '@/utils/documentChecklist'
import type { Document } from '@/types/database'

const COL = 'documents'

export {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  validateUploadFile,
} from '@/services/uploadValidation'
export { getChecklist } from '@/utils/documentChecklist'

interface DocumentRecord extends Document {
  storage_path?: string | null
}

export const documentService = {
  async getByCustomer(customerId: string): Promise<{ data: Document[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const snap = await getDocs(
        query(
          collection(db, COL),
          where('user_id', '==', uid),
          where('customer_id', '==', customerId),
          orderBy('uploaded_at', 'desc')
        )
      )
      return { data: fromDocs<Document>(snap.docs), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async upload(
    customerId: string,
    file: File,
    type: string,
    category: string
  ): Promise<{ data: Document | null; error: FirestoreError | null }> {
    try {
      const invalid = validateUploadFile(file)
      if (invalid) return { data: null, error: { message: invalid } }

      const uid = await awaitUserId()
      const storagePath = `documents/${customerId}/${Date.now()}-${file.name}`
      const fileRef = ref(storage, storagePath)
      await uploadBytes(fileRef, file)

      const payload = {
        customer_id: customerId,
        user_id: uid,
        type,
        category,
        // No file_url: getDownloadURL's permanent token bypasses storage.rules,
        // so links are minted on demand by getDocumentUrl instead.
        file_url: null,
        file_name: file.name,
        file_size: file.size,
        status: 'ממתין',
        storage_path: storagePath,
        uploaded_at: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(docRef)
      return { data: fromDoc<Document>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  /**
   * A short-lived link to the file, minted per request by the Cloud Function
   * after it re-checks ownership. Nothing durable is ever stored or shared.
   */
  async getUrl(documentId: string): Promise<{ url: string | null; error: FirestoreError | null }> {
    try {
      const fn = httpsCallable(functions, 'getDocumentUrl')
      const res = await fn({ document_id: documentId })
      return { url: (res.data as { url: string }).url, error: null }
    } catch (e) {
      return { url: null, error: toError(e) }
    }
  },

  async updateStatus(id: string, status: string): Promise<{ data: Document | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, { status })
      const snap = await getDoc(ref)
      return { data: fromDoc<Document>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async delete(id: string, _fileUrl?: string): Promise<{ error: FirestoreError | null }> {
    try {
      const docRef = doc(db, COL, id)
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        const record = fromDoc<DocumentRecord>(snap)
        if (record.storage_path) {
          try {
            await deleteObject(ref(storage, record.storage_path))
          } catch {
            // file may already be gone; proceed with metadata delete
          }
        }
      }
      await deleteDoc(docRef)
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  /** The case's document checklist — derived, so it lives in utils. */
  getChecklist,
}
