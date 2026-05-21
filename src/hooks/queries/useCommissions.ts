import { useQuery } from '@tanstack/react-query'
import { commissionService } from '@/services/commissionService'

export function useCommissions(filters?: Parameters<typeof commissionService.getAll>[0]) {
  return useQuery({
    queryKey: ['commissions', filters ?? {}],
    queryFn: async () => {
      const { data, error } = await commissionService.getAll(filters)
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}
