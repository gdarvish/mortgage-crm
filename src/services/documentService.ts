import { supabase } from '@/lib/supabase'
import type { Document } from '@/types/database'

export const documentService = {
  async getByCustomer(customerId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('customer_id', customerId)
      .order('uploaded_at', { ascending: false })

    return { data: data as Document[] | null, error }
  },

  async upload(customerId: string, file: File, type: string, category: string) {
    const fileName = `${customerId}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) return { data: null, error: uploadError }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    const { data, error } = await supabase
      .from('documents')
      .insert({
        customer_id: customerId,
        type,
        category,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        status: 'ממתין',
      })
      .select()
      .single()

    return { data: data as Document | null, error }
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('documents')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    return { data: data as Document | null, error }
  },

  async delete(id: string, fileUrl: string) {
    // Extract path from URL for storage deletion
    const path = fileUrl.split('/documents/')[1]
    if (path) {
      await supabase.storage.from('documents').remove([path])
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    return { error }
  },

  getChecklist(borrowerType: 'שכיר' | 'עצמאי') {
    const baseDocuments = [
      { type: 'תעודת זהות + ספח', category: 'זיהוי' },
      { type: '3 תלושי שכר אחרונים', category: 'הכנסות' },
      { type: '6 דפי חשבון בנק', category: 'חשבון_בנק' },
      { type: 'אישור עבודה / העסקה', category: 'הכנסות' },
      { type: 'הסכם רכישה', category: 'נכס' },
      { type: 'נסח טאבו', category: 'נכס' },
      { type: 'דוח פלאש BDI', category: 'כללי' },
      { type: 'הצהרת הון', category: 'כללי' },
    ]

    const selfEmployedDocuments = [
      { type: '2 דוחות מס שנתיים (1301)', category: 'הכנסות' },
      { type: 'אישור רואה חשבון', category: 'הכנסות' },
      { type: 'חשבון בנק עסקי', category: 'חשבון_בנק' },
      { type: 'ניהול ספרים', category: 'הכנסות' },
      { type: 'תעודת עוסק מורשה', category: 'זיהוי' },
      { type: 'דוח רווח והפסד', category: 'הכנסות' },
    ]

    return borrowerType === 'עצמאי'
      ? [...baseDocuments, ...selfEmployedDocuments]
      : baseDocuments
  },
}
