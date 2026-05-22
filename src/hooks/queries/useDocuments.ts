import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { awaitUserId } from '@/services/_firestoreHelpers'
import { documentService } from '@/services/documentService'
import type { Document } from '@/types/database'

export type DocumentWithCustomer = Document & { customerName?: string }

export function useDocuments() {
  return useQuery({
    queryKey: ['documents', 'list'],
    queryFn: async (): Promise<DocumentWithCustomer[]> => {
      const uid = await awaitUserId()
      const [docSnap, custSnap] = await Promise.all([
        getDocs(query(collection(db, 'documents'), where('user_id', '==', uid))),
        getDocs(query(collection(db, 'customers'), where('user_id', '==', uid))),
      ])
      const custMap: Record<string, string> = {}
      custSnap.docs.forEach((d) => {
        const c = d.data()
        custMap[d.id] = `${c.first_name} ${c.last_name}`
      })
      const rows: DocumentWithCustomer[] = docSnap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          uploaded_at: data.uploaded_at?.toDate?.()?.toISOString() ?? data.uploaded_at ?? '',
        } as DocumentWithCustomer
      })
      rows.sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime())
      rows.forEach((r) => {
        if (r.customer_id) r.customerName = custMap[r.customer_id] ?? ''
      })
      return rows
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { customerId: string; file: File; type: string; category: string }) => {
      const { data, error } = await documentService.upload(args.customerId, args.file, args.type, args.category)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await documentService.delete(id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}
