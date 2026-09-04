import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, doc, documentId, getDocs, getCountFromServer,
  orderBy, query, where, limit, updateDoc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDocs, awaitUserId } from '@/services/_firestoreHelpers'
import { settingsService } from '@/services/settingsService'
import { liveDaysLeft, liveUrgency } from '@/utils/alertUrgency'
import type { Customer, CustomerStatus, Task, Alert, Commission, LoanTrack } from '@/types/database'

export type DashboardTask = Task & { customer_name?: string }
export type DashboardAlert = Alert & {
  customer_name?: string
  track_type?: string
  live_days_left: number | null
  live_urgency: NonNullable<Alert['urgency']>
}

export const PIPELINE_STATUSES: CustomerStatus[] = [
  'ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'ביצוע', 'סגירה',
]

/** Open task states, in the order the advisor wants to see them. */
const OPEN_TASK_STATUSES = ['פתוחה', 'בתהליך']

/**
 * How many customers are pulled for the charts. The KPI and pipeline numbers
 * come from server-side counts and are exact at any size; only the lead-source
 * mix and the 12-month histogram read documents, and they say so when the cap
 * bites.
 */
const CHART_CUSTOMER_LIMIT = 500

export interface DashboardData {
  advisorName: string
  /** Most recent customers, capped — for the charts and recent-customer list. */
  customers: Customer[]
  /** True when more customers exist than the charts were computed over. */
  customersTruncated: boolean
  /** Exact, server-side counts — unaffected by the chart cap. */
  totals: {
    customers: number
    dealsThisMonth: number
    newLeadsThisMonth: number
    pipeline: Record<CustomerStatus, number>
  }
  tasks: DashboardTask[]
  alerts: DashboardAlert[]
  commissionTotal: number
}

/**
 * Resolves customer display names for a set of ids in `in` batches rather than
 * one getDoc per row.
 */
async function customerNames(uid: string, ids: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  if (ids.length === 0) return names
  // Firestore caps an `in` filter at 30 values.
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30)
    const snap = await getDocs(query(
      collection(db, 'customers'),
      where('user_id', '==', uid),
      where(documentId(), 'in', chunk),
    ))
    for (const c of fromDocs<Customer>(snap.docs)) {
      names[c.id] = `${c.first_name} ${c.last_name}`
    }
  }
  return names
}

async function trackTypes(uid: string, ids: string[]): Promise<Record<string, string>> {
  const types: Record<string, string> = {}
  if (ids.length === 0) return types
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30)
    const snap = await getDocs(query(
      collection(db, 'loan_tracks'),
      where('user_id', '==', uid),
      where(documentId(), 'in', chunk),
    ))
    for (const t of fromDocs<LoanTrack>(snap.docs)) {
      types[t.id] = t.type || '—'
    }
  }
  return types
}

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      const uid = await awaitUserId()
      const now = new Date()
      // created_at is written with serverTimestamp, so it is a Firestore
      // Timestamp on the server even though fromDoc hands it back as an ISO
      // string; a server-side comparison has to be against a Timestamp.
      const monthStart = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1))

      const customersCol = collection(db, 'customers')
      const countOf = async (...constraints: Parameters<typeof query>[1][]) =>
        (await getCountFromServer(query(customersCol, where('user_id', '==', uid), ...constraints))).data().count

      const [
        customersSnap,
        tasksSnap,
        alertsSnap,
        commissionsSnap,
        settingsRes,
        customerCount,
        dealsThisMonth,
        newLeadsThisMonth,
        pipelineCounts,
      ] = await Promise.all([
        // Bounded and ordered: an advisor's book grows without limit, and an
        // unbounded read grew the dashboard's cost linearly with it.
        getDocs(query(
          customersCol,
          where('user_id', '==', uid),
          orderBy('created_at', 'desc'),
          limit(CHART_CUSTOMER_LIMIT + 1),
        )),
        // Filtered and ordered server-side. Fetching 50 arbitrary tasks and
        // then dropping the completed ones showed an empty list to any advisor
        // whose 50 happened to be done.
        getDocs(query(
          collection(db, 'tasks'),
          where('user_id', '==', uid),
          where('status', 'in', OPEN_TASK_STATUSES),
          orderBy('due_date', 'asc'),
          limit(10),
        )),
        // Ordered before limiting: without an orderBy, Firestore returns 8
        // alerts by document id, so the urgent one could simply be missing.
        getDocs(query(
          collection(db, 'alerts'),
          where('user_id', '==', uid),
          where('status', '==', 'פתוח'),
          orderBy('days_until_end', 'asc'),
          limit(8),
        )),
        getDocs(query(
          collection(db, 'commissions'),
          where('user_id', '==', uid),
          where('status', '==', 'שולם'),
        )),
        settingsService.get(),
        countOf(),
        countOf(where('status', '==', 'סגירה'), where('created_at', '>=', monthStart)),
        countOf(where('status', '==', 'ליד'), where('created_at', '>=', monthStart)),
        Promise.all(PIPELINE_STATUSES.map(async (status) => [
          status, await countOf(where('status', '==', status)),
        ] as const)),
      ])

      const allCustomers = fromDocs<Customer>(customersSnap.docs)
      const customersTruncated = allCustomers.length > CHART_CUSTOMER_LIMIT
      const customers = allCustomers.slice(0, CHART_CUSTOMER_LIMIT)

      const rawTasks = fromDocs<Task>(tasksSnap.docs)
      const rawAlerts = fromDocs<Alert>(alertsSnap.docs)

      // One batched lookup for every name the page needs, instead of a getDoc
      // per task and per alert.
      const referencedCustomerIds = Array.from(new Set([
        ...rawTasks.map((t) => t.customer_id),
        ...rawAlerts.map((a) => a.customer_id),
      ].filter(Boolean) as string[]))
      const alertTrackIds = Array.from(new Set(
        rawAlerts.map((a) => a.loan_track_id).filter(Boolean) as string[],
      ))

      const [names, types] = await Promise.all([
        customerNames(uid, referencedCustomerIds),
        trackTypes(uid, alertTrackIds),
      ])

      const tasks: DashboardTask[] = rawTasks.map((t) => ({
        ...t,
        customer_name: t.customer_id ? names[t.customer_id] : undefined,
      }))

      // The stored days_until_end is a snapshot from creation time, so the
      // dashboard dates its alerts the same way the alerts page does.
      const alerts: DashboardAlert[] = rawAlerts
        .map((a) => {
          const daysLeft = liveDaysLeft(a)
          return {
            ...a,
            customer_name: names[a.customer_id] || 'לא ידוע',
            track_type: a.loan_track_id ? types[a.loan_track_id] || '—' : '—',
            live_days_left: daysLeft,
            live_urgency: liveUrgency(daysLeft),
          }
        })
        .sort((a, b) => (a.live_days_left ?? Infinity) - (b.live_days_left ?? Infinity))

      const commissionTotal = fromDocs<Commission>(commissionsSnap.docs)
        .reduce((sum, c) => sum + (c.amount || 0), 0)

      return {
        advisorName: settingsRes.data?.name || '',
        customers,
        customersTruncated,
        totals: {
          customers: customerCount,
          dealsThisMonth,
          newLeadsThisMonth,
          pipeline: Object.fromEntries(pipelineCounts) as Record<CustomerStatus, number>,
        },
        tasks,
        alerts,
        commissionTotal,
      }
    },
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, 'tasks', id), { status: 'הושלמה' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })
}
