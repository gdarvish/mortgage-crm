import { useState } from 'react'
import { UserPlus, Search, Phone, Mail, Star, ArrowLeftRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const statusColors: Record<string, string> = {
  'חדש': 'bg-blue-100 text-blue-700',
  'יצירת קשר': 'bg-yellow-100 text-yellow-700',
  'פגישה נקבעה': 'bg-purple-100 text-purple-700',
  'הפך ללקוח': 'bg-green-100 text-green-700',
  'נסגר': 'bg-gray-100 text-gray-500',
}

const sources = ['הכל', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'הפניה', 'טלפון']
const statusOptions = ['חדש', 'יצירת קשר', 'פגישה נקבעה', 'הפך ללקוח', 'נסגר']

const mockLeads = [
  { id: '1', name: 'אבי ישראלי', phone: '050-1111111', email: 'avi@email.com', source: 'פייסבוק', score: 8, status: 'חדש', created_at: '2026-04-03', notes: 'מעוניין בדירה ראשונה' },
  { id: '2', name: 'מיכל שושן', phone: '052-2222222', email: 'michal@email.com', source: 'הפניה', score: 9, status: 'פגישה נקבעה', created_at: '2026-04-01', notes: 'הופנתה מעו"ד כהן' },
  { id: '3', name: 'רון דהן', phone: '054-3333333', email: 'ron@email.com', source: 'אתר', score: 5, status: 'יצירת קשר', created_at: '2026-03-30', notes: 'מילא טופס באתר' },
  { id: '4', name: 'ורד אלון', phone: '050-4444444', email: 'vered@email.com', source: 'וואטסאפ', score: 7, status: 'חדש', created_at: '2026-04-02', notes: 'שאלה על מחזור' },
  { id: '5', name: 'גיל ממן', phone: '053-5555555', email: 'gil@email.com', source: 'טלפון', score: 3, status: 'נסגר', created_at: '2026-03-25', notes: 'לא רלוונטי כרגע' },
]

export default function LeadsPage() {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('הכל')
  const [leads, setLeads] = useState(mockLeads)
  const [showNewModal, setShowNewModal] = useState(false)

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.name.includes(search) || l.phone.includes(search)
    const matchSource = sourceFilter === 'הכל' || l.source === sourceFilter
    return matchSearch && matchSource
  })

  const updateStatus = (id: string, status: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">לידים</h1>
        <button onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-2 bg-[#1a4f8a] text-white px-4 py-2 rounded-lg hover:bg-[#143d6b] transition-colors">
          <UserPlus size={18} />
          ליד חדש
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חפש לפי שם או טלפון..." className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {sources.map(s => (
              <button key={s} onClick={() => setSourceFilter(s)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${sourceFilter === s ? 'bg-[#1a4f8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(lead => (
          <div key={lead.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center text-[#1a4f8a] font-bold">
                  {lead.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{lead.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1" dir="ltr"><Phone size={12} /> {lead.phone}</span>
                    <span className="flex items-center gap-1" dir="ltr"><Mail size={12} /> {lead.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Star size={14} className="text-yellow-500" />
                  <span className="text-sm font-medium">{lead.score}/10</span>
                </div>
                <span className="text-xs text-gray-400">{lead.source}</span>
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.id, e.target.value)}
                  className={`text-xs px-2 py-1 rounded-full border-0 ${statusColors[lead.status] || 'bg-gray-100'}`}
                >
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {lead.status !== 'הפך ללקוח' && lead.status !== 'נסגר' && (
                  <button className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg hover:bg-green-100 flex items-center gap-1">
                    <ArrowLeftRight size={12} />
                    המר ללקוח
                  </button>
                )}
              </div>
            </div>
            {lead.notes && <p className="text-sm text-gray-500 mt-2 mr-13">{lead.notes}</p>}
            <p className="text-xs text-gray-400 mt-1 mr-13">{formatDate(lead.created_at)}</p>
          </div>
        ))}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">ליד חדש</h2>
            <form className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label><input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label><input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label><input type="email" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">מקור</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none bg-white">
                  {sources.filter(s => s !== 'הכל').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">ציון (1-10)</label><input type="number" min={1} max={10} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">הערות</label><textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" rows={2} /></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#1a4f8a] text-white py-2 rounded-lg hover:bg-[#143d6b]">שמור</button>
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
