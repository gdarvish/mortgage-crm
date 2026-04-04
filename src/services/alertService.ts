import { supabase } from '@/lib/supabase'
import type { Alert, AlertWithCustomer } from '@/types/database'

export const alertService = {
  async getAll(filters?: { status?: string; urgency?: 'urgent' | 'warning' | 'normal' }) {
    let query = supabase
      .from('alerts')
      .select('*, customer:customers(first_name, last_name, phone), loan_track:loan_tracks(*)')
      .order('days_until_end', { ascending: true })

    if (filters?.status) query = query.eq('status', filters.status)

    if (filters?.urgency === 'urgent') {
      query = query.lt('days_until_end', 60)
    } else if (filters?.urgency === 'warning') {
      query = query.gte('days_until_end', 60).lt('days_until_end', 120)
    } else if (filters?.urgency === 'normal') {
      query = query.gte('days_until_end', 120)
    }

    const { data, error } = await query
    return { data: data as AlertWithCustomer[] | null, error }
  },

  async update(id: string, updates: Partial<Alert>) {
    const { data, error } = await supabase
      .from('alerts')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Alert | null, error }
  },

  async snooze(id: string, until: string) {
    return this.update(id, { snoozed_until: until, status: 'נדחה' })
  },

  async markHandled(id: string) {
    return this.update(id, { status: 'טופל' })
  },

  async getActiveCount() {
    const { count, error } = await supabase
      .from('alerts')
      .select('id', { count: 'exact' })
      .eq('status', 'פתוח')

    return { count: count || 0, error }
  },
}
