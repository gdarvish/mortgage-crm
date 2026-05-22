import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, query, where, limit, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDoc, fromDocs, awaitUserId } from '@/services/_firestoreHelpers'
import { settingsService } from '@/services/settingsService'
import type { Customer, Task, Alert, Commission, LoanTrack } from '@/types/database'

export type DashboardTask = Task & { customer_name?: string }
export type DashboardAlert = Alert & { customer_name?: string; track_type?: string }

export interface DashboardData {
  advisorName: string
  customers: Customer[]
  tasks: DashboardTask[]
  alerts: DashboardAlert[]
  commissionTotal: number
}

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      const uid = await awaitUserId()

      const [customersSnap, tasksSnap, alertsSnap, commissionsSnap, settingsRes] = await Promise.all([
        getDocs(query(collection(db, 'customers'), where('user_id', '==', uid))),
        getDocs(query(collection(db, 'tasks'), where('user_id', '==', uid), limit(50))),
        getDocs(query(collection(db, 'alerts'), where('user_id', '==', uid), where('status', '==', 'פתוח'), limit(8))),
        getDocs(query(collection(db, 'commissions'), where('user_id', '==', uid), where('status', '==', 'שולם'))),
        settingsService.get(),
      ])

      const customers = fromDocs<Customer>(customersSnap.docs)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

      const rawTasks = fromDocs<Task>(tasksSnap.docs)
        .filter((t) => t.status !== 'הושלמה')
        .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
        .slice(0, 10)
      const taskCustomerIds = Array.from(new Set(rawTasks.map((t) => t.customer_id).filter(Boolean) as string[]))
      const taskCustomerMap: Record<string, string> = {}
      await Promise.all(
        taskCustomerIds.map(async (cid) => {
          const snap = await getDoc(doc(db, 'customers', cid))
          if (snap.exists()) {
            const c = fromDoc<Customer>(snap)
            taskCustomerMap[cid] = `${c.first_name} ${c.last_name}`
          }
        })
      )
      const tasks: DashboardTask[] = rawTasks.map((t) => ({
        ...t,
        customer_name: t.customer_id ? taskCustomerMap[t.customer_id] : undefined,
      }))

      const rawAlerts = fromDocs<Alert>(alertsSnap.docs)
      let alerts: DashboardAlert[] = []
      if (rawAlerts.length > 0) {
        const alertCustomerIds = Array.from(new Set(rawAlerts.map((a) => a.customer_id)))
        const alertTrackIds = Array.from(new Set(rawAlerts.map((a) => a.loan_track_id).filter(Boolean) as string[]))
        const custMap: Record<string, string> = {}
        const trackMap: Record<string, string> = {}
        await Promise.all([
          ...alertCustomerIds.map(async (cid) => {
            const snap = await getDoc(doc(db, 'customers', cid))
            if (snap.exists()) {
              const c = fromDoc<Customer>(snap)
              custMap[cid] = `${c.first_name} ${c.last_name}`
            }
          }),
          ...alertTrackIds.map(async (tid) => {
            const snap = await getDoc(doc(db, 'loan_tracks', tid))
            if (snap.exists()) {
              const t = fromDoc<LoanTrack>(snap)
              trackMap[tid] = t.type || '—'
            }
          }),
        ])
        alerts = rawAlerts.map((a) => ({
          ...a,
          customer_name: custMap[a.customer_id] || 'לא ידוע',
          track_type: a.loan_track_id ? trackMap[a.loan_track_id] || '—' : '—',
        }))
      }

      const commissionTotal = fromDocs<Commission>(commissionsSnap.docs)
        .reduce((sum, c) => sum + (c.amount || 0), 0)

      return {
        advisorName: settingsRes.data?.name || '',
        customers,
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
