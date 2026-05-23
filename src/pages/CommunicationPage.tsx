import { useState, useEffect } from 'react'
import { MessageSquare, Send, Phone, Mail, Check, Loader2, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'
import { customerService } from '@/services/customerService'
import { messageService } from '@/services/messageService'
import { useMessages, useMessagesQueryClient } from '@/hooks/queries/useMessages'
import { toast } from '@/components/ui'
import type { Customer, Message } from '@/types/database'

const templates = [
  { id: 'questionnaire', name: 'שלח שאלון', template: 'שלום {name}, שלחתי לך שאלון קצר לפני הפגישה שלנו. אשמח אם תמלא אותו.' },
  { id: 'document', name: 'בקשת מסמך', template: 'שלום {name}, על מנת להתקדם בתהליך, אשמח לקבל את המסמכים הבאים.' },
  { id: 'status', name: 'עדכון סטטוס', template: 'שלום {name}, רציתי לעדכן אותך שהתיק שלך נמצא כעת בטיפול.' },
  { id: 'meeting', name: 'תזכורת פגישה', template: 'שלום {name}, תזכורת לפגישה שלנו. נתראה!' },
]

const channelMeta: Record<Message['channel'], { bg: string; text: string; icon: typeof MessageSquare }> = {
  'וואטסאפ': { bg: '#d1fae5', text: '#065f46', icon: Phone },
  'אימייל': { bg: '#dbeafe', text: '#1e40af', icon: Mail },
  'SMS': { bg: '#ede9fe', text: '#7c3aed', icon: MessageSquare },
}

export default function CommunicationPage() {
  const t = useTheme()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [channel, setChannel] = useState<Message['channel']>('וואטסאפ')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const qc = useMessagesQueryClient()

  // A4-20: use React Query hook instead of local useState for messages
  const { data: messages = [], isLoading: loadingMessages } = useMessages(selectedCustomerId || undefined)

  useEffect(() => {
    customerService.getAll().then(({ data }) => {
      if (data) setCustomers(data)
    })
  }, [])

  // A4-08: use replaceAll (or /g regex) so all occurrences of {name} are replaced
  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find((tp) => tp.id === templateId)
    if (!tmpl) return
    const cust = customers.find((c) => c.id === selectedCustomerId)
    const name = cust ? cust.first_name : 'לקוח'
    setMessageText(tmpl.template.replace(/\{name\}/g, name))
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
      // Invalidate React Query cache so the list refreshes (A4-20)
      qc.invalidateQueries({ queryKey: ['messages', selectedCustomerId] })
      setMessageText('')
      setSent(true)
      setTimeout(() => setSent(false), 2200)
    } else if (error) {
      toast.error('שגיאה בשליחת הודעה', error.message)
    }
    if (!error) {
      const cust = customers.find((c) => c.id === selectedCustomerId)
      if (channel === 'וואטסאפ' && cust?.phone) {
        // A4-12: sendWhatsApp already normalizes Israeli numbers (strips leading 0, prepends 972)
        messageService.sendWhatsApp(cust.phone, messageText)
      } else if (channel === 'אימייל' && cust?.email) {
        window.open(`mailto:${cust.email}?body=${encodeURIComponent(messageText)}`, '_blank')
      } else if (channel === 'SMS' && cust?.phone) {
        window.open(`sms:${cust.phone}?body=${encodeURIComponent(messageText)}`, '_blank')
      }
    }
    setSending(false)
  }

  const handleDeleteMessage = async (msgId: string) => {
    await messageService.delete(msgId)
    // Invalidate React Query cache so the list refreshes (A4-20)
    qc.invalidateQueries({ queryKey: ['messages', selectedCustomerId] })
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  const inputSt: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: `1.5px solid ${t.border}`,
    borderRadius: 10,
    fontSize: 13,
    color: t.text,
    background: t.inputBg,
    outline: 'none',
    fontFamily: 'Heebo,sans-serif',
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={22} color={t.primary} />
            תקשורת
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
            שליחת הודעות והיסטוריית תקשורת עם לקוחות
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr]" style={{ gap: 20 }}>
          {/* Send panel */}
          <div
            style={{
              background: t.cardBg,
              borderRadius: 20,
              padding: '22px 24px',
              boxShadow: t.shadow,
              border: `1px solid ${t.border}`,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 18 }}>שלח הודעה</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>
                  לקוח
                </label>
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} style={inputSt}>
                  <option value="">בחר לקוח...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>
                  ערוץ
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['וואטסאפ', 'אימייל', 'SMS'] as Message['channel'][]).map((ch) => {
                    const active = channel === ch
                    const cc = channelMeta[ch]
                    return (
                      <button
                        key={ch}
                        onClick={() => setChannel(ch)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 10,
                          cursor: 'pointer',
                          fontFamily: 'Heebo,sans-serif',
                          border: active ? `1.5px solid ${cc.text}50` : '1.5px solid transparent',
                          background: active ? cc.bg : t.bg,
                          color: active ? cc.text : t.textMuted,
                          transition: 'all 0.15s',
                        }}
                      >
                        {ch}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>
                  תבנית
                </label>
                <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)} style={inputSt}>
                  <option value="">בחר תבנית...</option>
                  {templates.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>
                  הודעה
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  style={{ ...inputSt, resize: 'none', lineHeight: 1.6 }}
                />
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !messageText.trim() || !selectedCustomerId}
                className="crm-btn-primary"
                style={{
                  background: sent ? '#059669' : t.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '11px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: sending || !messageText.trim() || !selectedCustomerId ? 'default' : 'pointer',
                  fontFamily: 'Heebo,sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: `0 4px 14px ${t.primary}45`,
                  transition: 'background 0.3s',
                  opacity: sending || !messageText.trim() || !selectedCustomerId ? 0.5 : 1,
                }}
              >
                {sending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> שולח...
                  </>
                ) : sent ? (
                  <>
                    <Check size={14} color="#fff" strokeWidth={3} /> נשלח!
                  </>
                ) : (
                  <>
                    <Send size={14} color="#fff" /> שלח
                  </>
                )}
              </button>
            </div>
          </div>

          {/* History */}
          <div
            style={{
              background: t.cardBg,
              borderRadius: 20,
              boxShadow: t.shadow,
              border: `1px solid ${t.border}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${t.border}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>היסטוריית הודעות</h2>
              {selectedCustomer && (
                <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </p>
              )}
            </div>

            {loadingMessages ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192 }}>
                <Loader2 size={24} style={{ color: t.primary }} className="animate-spin" />
              </div>
            ) : !selectedCustomerId ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 192,
                }}
              >
                <MessageSquare size={32} color={t.border} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: t.textMuted }}>בחר לקוח כדי לראות היסטוריית הודעות</p>
              </div>
            ) : messages.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 192,
                }}
              >
                <MessageSquare size={32} color={t.border} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: t.textMuted }}>אין הודעות עדיין עם לקוח זה</p>
              </div>
            ) : (
              <div>
                {messages.map((m, i) => (
                  <MessageRow
                    key={m.id}
                    message={m}
                    index={i}
                    isLast={i === messages.length - 1}
                    t={t}
                    onDelete={handleDeleteMessage}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface MessageRowProps {
  message: Message
  index: number
  isLast: boolean
  t: ReturnType<typeof useTheme>
  onDelete: (id: string) => void
}

function MessageRow({ message, index, isLast, t, onDelete }: MessageRowProps) {
  const [hov, setHov] = useState(false)
  const cc = channelMeta[message.channel] ?? { bg: t.pillBg, text: t.textSub, icon: MessageSquare }
  const ChannelIcon = cc.icon

  // A4-09: handle Firestore Timestamp objects that may not yet be converted to ISO string
  // (e.g. a raw Timestamp returned before tsToIso runs). Call .toDate() if it's a Timestamp.
  const sentAtRaw = message.sent_at as unknown
  let sentAtDate: Date | string | null = null
  if (sentAtRaw && typeof (sentAtRaw as { toDate?: unknown }).toDate === 'function') {
    sentAtDate = (sentAtRaw as { toDate: () => Date }).toDate()
  } else {
    sentAtDate = message.sent_at ?? null
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        gap: 14,
        padding: '16px 24px',
        borderBottom: isLast ? 'none' : `1px solid ${t.borderLight}`,
        background: hov ? t.bg : 'transparent',
        transition: 'background 0.12s',
        animation: `fadeUp 0.35s ease ${index * 0.05}s backwards`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: cc.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ChannelIcon size={16} color={cc.text} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 9px',
              borderRadius: 20,
              background: cc.bg,
              color: cc.text,
            }}
          >
            {message.channel}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: message.direction === 'נשלח' ? t.primary : '#d97706',
            }}
          >
            {message.direction}
          </span>
        </div>
        <p style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>{message.content}</p>
        <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{formatDate(sentAtDate)}</p>
      </div>
      {hov && (
        <button
          onClick={() => onDelete(message.id)}
          aria-label="מחק הודעה"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: t.textMuted,
            alignSelf: 'center',
            flexShrink: 0,
          }}
        >
          <Trash2 size={14} color={t.textMuted} />
        </button>
      )}
    </div>
  )
}
