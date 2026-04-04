import { supabase } from '@/lib/supabase'
import type { Mortgage, MortgageWithTracks, LoanTrack, BankResponse } from '@/types/database'

export const mortgageService = {
  async getByCustomer(customerId: string) {
    const { data, error } = await supabase
      .from('mortgages')
      .select('*, loan_tracks(*), bank_responses(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    return { data: data as MortgageWithTracks[] | null, error }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('mortgages')
      .select('*, loan_tracks(*), bank_responses(*)')
      .eq('id', id)
      .single()

    return { data: data as MortgageWithTracks | null, error }
  },

  async create(mortgage: Omit<Mortgage, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('mortgages')
      .insert(mortgage as Record<string, unknown>)
      .select()
      .single()

    return { data: data as Mortgage | null, error }
  },

  async update(id: string, updates: Partial<Mortgage>) {
    const { data, error } = await supabase
      .from('mortgages')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Mortgage | null, error }
  },

  async delete(id: string) {
    return supabase.from('mortgages').delete().eq('id', id)
  },

  // Loan Tracks
  async addTrack(track: Omit<LoanTrack, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('loan_tracks')
      .insert(track as Record<string, unknown>)
      .select()
      .single()

    return { data: data as LoanTrack | null, error }
  },

  async updateTrack(id: string, updates: Partial<LoanTrack>) {
    const { data, error } = await supabase
      .from('loan_tracks')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    return { data: data as LoanTrack | null, error }
  },

  async deleteTrack(id: string) {
    return supabase.from('loan_tracks').delete().eq('id', id)
  },

  // Bank Responses
  async addBankResponse(response: Omit<BankResponse, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('bank_responses')
      .insert(response as Record<string, unknown>)
      .select()
      .single()

    return { data: data as BankResponse | null, error }
  },

  async deleteBankResponse(id: string) {
    return supabase.from('bank_responses').delete().eq('id', id)
  },
}
