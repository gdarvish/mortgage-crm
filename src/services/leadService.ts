import { supabase } from '@/lib/supabase'
import type { Lead } from '@/types/database'

export const leadService = {
  async getAll(filters?: { status?: string; source?: string; search?: string }) {
    let query = supabase
      .from('leads')
      .select('*, referral_partner:referral_partners(*)')
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.source) query = query.eq('source', filters.source)
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    return { data: data as Lead[] | null, error }
  },

  async create(lead: Omit<Lead, 'id' | 'created_at'>) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...lead, user_id: user?.id } as Record<string, unknown>)
      .select()
      .single()

    return { data: data as Lead | null, error }
  },

  async update(id: string, updates: Partial<Lead>) {
    const { data, error } = await supabase
      .from('leads')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Lead | null, error }
  },

  async delete(id: string) {
    return supabase.from('leads').delete().eq('id', id)
  },

  async convertToCustomer(leadId: string) {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) return { data: null, error: leadError }

    const nameParts = (lead.name || '').split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const { data: { user } } = await supabase.auth.getUser()

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        user_id: user?.id,
        first_name: firstName,
        last_name: lastName,
        phone: lead.phone,
        email: lead.email,
        lead_source: lead.source,
        status: 'ליד',
        referral_partner_id: lead.referral_partner_id,
      })
      .select()
      .single()

    if (customerError) return { data: null, error: customerError }

    await supabase
      .from('leads')
      .update({ status: 'הפך ללקוח' })
      .eq('id', leadId)

    return { data: customer, error: null }
  },
}
