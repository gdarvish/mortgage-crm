import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commissionService } from '@/services/commissionService'
import type { Commission } from '@/types/database'

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

export function useCreateCommission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Parameters<typeof commissionService.create>[0]) => {
      const { data, error } = await commissionService.create(input)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  })
}

export function useUpdateCommission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Commission> }) => {
      const { data, error } = await commissionService.update(id, updates)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  })
}

export function useDeleteCommission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { doc, deleteDoc } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase')
      await deleteDoc(doc(db, 'commissions', id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  })
}
