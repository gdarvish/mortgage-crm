import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertService } from '@/services/alertService'

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
