import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertService } from '@/services/alertService'
import type { AlertWithCustomer } from '@/types/database'

export interface AlertFilters {
  status?: string
  urgency?: 'urgent' | 'warning' | 'normal'
}

export function useAlerts(filters?: AlertFilters) {
  return useQuery({
    queryKey: ['alerts', filters ?? {}],
    queryFn: async () => {
      const { data, error } = await alertService.getAll(filters)
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useSnoozeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error } = await alertService.snooze(id, until)
      if (error) throw new Error(error.message)
    },
    onMutate: async (_id: string) => {
      await qc.cancelQueries({ queryKey: ['alerts'] })
      const previousAlerts = qc.getQueriesData<AlertWithCustomer[]>({ queryKey: ['alerts'] })
      return { previousAlerts }
    },
    onError: (_err, _id, context) => {
      if (context?.previousAlerts) {
        for (const [queryKey, data] of context.previousAlerts) {
          qc.setQueryData(queryKey, data)
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useMarkAlertHandled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await alertService.markHandled(id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
