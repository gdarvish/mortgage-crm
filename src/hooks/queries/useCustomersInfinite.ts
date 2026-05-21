import { useInfiniteQuery } from '@tanstack/react-query'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { customerService } from '@/services/customerService'

export interface CustomersInfiniteOptions {
  statusFilter?: string
  pageSize?: number
}

export function useCustomersInfinite(opts?: CustomersInfiniteOptions) {
  return useInfiniteQuery({
    queryKey: ['customers', 'infinite', opts ?? {}],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await customerService.getPaginated({
        cursor: pageParam,
        statusFilter: opts?.statusFilter,
        pageSize: opts?.pageSize,
      })
      if (error) throw new Error(error.message)
      return data!
    },
    initialPageParam: null as QueryDocumentSnapshot | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
  })
}
