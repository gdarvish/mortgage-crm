import { supabase } from '@/lib/supabase'
import type { Commission } from '@/types/database'

export const commissionService = {
  async getAll(filters?: { status?: string; period?: { from: string; to: string } }) {
    let query = supabase
      .from('commissions')
      .select('*, customer:customers(first_name, last_name), mortgage:mortgages(loan_amount)')
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.period) {
      query = query.gte('created_at', filters.period.from).lte('created_at', filters.period.to)
    }

    const { data, error } = await query
    return { data, error }
  },

  async create(commission: Omit<Commission, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('commissions')
      .insert(commission as Record<string, unknown>)
      .select()
      .single()

    return { data: data as Commission | null, error }
  },

  async update(id: string, updates: Partial<Commission>) {
    const { data, error } = await supabase
      .from('commissions')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Commission | null, error }
  },

  async getStats() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()

    const [monthlyPaid, yearlyPaid, pending] = await Promise.all([
      supabase.from('commissions').select('amount').eq('status', 'שולם').gte('payment_date', startOfMonth),
      supabase.from('commissions').select('amount').eq('status', 'שולם').gte('payment_date', startOfYear),
      supabase.from('commissions').select('amount').eq('status', 'ממתין'),
    ])

    const sumAmounts = (records: { amount: number | null }[] | null) =>
      (records || []).reduce((sum, r) => sum + (r.amount || 0), 0)

    return {
      monthlyIncome: sumAmounts(monthlyPaid.data as { amount: number | null }[] | null),
      yearlyIncome: sumAmounts(yearlyPaid.data as { amount: number | null }[] | null),
      pendingAmount: sumAmounts(pending.data as { amount: number | null }[] | null),
    }
  },
}
