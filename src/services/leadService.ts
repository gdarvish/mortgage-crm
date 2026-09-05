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
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Lead, Customer } from '@/types/database'

const COL = 'leads'

function matchesSearch(lead: Lead, search: string): boolean {
  const needle = search.toLowerCase()
  return (
    (lead.name?.toLowerCase().includes(needle) ?? false) ||
    (lead.phone?.toLowerCase().includes(needle) ?? false)
  )
}

/**
 * The case notes a converted lead starts with: whatever the advisor wrote on
 * the lead card, plus its score, which has nowhere else to live on a customer.
 */
function leadNotes(lead: Lead): string | null {
  const parts: string[] = []
  if (lead.notes?.trim()) parts.push(lead.notes.trim())
  if (typeof lead.score === 'number' && lead.score > 0) parts.push(`ציון ליד בהמרה: ${lead.score}`)
  return parts.length > 0 ? parts.join('\n\n') : null
}

export const leadService = {
  async getAll(filters?: { status?: string; source?: string; search?: string }): Promise<{ data: Lead[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const constraints: QueryConstraint[] = [where('user_id', '==', uid)]
      if (filters?.status) constraints.push(where('status', '==', filters.status))
      if (filters?.source) constraints.push(where('source', '==', filters.source))
      constraints.push(orderBy('created_at', 'desc'))

      const snap = await getDocs(query(collection(db, COL), ...constraints))
      let data = fromDocs<Lead>(snap.docs)
      if (filters?.search) data = data.filter((l) => matchesSearch(l, filters.search!))
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(lead: Omit<Lead, 'id' | 'created_at'>): Promise<{ data: Lead | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...lead,
        user_id: uid,
        score: lead.score ?? 0,
        status: lead.status ?? 'חדש',
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Lead>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Lead>): Promise<{ data: Lead | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Lead>(snap), error: null }
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

  async convertToCustomer(leadId: string): Promise<{ data: Customer | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const leadRef = doc(db, COL, leadId)
      const leadSnap = await getDoc(leadRef)
      if (!leadSnap.exists()) return { data: null, error: { message: 'Lead not found' } }
      const lead = fromDoc<Lead>(leadSnap)

      // Converting twice would create a second case for the same person. The
      // first one already exists, so hand that back instead.
      if (lead.converted_to_customer_id) {
        const existing = await getDoc(doc(db, 'customers', lead.converted_to_customer_id))
        if (existing.exists()) return { data: fromDoc<Customer>(existing), error: null }
      }

      const nameParts = (lead.name || '').split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const customerPayload = {
        user_id: uid,
        first_name: firstName,
        last_name: lastName,
        phone: lead.phone,
        email: lead.email,
        lead_source: lead.source,
        status: 'ליד',
        children: 0,
        existing_obligations: 0,
        questionnaire_completed: false,
        referral_partner_id: lead.referral_partner_id,
        // Everything the advisor already learned about this person survives the
        // conversion — it used to be left behind on the lead card.
        notes: leadNotes(lead),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }
      // אטומי — יצירת הלקוח ועדכון הליד נשמרים יחד או נכשלים יחד.
      const batch = writeBatch(db)
      const customerRef = doc(collection(db, 'customers'))
      batch.set(customerRef, customerPayload)
      batch.update(leadRef, {
        status: 'הפך ללקוח',
        converted_to_customer_id: customerRef.id,
        converted_at: serverTimestamp(),
      })
      await batch.commit()

      const customerSnap = await getDoc(customerRef)
      return { data: fromDoc<Customer>(customerSnap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },
}
