import { supabase } from '@/lib/supabase'
import type { AdvisorSettings } from '@/types/database'

export const settingsService = {
  async get() {
    const { data, error } = await supabase
      .from('advisor_settings')
      .select('*')
      .limit(1)
      .single()

    return { data: data as AdvisorSettings | null, error }
  },

  async upsert(settings: Partial<AdvisorSettings>) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: existing } = await supabase
      .from('advisor_settings')
      .select('id')
      .limit(1)
      .single()

    if (existing) {
      const { data, error } = await supabase
        .from('advisor_settings')
        .update(settings as Record<string, unknown>)
        .eq('id', existing.id)
        .select()
        .single()
      return { data: data as AdvisorSettings | null, error }
    }

    const { data, error } = await supabase
      .from('advisor_settings')
      .insert({ ...settings, user_id: user?.id } as Record<string, unknown>)
      .select()
      .single()

    return { data: data as AdvisorSettings | null, error }
  },

  async uploadLogo(file: File) {
    const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true })

    if (uploadError) return { url: null, error: uploadError }

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName)

    return { url: publicUrl, error: null }
  },
}
