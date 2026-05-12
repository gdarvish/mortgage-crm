import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, requireUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Message } from '@/types/database'

const COL = 'messages'

export const messageService = {
  async getByCustomer(customerId: string): Promise<{ data: Message[] | null; error: FirestoreError | null }> {
    try {
      const snap = await getDocs(
        query(collection(db, COL), where('customer_id', '==', customerId))
      )
      const data = fromDocs<Message>(snap.docs)
        .sort((a, b) => new Date(a.sent_at || 0).getTime() - new Date(b.sent_at || 0).getTime())
      return { data, error: null }
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

  async create(message: Omit<Message, 'id' | 'sent_at'>): Promise<{ data: Message | null; error: FirestoreError | null }> {
    try {
      const uid = requireUserId()
      const payload = {
        ...message,
        user_id: uid,
        sent_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Message>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  sendWhatsApp(phone: string, message: string) {
    const cleanPhone = phone.replace(/\D/g, '')
    const israelPhone = cleanPhone.startsWith('0')
      ? '972' + cleanPhone.slice(1)
      : cleanPhone
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/${israelPhone}?text=${encoded}`, '_blank')
  },

  getTemplates() {
    return [
      {
        id: 'questionnaire',
        name: 'שלח שאלון',
        template: 'שלום {name}, אני {advisor}. שלחתי לך שאלון קצר לפני הפגישה שלנו. אשמח אם תמלא אותו: {link}',
      },
      {
        id: 'document_request',
        name: 'בקשת מסמך',
        template: 'שלום {name}, על מנת להתקדם בתהליך, אשמח לקבל את המסמכים הבאים: {documents}',
      },
      {
        id: 'status_update',
        name: 'עדכון סטטוס',
        template: 'שלום {name}, רציתי לעדכן אותך שהתיק שלך נמצא כעת בשלב: {status}. {notes}',
      },
      {
        id: 'meeting_reminder',
        name: 'תזכורת פגישה',
        template: 'שלום {name}, תזכורת לפגישה שלנו מחר בשעה {time}. נתראה!',
      },
    ]
  },
}
