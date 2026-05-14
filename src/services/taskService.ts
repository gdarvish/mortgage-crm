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
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import type { Task, Customer } from '@/types/database'

const COL = 'tasks'

type TaskWithCustomer = Task & { customer?: { first_name: string; last_name: string } }

async function attachCustomerNames(tasks: Task[]): Promise<TaskWithCustomer[]> {
  const customerIds = Array.from(new Set(tasks.map((t) => t.customer_id).filter(Boolean) as string[]))
  if (customerIds.length === 0) return tasks
  const customerMap = new Map<string, { first_name: string; last_name: string }>()
  await Promise.all(
    customerIds.map(async (cid) => {
      const snap = await getDoc(doc(db, 'customers', cid))
      if (snap.exists()) {
        const c = fromDoc<Customer>(snap)
        customerMap.set(cid, { first_name: c.first_name, last_name: c.last_name })
      }
    })
  )
  return tasks.map((t) => ({
    ...t,
    customer: t.customer_id ? customerMap.get(t.customer_id) : undefined,
  }))
}

export const taskService = {
  async getAll(filters?: { status?: string; customerId?: string; dueDate?: string }): Promise<{ data: TaskWithCustomer[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const constraints: QueryConstraint[] = [where('user_id', '==', uid)]
      if (filters?.status) constraints.push(where('status', '==', filters.status))
      if (filters?.customerId) constraints.push(where('customer_id', '==', filters.customerId))
      if (filters?.dueDate) constraints.push(where('due_date', '<=', Timestamp.fromDate(new Date(filters.dueDate))))
      constraints.push(orderBy('due_date', 'asc'))

      const snap = await getDocs(query(collection(db, COL), ...constraints))
      const tasks = fromDocs<Task>(snap.docs)
      const data = await attachCustomerNames(tasks)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getTodayTasks(): Promise<{ data: TaskWithCustomer[] | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)

      const snap = await getDocs(
        query(
          collection(db, COL),
          where('user_id', '==', uid),
          where('status', '!=', 'הושלמה'),
          where('due_date', '<=', Timestamp.fromDate(endOfDay))
        )
      )
      const tasks = fromDocs<Task>(snap.docs).sort((a, b) => {
        const order = { 'דחופה': 3, 'גבוהה': 2, 'בינונית': 1, 'נמוכה': 0 } as const
        return (order[b.priority] ?? 0) - (order[a.priority] ?? 0)
      })
      const data = await attachCustomerNames(tasks)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async create(task: Omit<Task, 'id' | 'created_at'>): Promise<{ data: Task | null; error: FirestoreError | null }> {
    try {
      const uid = await awaitUserId()
      const payload = {
        ...task,
        user_id: uid,
        priority: task.priority ?? 'בינונית',
        status: task.status ?? 'פתוחה',
        created_at: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, COL), payload)
      const snap = await getDoc(ref)
      return { data: fromDoc<Task>(snap), error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async update(id: string, updates: Partial<Task>): Promise<{ data: Task | null; error: FirestoreError | null }> {
    try {
      const ref = doc(db, COL, id)
      await updateDoc(ref, updates as Record<string, unknown>)
      const snap = await getDoc(ref)
      return { data: fromDoc<Task>(snap), error: null }
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
}
