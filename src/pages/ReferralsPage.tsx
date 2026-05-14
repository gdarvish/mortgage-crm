import { useState, useEffect, useCallback } from 'react'
import { Share2, Plus, Phone, TrendingUp, Loader2, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { referralService } from '@/services/referralService'
import type { ReferralPartner } from '@/types/database'

const partnerTypes = ['סוכן נדל"ן', 'עו"ד', 'רו"ח', 'לקוח קיים', 'אחר']

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

export default function ReferralsPage() {
  const [partners, setPartners] = useState<ReferralPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newPartner, setNewPartner] = useState({
    name: '', type: 'סוכן נדל"ן', phone: '', email: '', company: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await referralService.getAll()
    if (data) setPartners(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPartner.name.trim()) return
    setSaving(true)
    const { error } = await referralService.create({
      name: newPartner.name,
      type: newPartner.type,
      phone: newPartner.phone,
      email: newPartner.email,
      company: newPartner.company,
      total_referrals: 0,
      converted_referrals: 0,
      notes: null,
      last_contact: null,
    })
    if (error) {
      alert('שגיאה בשמירת שותף: ' + error.message)
    } else {
      setShowNewModal(false)
      setNewPartner({ name: '', type: 'סוכן נדל"ן', phone: '', email: '', company: '' })
      fetchData()
    }
    setSaving(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: '#059669' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>שותפי הפניה</h1>
          <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>{partners.length} שותפים</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.96] shrink-0"
          style={{ borderRadius: 12, background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
        >
          <Plus size={15} />
          מפנה חדש
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center" style={{ ...cardStyle, padding: 48 }}>
          <Share2 size={40} style={{ color: '#d6d3d1' }} className="mb-3" />
          <p className="text-[15px] font-semibold" style={{ color: '#57534e' }}>אין שותפי הפניה עדיין</p>
          <p className="text-[13px] mt-1" style={{ color: '#a8a29e' }}>הוסף את שותף ההפניה הראשון שלך</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map((partner, i) => {
            const rate = partner.total_referrals > 0
              ? Math.round((partner.converted_referrals / partner.total_referrals) * 100)
              : 0
            return (
              <div
                key={partner.id}
                style={{ ...cardStyle, padding: '20px 22px', animationName: 'fadeUp', animationDuration: '0.4s', animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-[14px] font-bold" style={{ color: '#1c1917' }}>{partner.name}</h3>
                    <span
                      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1"
                      style={{ background: '#d1fae5', color: '#065f46' }}
                    >{partner.type}</span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1" style={{ color: '#059669' }}>
                      <TrendingUp size={13} />
                      <span className="font-black text-[16px]">{rate}%</span>
                    </div>
                    <span className="text-[11px]" style={{ color: '#a8a29e' }}>המרה</span>
                  </div>
                </div>

                {partner.company && (
                  <p className="text-[13px] mb-2" style={{ color: '#57534e' }}>{partner.company}</p>
                )}
                {partner.phone && (
                  <div className="flex items-center gap-1.5 text-[13px] mb-3" style={{ color: '#57534e' }} dir="ltr">
                    <Phone size={12} style={{ color: '#a8a29e' }} />
                    {partner.phone}
                  </div>
                )}

                <div
                  className="flex justify-between text-[13px] pt-3"
                  style={{ borderTop: '1px solid #f5f4f2' }}
                >
                  <span style={{ color: '#a8a29e' }}>הפניות: <strong style={{ color: '#1c1917' }}>{partner.total_referrals}</strong></span>
                  <span style={{ color: '#059669' }}>נסגרו: <strong>{partner.converted_referrals}</strong></span>
                </div>
                {partner.last_contact && (
                  <p className="text-[11px] mt-2" style={{ color: '#a8a29e' }}>קשר אחרון: {formatDate(partner.last_contact)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New partner modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(28,25,23,0.5)' }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-md animate-fade-in"
            style={{ ...cardStyle, padding: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-bold" style={{ color: '#1c1917' }}>מפנה חדש</h2>
              <button onClick={() => setShowNewModal(false)} style={{ color: '#a8a29e' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              {[
                { label: 'שם', field: 'name' as const, required: true },
                { label: 'טלפון', field: 'phone' as const, dir: 'ltr' },
                { label: 'אימייל', field: 'email' as const, dir: 'ltr' },
                { label: 'חברה', field: 'company' as const },
              ].map(({ label, field, required, dir }) => (
                <div key={field}>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>{label}</label>
                  <input
                    required={required}
                    value={newPartner[field]}
                    onChange={e => setNewPartner(p => ({ ...p, [field]: e.target.value }))}
                    style={inputStyle}
                    dir={dir as 'ltr' | undefined}
                  />
                </div>
              ))}

              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>סוג</label>
                <select
                  value={newPartner.type}
                  onChange={e => setNewPartner(p => ({ ...p, type: e.target.value }))}
                  style={{ ...inputStyle }}
                >
                  {partnerTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ borderRadius: 12, background: '#059669' }}
                >
                  {saving ? 'שומר...' : 'שמור'}
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
