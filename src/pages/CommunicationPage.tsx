import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Send, Phone, Mail, Clock, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { customerService } from '@/services/customerService'
import { messageService } from '@/services/messageService'
import type { Customer, Message } from '@/types/database'

const templates = [
  { id: 'questionnaire', name: 'שלח שאלון',    template: 'שלום {name}, שלחתי לך שאלון קצר לפני הפגישה שלנו. אשמח אם תמלא אותו.' },
  { id: 'document',      name: 'בקשת מסמך',    template: 'שלום {name}, על מנת להתקדם בתהליך, אשמח לקבל את המסמכים הבאים.' },
  { id: 'status',        name: 'עדכון סטטוס',   template: 'שלום {name}, רציתי לעדכן אותך שהתיק שלך נמצא כעת בטיפול.' },
  { id: 'meeting',       name: 'תזכורת פגישה', template: 'שלום {name}, תזכורת לפגישה שלנו. נתראה!' },
]

const channelIcons: Record<string, typeof MessageSquare> = {
  'וואטסאפ': Phone,
  'אימייל':  Mail,
  'SMS':     MessageSquare,
}

const channelColors: Record<string, { bg: string; color: string }> = {
  'וואטסאפ': { bg: '#d1fae5', color: '#065f46' },
  'אימייל':  { bg: '#dbeafe', color: '#1e40af' },
  'SMS':     { bg: '#ede9fe', color: '#7c3aed' },
}

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e7e5e4',
  borderRadius: 10,
  fontSize: 13,
  color: '#1c1917',
  background: '#ffffff',
  outline: 'none',
  fontFamily: 'var(--font-heebo)',
}

export default function CommunicationPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [channel, setChannel] = useState<Message['channel']>('וואטסאפ')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    customerService.getAll().then(({ data }) => {
      if (data) setCustomers(data)
    })
  }, [])

  const fetchMessages = useCallback(async (customerId: string) => {
    if (!customerId) { setMessages([]); return }
    setLoadingMessages(true)
    const { data } = await messageService.getByCustomer(customerId)
    setMessages(data ?? [])
    setLoadingMessages(false)
  }, [])

  useEffect(() => { fetchMessages(selectedCustomerId) }, [selectedCustomerId, fetchMessages])

  const applyTemplate = (templateId: string) => {
    const t = templates.find(t => t.id === templateId)
    if (!t) return
    const cust = customers.find(c => c.id === selectedCustomerId)
    const name = cust ? cust.first_name : 'לקוח'
    setMessageText(t.template.replace('{name}', name))
  }

  const handleSend = async () => {
    if (!messageText.trim() || !selectedCustomerId) return
    setSending(true)
    const { data, error } = await messageService.create({
      customer_id: selectedCustomerId,
      channel,
      direction: 'נשלח',
      content: messageText,
    })
    if (data) {
      setMessages(prev => [data, ...prev])
      setMessageText('')
    } else if (error) {
      alert('שגיאה: ' + error.message)
    }
    // Also open WhatsApp if channel is WhatsApp
    if (!error && channel === 'וואטסאפ') {
      const cust = customers.find(c => c.id === selectedCustomerId)
      if (cust?.phone) messageService.sendWhatsApp(cust.phone, messageText)
    }
    setSending(false)
  }

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div>
        <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
          <MessageSquare size={22} style={{ color: '#059669' }} />
          תקשורת
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>שליחת הודעות והיסטוריית תקשורת עם לקוחות</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Send panel */}
        <div style={{ ...cardStyle, padding: 24 }}>
          <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>שלח הודעה</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>לקוח</label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                style={inputStyle}
              >
                <option value="">בחר לקוח...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.phone ? ` · ${c.phone}` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>ערוץ</label>
              <div className="flex gap-2">
                {(['וואטסאפ', 'אימייל', 'SMS'] as Message['channel'][]).map(ch => {
                  const cc = channelColors[ch]
                  const active = channel === ch
                  return (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      className="flex-1 py-2 text-[12px] font-semibold transition-all"
                      style={{
                        borderRadius: 10,
                        background: active ? cc.bg : '#f5f4f2',
                        color: active ? cc.color : '#a8a29e',
                        border: active ? `1.5px solid ${cc.color}30` : '1.5px solid transparent',
                      }}
                    >{ch}</button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>תבנית</label>
              <select
                defaultValue=""
                onChange={e => applyTemplate(e.target.value)}
                style={inputStyle}
              >
                <option value="">בחר תבנית...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>הודעה</label>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !messageText.trim() || !selectedCustomerId}
              className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ borderRadius: 12, background: '#059669', padding: '10px 0', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              שלח
            </button>
          </div>
        </div>

        {/* History panel */}
        <div className="lg:col-span-2" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #f5f4f2' }}>
            <h2 className="text-[15px] font-bold" style={{ color: '#1c1917' }}>היסטוריית הודעות</h2>
            {selectedCustomerId && (
              <p className="text-[12px] mt-0.5" style={{ color: '#a8a29e' }}>
                {customers.find(c => c.id === selectedCustomerId)?.first_name} {customers.find(c => c.id === selectedCustomerId)?.last_name}
              </p>
            )}
          </div>

          {loadingMessages ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} style={{ color: '#059669' }} className="animate-spin" />
            </div>
          ) : !selectedCustomerId ? (
            <div className="flex flex-col items-center justify-center h-48">
              <MessageSquare size={32} style={{ color: '#d6d3d1' }} className="mb-2" />
              <p className="text-[13px]" style={{ color: '#a8a29e' }}>בחר לקוח כדי לראות היסטוריית הודעות</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48">
              <MessageSquare size={32} style={{ color: '#d6d3d1' }} className="mb-2" />
              <p className="text-[13px]" style={{ color: '#a8a29e' }}>אין הודעות עדיין עם לקוח זה</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f5f4f2' }}>
              {messages.map(msg => {
                const Icon = channelIcons[msg.channel] ?? MessageSquare
                const cc = channelColors[msg.channel] ?? { bg: '#f5f4f2', color: '#57534e' }
                return (
                  <div key={msg.id} className="flex gap-3 px-6 py-4 transition-colors hover:bg-[#faf9f7]">
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 40, height: 40, borderRadius: 12, background: cc.bg }}
                    >
                      <Icon size={16} style={{ color: cc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: cc.bg, color: cc.color }}
                        >{msg.channel}</span>
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: msg.direction === 'נשלח' ? '#059669' : '#d97706' }}
                        >{msg.direction}</span>
                      </div>
                      <p className="text-[13px] mt-1" style={{ color: '#57534e' }}>{msg.content}</p>
                      <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: '#a8a29e' }}>
                        <Clock size={10} />{formatDate(msg.sent_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
