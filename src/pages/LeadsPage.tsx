import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, Phone, Mail, Star, ArrowLeftRight, Loader2, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Lead, LeadStatus } from '@/types/database'

const statusColors: Record<string, string> = {
  'חדש': 'bg-blue-100 text-blue-700',
  'יצירת קשר': 'bg-yellow-100 text-yellow-700',
  'פגישה נקבעה': 'bg-purple-100 text-purple-700',
  'הפך ללקוח': 'bg-green-100 text-green-700',
  'נסגר': 'bg-gray-100 text-gray-500',
}

const sources = ['הכל', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'הפניה', 'טלפון']
const statusOptions: LeadStatus[] = ['חדש', 'יצירת קשר', 'פגישה נקבעה', 'הפך ללקוח', 'נסגר']

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none text-sm'

export default function LeadsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('הכל')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newLead, setNewLead] = useState({
    name: '', phone: '', email: '', source: 'פייסבוק', score: 5, notes: '',
  })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })

    if (sourceFilter !== 'הכל') query = query.eq('source', sourceFilter)
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)

    const { data, error } = await query
    if (error) console.error(error)
    else setLeads((data || []) as Lead[])
    setLoading(false)
  }, [sourceFilter, search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const updateStatus = async (id: string, status: LeadStatus) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (!error) setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  const convertToCustomer = async (lead: Lead) => {
    if (!confirm(`להמיר את "${lead.name}" ללקוח?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    const nameParts = (lead.name || '').trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const { data, error } = await supabase.from('customers').insert({
      first_name: firstName,
      last_name: lastName,
      phone: lead.phone,
      email: lead.email,
      lead_source: lead.source,
      status: 'ליד',
      user_id: user?.id,
    }).select().single()

    if (data && !error) {
      await supabase.from('leads').update({ status: 'הפך ללקוח' }).eq('id', lead.id)
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'הפך ללקוח' } : l))
      navigate(`/customers/${data.id}`)
    } else if (error) {
      alert('שגיאה: ' + error.message)
    }
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLead.name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('leads').insert({
      ...newLead,
      status: 'חדש' as LeadStatus,
      user_id: user?.id,
    })

    if (error) alert('שגיאה: ' + error.message)
    else {
      setShowNewModal(false)
      setNewLead({ name: '', phone: '', email: '', source: 'פייסבוק', score: 5, notes: '' })
      fetchLeads()
    }
    setSaving(false)
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">לידים ({leads.length})</h1>
        <button onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 bg-[#1a4f8a] text-white px-4 py-2 rounded-lg hover:bg-[#143d6b] transition-colors">
          <UserPlus size={18} />ליד חדש
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חפש לפי שם או טלפון..."
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {sources.map(s => (
              <button key={s} onClick={() => setSourceFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  sourceFilter === s ? 'bg-[#1a4f8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <Loader2 size={32} className="mx-auto text-[#1a4f8a] animate-spin mb-3" />
          <p className="text-gray-500">טוען לידים...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <UserPlus size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">לא נמצאו לידים</p>
          <p className="text-sm text-gray-400 mt-1">לחץ "ליד חדש" להוספת ליד ראשון</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {leads.map(lead => (
            <div key={lead.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center text-[#1a4f8a] font-bold">
                    {(lead.name || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{lead.name || '—'}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                      {lead.phone && <span className="flex items-center gap-1" dir="ltr"><Phone size={12} /> {lead.phone}</span>}
                      {lead.email && <span className="flex items-center gap-1" dir="ltr"><Mail size={12} /> {lead.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-500" />
                    <span className="text-sm font-medium">{lead.score}/10</span>
                  </div>
                  {lead.source && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{lead.source}</span>}
                  <select value={lead.status}
                    onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)}
                    className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${statusColors[lead.status] || 'bg-gray-100'}`}>
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {lead.status !== 'הפך ללקוח' && lead.status !== 'נסגר' && (
                    <button onClick={() => convertToCustomer(lead)}
                      className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg hover:bg-green-100 flex items-center gap-1">
                      <ArrowLeftRight size={12} />המר ללקוח
                    </button>
                  )}
                </div>
              </div>
              {lead.notes && <p className="text-sm text-gray-500 mt-2">{lead.notes}</p>}
              <p className="text-xs text-gray-400 mt-1">{formatDate(lead.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* New Lead Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">ליד חדש</h2>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                <input className={inputClass} value={newLead.name} required
                  onChange={e => setNewLead({ ...newLead, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input className={inputClass} dir="ltr" value={newLead.phone}
                  onChange={e => setNewLead({ ...newLead, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <input type="email" className={inputClass} dir="ltr" value={newLead.email}
                  onChange={e => setNewLead({ ...newLead, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מקור</label>
                <select className={`${inputClass} bg-white`} value={newLead.source}
                  onChange={e => setNewLead({ ...newLead, source: e.target.value })}>
                  {sources.filter(s => s !== 'הכל').map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ציון (1-10)</label>
                <input type="number" min={1} max={10} className={inputClass} value={newLead.score}
                  onChange={e => setNewLead({ ...newLead, score: parseInt(e.target.value) || 5 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                <textarea className={`${inputClass} min-h-[60px]`} value={newLead.notes}
                  onChange={e => setNewLead({ ...newLead, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-[#1a4f8a] text-white py-2 rounded-lg hover:bg-[#143d6b] disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  שמור
                </button>
                <button type="button" onClick={() => setShowNewModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
