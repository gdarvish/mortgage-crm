import { supabase } from '@/lib/supabase'
import type { ReferralPartner } from '@/types/database'

export const referralService = {
  async getAll() {
    const { data, error } = await supabase
      .from('referral_partners')
      .select('*')
      .order('total_referrals', { ascending: false })

    return { data: data as ReferralPartner[] | null, error }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('referral_partners')
      .select('*')
      .eq('id', id)
      .single()

    return { data: data as ReferralPartner | null, error }
  },

  async create(partner: Omit<ReferralPartner, 'id' | 'created_at'>) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('referral_partners')
      .insert({ ...partner, user_id: user?.id } as Record<string, unknown>)
      .select()
      .single()

    return { data: data as ReferralPartner | null, error }
  },

  async update(id: string, updates: Partial<ReferralPartner>) {
    const { data, error } = await supabase
      .from('referral_partners')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as ReferralPartner | null, error }
  },

  async delete(id: string) {
    return supabase.from('referral_partners').delete().eq('id', id)
  },

  async getWithStats() {
    const { data: partners, error } = await supabase
      .from('referral_partners')
      .select('*')
      .order('total_referrals', { ascending: false })

    if (error || !partners) return { data: null, error }

    const withStats = partners.map(p => ({
      ...p,
      conversionRate: p.total_referrals > 0
        ? Math.round((p.converted_referrals / p.total_referrals) * 100)
        : 0,
    }))

    return { data: withStats, error: null }
  },
}
