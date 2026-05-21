import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadService } from '@/services/leadService'
import type { Lead } from '@/types/database'

export interface LeadFilters {
  status?: string
  source?: string
  search?: string
}

export function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: ['leads', filters ?? {}],
    queryFn: async () => {
      const { data, error } = await leadService.getAll(filters)
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Parameters<typeof leadService.create>[0]) => {
      const { data, error } = await leadService.create(input)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const { data, error } = await leadService.update(id, updates)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useConvertLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await leadService.convertToCustomer(leadId)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
