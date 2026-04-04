import { supabase } from '@/lib/supabase'
import type { Message } from '@/types/database'

export const messageService = {
  async getByCustomer(customerId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', customerId)
      .order('sent_at', { ascending: false })

    return { data: data as Message[] | null, error }
  },

  async create(message: Omit<Message, 'id' | 'sent_at'>) {
    const { data, error } = await supabase
      .from('messages')
      .insert(message as Record<string, unknown>)
      .select()
      .single()

    return { data: data as Message | null, error }
  },

  sendWhatsApp(phone: string, message: string) {
    const cleanPhone = phone.replace(/\D/g, '')
    const israelPhone = cleanPhone.startsWith('0')
      ? '972' + cleanPhone.slice(1)
      : cleanPhone
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/${israelPhone}?text=${encoded}`, '_blank')
  },

  getTemplates() {
    return [
      {
        id: 'questionnaire',
        name: 'שלח שאלון',
        template: 'שלום {name}, אני {advisor}. שלחתי לך שאלון קצר לפני הפגישה שלנו. אשמח אם תמלא אותו: {link}',
      },
      {
        id: 'document_request',
        name: 'בקשת מסמך',
        template: 'שלום {name}, על מנת להתקדם בתהליך, אשמח לקבל את המסמכים הבאים: {documents}',
      },
      {
        id: 'status_update',
        name: 'עדכון סטטוס',
        template: 'שלום {name}, רציתי לעדכן אותך שהתיק שלך נמצא כעת בשלב: {status}. {notes}',
      },
      {
        id: 'meeting_reminder',
        name: 'תזכורת פגישה',
        template: 'שלום {name}, תזכורת לפגישה שלנו מחר בשעה {time}. נתראה!',
      },
    ]
  },
}
