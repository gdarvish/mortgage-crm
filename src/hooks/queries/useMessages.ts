import { useQuery } from '@tanstack/react-query'
import { messageService } from '@/services/messageService'

export function messagesKey(customerId: string | undefined) {
  return ['messages', customerId ?? ''] as const
}

/**
 * The message history for one customer, oldest first — the order the thread
 * is rendered in. Holding it in the query cache rather than in page state
 * means a send or a delete refreshes from one source instead of two.
 */
export function useMessages(customerId: string | undefined) {
  return useQuery({
    queryKey: messagesKey(customerId),
    queryFn: async () => {
      if (!customerId) return []
      const { data, error } = await messageService.getByCustomer(customerId)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled: !!customerId,
  })
}
