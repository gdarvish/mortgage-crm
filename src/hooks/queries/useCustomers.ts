import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customerService } from '@/services/customerService'
import type { Customer } from '@/types/database'

export interface CustomerFilters {
  status?: string
  search?: string
}

export function useCustomers(filters?: CustomerFilters) {
  return useQuery({
    queryKey: ['customers', filters ?? {}],
    queryFn: async () => {
      const { data, error } = await customerService.getAll(filters)
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await customerService.getById(id)
      if (error) throw new Error(error.message)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Parameters<typeof customerService.create>[0]) => {
      const { data, error } = await customerService.create(input)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Customer> }) => {
      const { data, error } = await customerService.update(id, updates)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await customerService.delete(id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
