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
  limit,
  getCountFromServer,
  type QueryConstraint,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, requireUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type {
  Customer,
  CustomerWithRelations,
  Document,
  Mortgage,
  LoanTrack,
  BankResponse,
  Task,
  Message,
  Commission,
  ReferralPartner,
} from '@/types/database'

const COL = 'customers'

function matchesSearch(c: Customer, search: string): boolean {
  const needle = search.toLowerCase()
  return (
    c.first_name.toLowerCase().includes(needle) ||
    c.last_name.toLowerCase().includes(needle) ||
    (c.phone?.toLowerCase().includes(needle) ?? false) ||
    (c.id_number?.toLowerCase().includes(needle) ?? false)
  )
}

export const customerService = {
  async getAll(filters?: { status?: string; search?: string }): Promise<{ data: Customer[] | null; error: FirestoreError | null }> {
    try {
      const uid = requireUserId()
      const constraints: QueryConstraint[] = [where('user_id', '==', uid)]
      if (filters?.status) constraints.push(where('status', '==', filters.status))
      constraints.push(orderBy('created_at', 'desc'))

      const snap = await getDocs(query(collection(db, COL), ...constraints))
      let data = fromDocs<Customer>(snap.docs)
      if (filters?.search) data = data.filter((c) => matchesSearch(c, filters.search!))
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getById(id: string): Promise<{ data: CustomerWithRelations | null; error: FirestoreError | null }> {
    try {
      const customerSnap = await getDoc(doc(db, COL, id))
      if (!customerSnap.exists()) return { data: null, error: null }
      const customer = fromDoc<Customer>(customerSnap)

      const [docsSnap, mortgagesSnap, tasksSnap, messagesSnap, commissionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'documents'), where('customer_id', '==', id), orderBy('uploaded_at', 'desc'))),
        getDocs(query(collection(db, 'mortgages'), where('customer_id', '==', id), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'tasks'), where('customer_id', '==', id), orderBy('due_date', 'asc'))),
        getDocs(query(collection(db, 'messages'), where('customer_id', '==', id), orderBy('sent_at', 'asc'))),
        getDocs(query(collection(db, 'commissions'), where('customer_id', '==', id))),
      ])

      const mortgages = fromDocs<Mortgage>(mortgagesSnap.docs)
      const mortgageIds = mortgages.map((m) => m.id)

      const [tracksSnaps, responsesSnaps] = await Promise.all([
        mortgageIds.length
          ? Promise.all(
              mortgageIds.map((mid) =>
                getDocs(query(collection(db, 'loan_tracks'), where('mortgage_id', '==', mid)))
              )
            )
          : Promise.resolve([]),
        mortgageIds.length
          ? Promise.all(
              mortgageIds.map((mid) =>
                getDocs(query(collection(db, 'bank_responses'), where('mortgage_id', '==', mid)))
              )
            )
          : Promise.resolve([]),
      ])

      const mortgagesWithRelations = mortgages.map((m, idx) => ({
        ...m,
        loan_tracks: tracksSnaps[idx] ? fromDocs<LoanTrack>(tracksSnaps[idx].docs) : [],
        bank_responses: responsesSnaps[idx] ? fromDocs<BankResponse>(responsesSnaps[idx].docs) : [],
      }))

      let referralPartner: ReferralPartner | null = null
      if (customer.referral_partner_id) {
        const rpSnap = await getDoc(doc(db, 'referral_partners', customer.referral_partner_id))
        if (rpSnap.exists()) referralPartner = fromDoc<ReferralPartner>(rpSnap)
      }

      const result: CustomerWithRelations = {
        ...customer,
        documents: fromDocs<Document>(docsSnap.docs),
        mortgages: mortgagesWithRelations,
        tasks: fromDocs<Task>(tasksSnap.docs),
        messages: fromDocs<Message>(messagesSnap.docs),
        commissions: fromDocs<Commission>(commissionsSnap.docs),
        referral_partner: referralPartner,
      }

      return { data: result, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Customer | null; error: FirestoreError | null }> {
    try {
      const uid = requireUserId()
      const payload = {
        ...customer,
        user_id: uid,
        children: customer.children ?? 0,
        existing_obligations: customer.existing_obligations ?? 0,
        questionnaire_completed: customer.questionnaire_completed ?? false,
        status: customer.status ?? 'ליד',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Customer>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Customer>): Promise<{ data: Customer | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, { ...updates, updated_at: serverTimestamp() } as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Customer>(snap), error: null }
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

  async getByQuestionnaireToken(token: string): Promise<{ data: Customer | null; error: FirestoreError | null }> {
    try {
      const q = query(
        collection(db, COL),
        where('questionnaire_token', '==', token),
        limit(1)
      )
      const snap = await getDocs(q)
      if (snap.empty) return { data: null, error: null }
      return { data: fromDoc<Customer>(snap.docs[0]), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getStats(): Promise<{ activeCustomers: number; monthlyDeals: number; weeklyLeads: number }> {
    const uid = requireUserId()
    const now = new Date()
    const startOfMonth = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const startOfWeek = Timestamp.fromDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))

    const colRef = collection(db, COL)
    const [activeRes, monthlyRes, weeklyRes] = await Promise.all([
      getCountFromServer(query(colRef, where('user_id', '==', uid), where('status', '!=', 'ליד'))),
      getCountFromServer(
        query(
          colRef,
          where('user_id', '==', uid),
          where('status', '==', 'סגירה'),
          where('updated_at', '>=', startOfMonth)
        )
      ),
      getCountFromServer(
        query(
          colRef,
          where('user_id', '==', uid),
          where('status', '==', 'ליד'),
          where('created_at', '>=', startOfWeek)
        )
      ),
    ])

    return {
      activeCustomers: activeRes.data().count,
      monthlyDeals: monthlyRes.data().count,
      weeklyLeads: weeklyRes.data().count,
    }
  },
}
