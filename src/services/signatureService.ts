import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateToken, tokenExpiration } from '@/lib/utils'
import { fromDocs, withUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Signature } from '@/types/database'

export const signatureService = {
  async createRequest(req: {
    customer_id: string
    customer_name: string
    document_name: string
    document_type?: string
  }): Promise<{ data: { id: string; url: string; token: string } | null; error: FirestoreError | null }> {
    try {
      const token = generateToken()
      const payload = await withUserId({
        customer_id: req.customer_id,
        customer_name: req.customer_name,
        document_name: req.document_name,
        document_type: req.document_type ?? null,
        token,
        token_expires_at: tokenExpiration(14),
        status: 'ממתין',
        signature_url: null,
        signed_at: null,
        created_at: serverTimestamp(),
      })
      const ref = await addDoc(collection(db, 'signatures'), payload)
      const url = `${window.location.origin}/sign/${token}`
      return { data: { id: ref.id, url, token }, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async listByCustomer(customerId: string): Promise<{ data: Signature[] | null; error: FirestoreError | null }> {
    try {
      const snap = await getDocs(query(collection(db, 'signatures'), where('customer_id', '==', customerId)))
      return { data: fromDocs<Signature>(snap.docs), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },
}
