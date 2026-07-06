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

  /**
   * Builds the document checklist. Identity and income documents are duplicated
   * per borrower with a name suffix; property documents are collected once for
   * the whole case.
   */
  getChecklist(borrowers: { name: string; employmentType: 'שכיר' | 'עצמאי' }[]): { type: string; category: string }[] {
    const perBorrowerSalaried = [
      { type: 'תעודת זהות + ספח', category: 'זיהוי' },
      { type: '3 תלושי שכר אחרונים', category: 'הכנסות' },
      { type: '6 דפי חשבון בנק', category: 'חשבון_בנק' },
      { type: 'אישור עבודה / העסקה', category: 'הכנסות' },
    ]
    const perBorrowerSelfEmployed = [
      { type: 'תעודת זהות + ספח', category: 'זיהוי' },
      { type: '6 דפי חשבון בנק', category: 'חשבון_בנק' },
      { type: '2 דוחות מס שנתיים (1301)', category: 'הכנסות' },
      { type: 'אישור רואה חשבון', category: 'הכנסות' },
      { type: 'חשבון בנק עסקי', category: 'חשבון_בנק' },
      { type: 'ניהול ספרים', category: 'הכנסות' },
      { type: 'תעודת עוסק מורשה', category: 'זיהוי' },
      { type: 'דוח רווח והפסד', category: 'הכנסות' },
    ]
    // Property / case-level documents — collected once regardless of borrowers.
    const caseDocuments = [
      { type: 'הסכם רכישה', category: 'נכס' },
      { type: 'נסח טאבו', category: 'נכס' },
      { type: 'דוח פלאש BDI', category: 'כללי' },
      { type: 'הצהרת הון', category: 'כללי' },
    ]

    const list = borrowers.length > 0 ? borrowers : [{ name: '', employmentType: 'שכיר' as const }]
    const multiple = list.length > 1
    const perBorrower = list.flatMap(b => {
      const docs = b.employmentType === 'עצמאי' ? perBorrowerSelfEmployed : perBorrowerSalaried
      return docs.map(d => ({
        type: multiple && b.name ? `${d.type} — ${b.name}` : d.type,
        category: d.category,
      }))
    })

    return [...perBorrower, ...caseDocuments]
  },
}
