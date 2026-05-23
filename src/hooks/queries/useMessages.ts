import { useQuery, useQueryClient } from '@tanstack/react-query'
import { messageService } from '@/services/messageService'

/**
 * A4-20: React Query hook for messages (replaces local useState in CommunicationPage).
 * Queries the messages sub-collection for a given customer and benefits from
 * background refresh and cache.
 */
export function useMessages(customerId: string | undefined) {
  return useQuery({
    queryKey: ['messages', customerId ?? ''],
    queryFn: async () => {
      if (!customerId) return []
      const { data, error } = await messageService.getByCustomer(customerId)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled: !!customerId,
  })
}

export function useMessagesQueryClient() {
  return useQueryClient()
}
