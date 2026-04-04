import { supabase } from '@/lib/supabase'
import type { Customer, CustomerWithRelations } from '@/types/database'

export const customerService = {
  async getAll(filters?: { status?: string; search?: string }) {
    let query = supabase
      .from('customers')
      .select('*, referral_partner:referral_partners(*)')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,id_number.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query
    return { data: data as Customer[] | null, error }
  },

  async getById(id: string): Promise<{ data: CustomerWithRelations | null; error: unknown }> {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        referral_partner:referral_partners(*),
        documents(*),
        mortgages(*, loan_tracks(*), bank_responses(*)),
        tasks(*),
        messages(*),
        commissions(*)
      `)
      .eq('id', id)
      .single()

    return { data: data as CustomerWithRelations | null, error }
  },

  async create(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...customer, user_id: user?.id } as Record<string, unknown>)
      .select()
      .single()

    return { data: data as Customer | null, error }
  },

  async update(id: string, updates: Partial<Customer>) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Customer | null, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    return { error }
  },

  async getByQuestionnaireToken(token: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('questionnaire_token', token)
      .single()

    return { data: data as Customer | null, error }
  },

  async getStats() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [activeCustomers, monthlyDeals, weeklyLeads] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact' }).not('status', 'eq', 'ליד'),
      supabase.from('customers').select('id', { count: 'exact' }).eq('status', 'סגירה').gte('updated_at', startOfMonth),
      supabase.from('customers').select('id', { count: 'exact' }).eq('status', 'ליד').gte('created_at', startOfWeek),
    ])

    return {
      activeCustomers: activeCustomers.count || 0,
      monthlyDeals: monthlyDeals.count || 0,
      weeklyLeads: weeklyLeads.count || 0,
    }
  },
}
