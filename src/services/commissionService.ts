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
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, loadRelated, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Commission, Customer, Mortgage } from '@/types/database'

const COL = 'commissions'

type CommissionWithRelations = Commission & {
  customer?: { first_name: string; last_name: string }
  mortgage?: { loan_amount: number | null }
}

async function attachRelations(commissions: Commission[]): Promise<CommissionWithRelations[]> {
  const customerIds = Array.from(new Set(commissions.map((c) => c.customer_id).filter(Boolean)))
  const mortgageIds = Array.from(new Set(commissions.map((c) => c.mortgage_id).filter(Boolean) as string[]))

  const customerMap = new Map<string, Customer>()
  const mortgageMap = new Map<string, Mortgage>()

  await Promise.all([
    ...customerIds.map(async (cid) => {
      const c = await loadRelated<Customer>('customers', cid)
      if (c) customerMap.set(cid, c)
    }),
    ...mortgageIds.map(async (mid) => {
      const m = await loadRelated<Mortgage>('mortgages', mid)
      if (m) mortgageMap.set(mid, m)
    }),
  ])

  return commissions.map((c) => {
    const cust = customerMap.get(c.customer_id)
    const mort = c.mortgage_id ? mortgageMap.get(c.mortgage_id) : undefined
    return {
      ...c,
      customer: cust ? { first_name: cust.first_name, last_name: cust.last_name } : undefined,
      mortgage: mort ? { loan_amount: mort.loan_amount } : undefined,
    }
  })
}

export const commissionService = {
  async getAll(filters?: { status?: string; period?: { from: string; to: string } }): Promise<{ data: CommissionWithRelations[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const constraints: QueryConstraint[] = [where('user_id', '==', uid)]
      if (filters?.status) constraints.push(where('status', '==', filters.status))
      if (filters?.period) {
        constraints.push(
          where('created_at', '>=', Timestamp.fromDate(new Date(filters.period.from))),
          where('created_at', '<=', Timestamp.fromDate(new Date(filters.period.to)))
        )
      }
      constraints.push(orderBy('created_at', 'desc'))

      const snap = await getDocs(query(collection(db, COL), ...constraints))
      const commissions = fromDocs<Commission>(snap.docs)
      const data = await attachRelations(commissions)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(commission: Omit<Commission, 'id' | 'created_at'>): Promise<{ data: Commission | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...commission,
        user_id: uid,
        status: commission.status ?? 'ממתין',
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Commission>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Commission>): Promise<{ data: Commission | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Commission>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getStats() {
    const uid = await awaitUserId()
    const now = new Date()
    const startOfMonth = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const startOfYear = Timestamp.fromDate(new Date(now.getFullYear(), 0, 1))

    const colRef = collection(db, COL)
    const [monthlyPaid, yearlyPaid, pending] = await Promise.all([
      getDocs(
        query(
          colRef,
          where('user_id', '==', uid),
          where('status', '==', 'שולם'),
          where('payment_date', '>=', startOfMonth)
        )
      ),
      getDocs(
        query(
          colRef,
          where('user_id', '==', uid),
          where('status', '==', 'שולם'),
          where('payment_date', '>=', startOfYear)
        )
      ),
      getDocs(query(colRef, where('user_id', '==', uid), where('status', '==', 'ממתין'))),
    ])

    const sumAmounts = (docs: Commission[]) =>
      docs.reduce((sum, r) => sum + (r.amount ?? 0), 0)

    return {
      monthlyIncome: sumAmounts(fromDocs<Commission>(monthlyPaid.docs)),
      yearlyIncome: sumAmounts(fromDocs<Commission>(yearlyPaid.docs)),
      pendingAmount: sumAmounts(fromDocs<Commission>(pending.docs)),
    }
  },
}
