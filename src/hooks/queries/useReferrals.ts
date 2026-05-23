import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { referralService } from '@/services/referralService'

export function useReferrals() {
  return useQuery({
    queryKey: ['referrals'],
    queryFn: async () => {
      const { data, error } = await referralService.getAll()
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useCreateReferral() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Parameters<typeof referralService.create>[0]) => {
      const { data, error } = await referralService.create(input)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['referrals'] }),
  })
}

// A4-11: hook for deleting a referral partner (invalidates ['referrals'] cache)
export function useDeleteReferral() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await referralService.delete(id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['referrals'] }),
  })
}
