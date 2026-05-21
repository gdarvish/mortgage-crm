import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Loader2, X, Users } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCustomers, useCreateCustomer } from '@/hooks/queries/useCustomers'
import { toast } from '@/components/ui'

const statusColors: Record<string, { bg: string; color: string }> = {
  'ליד':    { bg: '#ede9fe', color: '#7c3aed' },
  'פגישה':  { bg: '#fef3c7', color: '#b45309' },
  'מסמכים': { bg: '#ffedd5', color: '#c2410c' },
  'הגשה':   { bg: '#f3e8ff', color: '#9333ea' },
  'אישור':  { bg: '#d1fae5', color: '#065f46' },
  'סגירה':  { bg: '#a7f3d0', color: '#064e3b' },
}

const statuses = ['הכל', 'ליד', 'פגישה', 'מסמכים', 'הגשה', 'אישור', 'סגירה']

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
  fontSize: 14,
  color: '#1c1917',
  background: '#ffffff',
  outline: 'none',
  fontFamily: 'var(--font-heebo)',
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('הכל')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    first_name: '', last_name: '', id_number: '', phone: '', email: '', lead_source: '',
  })

  const { data: customers = [], isLoading: loading } = useCustomers({
    status: statusFilter !== 'הכל' ? statusFilter : undefined,
    search: search || undefined,
  })
  const createCustomer = useCreateCustomer()

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.first_name || !newCustomer.last_name) return
    createCustomer.mutate(
      {
        ...newCustomer,
        status: 'ליד',
        children: 0,
        existing_obligations: 0,
        questionnaire_completed: false,
        id_number: newCustomer.id_number || null,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
        address: null,
        marital_status: null,
        monthly_income: null,
        partner_income: null,
        own_capital: null,
        lead_source: newCustomer.lead_source || null,
        notes: null,
        referral_partner_id: null,
        questionnaire_token: null,
      },
      {
        onSuccess: () => {
          setShowNewModal(false)
          setNewCustomer({ first_name: '', last_name: '', id_number: '', phone: '', email: '', lead_source: '' })
          toast.success('הלקוח נוצר בהצלחה')
        },
        onError: (err) => toast.error('שגיאה ביצירת לקוח', err.message),
      }
    )
  }

  const statusCounts = statuses.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'הכל' ? customers.length : customers.filter(c => c.status === s).length
    return acc
  }, {})

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>לקוחות</h1>
          <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>{customers.length} לקוחות</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.96] shrink-0"
          style={{ borderRadius: 12, background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
        >
          <Plus size={15} />
          לקוח חדש
        </button>
      </div>

      {/* Status pills + search */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute" style={{ right: 12, top: '50%', transform: 'translateY(-50%)', color: '#a8a29e' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לקוח..."
              className="w-full pr-10 pl-4 py-2 outline-none text-[13px]"
              style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, color: '#1c1917' }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map(s => {
              const sc = statusColors[s]
              const active = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1.5 text-[12px] font-semibold transition-all"
                  style={{
                    borderRadius: 20,
                    background: active ? (sc?.bg ?? '#d1fae5') : '#f5f4f2',
                    color: active ? (sc?.color ?? '#065f46') : '#57534e',
                    transform: active ? 'translateY(-2px)' : 'none',
                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {s} <span className="opacity-60 ml-1">{statusCounts[s]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={28} style={{ color: '#059669' }} className="animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users size={40} style={{ color: '#d6d3d1' }} className="mb-3" />
            <p className="text-[15px] font-semibold" style={{ color: '#57534e' }}>אין לקוחות עדיין</p>
            <p className="text-[13px] mt-1" style={{ color: '#a8a29e' }}>הוסף את הלקוח הראשון שלך</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#faf9f7', borderBottom: '1px solid #f5f4f2' }}>
                {['שם', 'ת.ז', 'טלפון', 'סטטוס', 'מקור', 'הכנסה', 'תאריך'].map(h => (
                  <th key={h} className="text-right p-3 text-[11px] font-bold uppercase" style={{ color: '#a8a29e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => {
                const sc = statusColors[c.status] ?? { bg: '#f5f4f2', color: '#57534e' }
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="border-b cursor-pointer group"
                    style={{
                      borderColor: '#f5f4f2',
                      animationName: 'fadeUp',
                      animationDuration: '0.35s',
                      animationDelay: `${i * 40}ms`,
                      animationFillMode: 'backwards',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#faf9f7')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                          style={{ width: 34, height: 34, borderRadius: 10, background: '#059669', transition: 'transform 120ms' }}
                        >
                          {c.first_name.charAt(0)}
                        </div>
                        <span className="text-[13px] font-semibold" style={{ color: '#1c1917' }}>{c.first_name} {c.last_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-[13px]" style={{ color: '#a8a29e' }} dir="ltr">{c.id_number || '—'}</td>
                    <td className="p-3 text-[13px]" style={{ color: '#57534e' }} dir="ltr">{c.phone || '—'}</td>
                    <td className="p-3">
                      <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-[13px]" style={{ color: '#a8a29e' }}>{c.lead_source || '—'}</td>
                    <td className="p-3 text-[13px] font-semibold" style={{ color: '#059669' }}>{c.monthly_income ? formatCurrency(c.monthly_income) : '—'}</td>
                    <td className="p-3 text-[12px]" style={{ color: '#a8a29e' }}>{formatDate(c.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* New customer modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(28,25,23,0.5)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-lg animate-fade-in"
            style={{ ...cardStyle, padding: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-bold" style={{ color: '#1c1917' }}>לקוח חדש</h2>
              <button onClick={() => setShowNewModal(false)} style={{ color: '#a8a29e' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>שם פרטי *</label>
                  <input required value={newCustomer.first_name} onChange={e => setNewCustomer(p => ({ ...p, first_name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>שם משפחה *</label>
                  <input required value={newCustomer.last_name} onChange={e => setNewCustomer(p => ({ ...p, last_name: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>ת.ז</label>
                  <input value={newCustomer.id_number} onChange={e => setNewCustomer(p => ({ ...p, id_number: e.target.value }))} style={inputStyle} dir="ltr" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>טלפון</label>
                  <input value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} style={inputStyle} dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>אימייל</label>
                <input type="email" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} style={inputStyle} dir="ltr" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>מקור הגעה</label>
                <select value={newCustomer.lead_source} onChange={e => setNewCustomer(p => ({ ...p, lead_source: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="">בחר...</option>
                  {['הפניה', 'פייסבוק', 'אינסטגרם', 'אתר', 'וואטסאפ', 'טלפון'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createCustomer.isPending}
                  className="flex-1 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ borderRadius: 12, background: '#059669' }}
                >
                  {createCustomer.isPending && <Loader2 size={15} className="animate-spin" />}
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80"
                  style={{ borderRadius: 12, background: '#f5f4f2', color: '#57534e' }}
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
