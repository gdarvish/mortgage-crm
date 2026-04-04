import { useState } from 'react'
import { MessageSquare, Send, Phone, Mail, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const templates = [
  { id: 'questionnaire', name: 'שלח שאלון', template: 'שלום {name}, שלחתי לך שאלון קצר לפני הפגישה שלנו. אשמח אם תמלא אותו: {link}' },
  { id: 'document', name: 'בקשת מסמך', template: 'שלום {name}, על מנת להתקדם בתהליך, אשמח לקבל את המסמכים הבאים: {documents}' },
  { id: 'status', name: 'עדכון סטטוס', template: 'שלום {name}, רציתי לעדכן אותך שהתיק שלך נמצא כעת בשלב: {status}' },
  { id: 'meeting', name: 'תזכורת פגישה', template: 'שלום {name}, תזכורת לפגישה שלנו מחר בשעה {time}. נתראה!' },
]

const mockMessages = [
  { id: '1', customerName: 'יוסי כהן', channel: 'וואטסאפ', direction: 'נשלח', content: 'שלום יוסי, שלחתי לך שאלון למילוי.', sentAt: '2026-04-03T10:30:00' },
  { id: '2', customerName: 'שרה לוי', channel: 'אימייל', direction: 'נשלח', content: 'שרה שלום, מצורפת הצעת תמהיל.', sentAt: '2026-04-03T09:15:00' },
  { id: '3', customerName: 'דוד אברהם', channel: 'וואטסאפ', direction: 'התקבל', content: 'קיבלתי, תודה!', sentAt: '2026-04-02T16:45:00' },
  { id: '4', customerName: 'רחל מזרחי', channel: 'SMS', direction: 'נשלח', content: 'תזכורת: פגישה מחר ב-14:00', sentAt: '2026-04-02T14:00:00' },
]

const channelIcons: Record<string, typeof MessageSquare> = { 'וואטסאפ': Phone, 'אימייל': Mail, 'SMS': MessageSquare }
const channelColors: Record<string, string> = { 'וואטסאפ': 'text-green-600 bg-green-50', 'אימייל': 'text-blue-600 bg-blue-50', 'SMS': 'text-purple-600 bg-purple-50' }

export default function CommunicationPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [message, setMessage] = useState('')
  const [recipient, setRecipient] = useState('')

  const applyTemplate = (templateId: string) => {
    const t = templates.find(t => t.id === templateId)
    if (t) {
      setMessage(t.template)
      setSelectedTemplate(templateId)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <MessageSquare className="text-[#1a4f8a]" size={28} />
        תקשורת
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send Message */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">שלח הודעה</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">לקוח</label>
                <select value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white">
                  <option value="">בחר לקוח...</option>
                  <option>יוסי כהן - 050-1234567</option>
                  <option>שרה לוי - 052-2345678</option>
                  <option>דוד אברהם - 054-3456789</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">ערוץ</label>
                <div className="flex gap-2">
                  {['וואטסאפ', 'אימייל', 'SMS'].map(ch => (
                    <button key={ch} className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">{ch}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">תבנית</label>
                <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white">
                  <option value="">בחר תבנית...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">הודעה</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none resize-none" />
              </div>
              <button className="w-full flex items-center justify-center gap-2 bg-[#1a4f8a] text-white py-2.5 rounded-lg hover:bg-[#143d6b] transition-colors">
                <Send size={16} />
                שלח
              </button>
            </div>
          </div>
        </div>

        {/* Message History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">היסטוריית הודעות</h2>
            <div className="space-y-3">
              {mockMessages.map(msg => {
                const Icon = channelIcons[msg.channel] || MessageSquare
                const colorClass = channelColors[msg.channel] || 'text-gray-600 bg-gray-50'
                return (
                  <div key={msg.id} className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{msg.customerName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>{msg.channel}</span>
                        <span className={`text-xs ${msg.direction === 'נשלח' ? 'text-blue-500' : 'text-green-500'}`}>{msg.direction}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{msg.content}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={10} />{formatDate(msg.sentAt)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
