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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Document } from '@/types/database'

const COL = 'documents'

interface DocumentRecord extends Document {
  storage_path?: string | null
}

export const documentService = {
  async getByCustomer(customerId: string): Promise<{ data: Document[] | null; error: FirestoreError | null }> {
    try {
      const snap = await getDocs(
        query(
          collection(db, COL),
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
    // BUG A2-14: validate file size and MIME type before uploading
    const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (file.size > MAX_SIZE) {
      throw new Error('הקובץ גדול מדי. הגודל המרבי הוא 20MB')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('סוג הקובץ אינו נתמך. ניתן להעלות PDF, תמונות (JPEG/PNG/GIF) או מסמכי Word')
    }
    try {
      const uid = await awaitUserId()
      const storagePath = `documents/${customerId}/${Date.now()}-${file.name}`
      const fileRef = ref(storage, storagePath)
      await uploadBytes(fileRef, file)
      const fileUrl = await getDownloadURL(fileRef)

      const payload = {
        customer_id: customerId,
        user_id: uid,
        type,
        category,
        file_url: fileUrl,
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

  getChecklist(borrowerType: 'שכיר' | 'עצמאי') {
    const baseDocuments = [
      { type: 'תעודת זהות + ספח', category: 'זיהוי' },
      { type: '3 תלושי שכר אחרונים', category: 'הכנסות' },
      { type: '6 דפי חשבון בנק', category: 'חשבון_בנק' },
      { type: 'אישור עבודה / העסקה', category: 'הכנסות' },
      { type: 'הסכם רכישה', category: 'נכס' },
      { type: 'נסח טאבו', category: 'נכס' },
      { type: 'דוח פלאש BDI', category: 'כללי' },
      { type: 'הצהרת הון', category: 'כללי' },
    ]

    const selfEmployedDocuments = [
      { type: '2 דוחות מס שנתיים (1301)', category: 'הכנסות' },
      { type: 'אישור רואה חשבון', category: 'הכנסות' },
      { type: 'חשבון בנק עסקי', category: 'חשבון_בנק' },
      { type: 'ניהול ספרים', category: 'הכנסות' },
      { type: 'תעודת עוסק מורשה', category: 'זיהוי' },
      { type: 'דוח רווח והפסד', category: 'הכנסות' },
    ]

    return borrowerType === 'עצמאי'
      ? [...baseDocuments, ...selfEmployedDocuments]
      : baseDocuments
  },
}
