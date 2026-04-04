import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

export const taskService = {
  async getAll(filters?: { status?: string; customerId?: string; dueDate?: string }) {
    let query = supabase
      .from('tasks')
      .select('*, customer:customers(first_name, last_name)')
      .order('due_date', { ascending: true })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId)
    if (filters?.dueDate) query = query.lte('due_date', filters.dueDate)

    const { data, error } = await query
    return { data: data as (Task & { customer?: { first_name: string; last_name: string } })[] | null, error }
  },

  async getTodayTasks() {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('tasks')
      .select('*, customer:customers(first_name, last_name)')
      .lte('due_date', today.toISOString())
      .neq('status', 'הושלמה')
      .order('priority', { ascending: false })

    return { data, error }
  },

  async create(task: Omit<Task, 'id' | 'created_at'>) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...task, user_id: user?.id } as Record<string, unknown>)
      .select()
      .single()

    return { data: data as Task | null, error }
  },

  async update(id: string, updates: Partial<Task>) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Task | null, error }
  },

  async delete(id: string) {
    return supabase.from('tasks').delete().eq('id', id)
  },
}
