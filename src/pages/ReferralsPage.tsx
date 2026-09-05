import { useState } from 'react'
import { Share2, Plus, Phone, TrendingUp, Loader2, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useReferrals, useCreateReferral } from '@/hooks/queries/useReferrals'
import { toast } from '@/components/ui'

const partnerTypes = ['סוכן נדל"ן', 'עו"ד', 'רו"ח', 'לקוח קיים', 'אחר']

const cardStyle = {
  background: 'var(--color-card)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border)',
}

export default function ReferralsPage() {
  const [showNewModal, setShowNewModal] = useState(false)
  const [newPartner, setNewPartner] = useState({
    name: '', type: 'סוכן נדל"ן', phone: '', email: '', company: '',
  })

  const { data: partners = [], isLoading: loading } = useReferrals()
  const createReferral = useCreateReferral()

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPartner.name.trim()) return
    createReferral.mutate(
      {
        name: newPartner.name,
        type: newPartner.type,
        phone: newPartner.phone,
        email: newPartner.email,
        company: newPartner.company,
        total_referrals: 0,
        converted_referrals: 0,
        notes: null,
        last_contact: null,
      },
      {
        onSuccess: () => {
          setShowNewModal(false)
          setNewPartner({ name: '', type: 'סוכן נדל"ן', phone: '', email: '', company: '' })
          toast.success('השותף נשמר בהצלחה')
        },
        onError: (err) => toast.error('שגיאה בשמירת שותף', err.message),
      }
    )
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--color-border)',
    borderRadius: 10,
    fontSize: 14,
    color: 'var(--color-text)',
    background: 'var(--color-card)',
    outline: 'none',
    fontFamily: 'var(--font-heebo)',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} style={{ color: 'var(--color-primary)' }} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="crm-page animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>שותפי הפניה</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{partners.length} שותפים</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="crm-btn-primary flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.96] shrink-0"
          style={{ borderRadius: 12, background: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 27%, transparent)' }}
        >
          <Plus size={15} />
          מפנה חדש
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center" style={{ ...cardStyle, padding: 48 }}>
          <Share2 size={40} style={{ color: '#d6d3d1' }} className="mb-3" />
          <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-sub)' }}>אין שותפי הפניה עדיין</p>
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>הוסף את שותף ההפניה הראשון שלך</p>
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
                    <h3 className="text-[14px] font-bold" style={{ color: 'var(--color-text)' }}>{partner.name}</h3>
                    <span
                      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1"
                      style={{ background: 'var(--color-success-bg)', color: '#065f46' }}
                    >{partner.type}</span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                      <TrendingUp size={13} />
                      <span className="font-black text-[16px]">{rate}%</span>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>המרה</span>
                  </div>
                </div>

                {partner.company && (
                  <p className="text-[13px] mb-2" style={{ color: 'var(--color-text-sub)' }}>{partner.company}</p>
                )}
                {partner.phone && (
                  <div className="flex items-center gap-1.5 text-[13px] mb-3" style={{ color: 'var(--color-text-sub)' }} dir="ltr">
                    <Phone size={12} style={{ color: 'var(--color-text-muted)' }} />
                    {partner.phone}
                  </div>
                )}

                <div
                  className="flex justify-between text-[13px] pt-3"
                  style={{ borderTop: '1px solid var(--color-border-light)' }}
                >
                  <span style={{ color: 'var(--color-text-muted)' }}>הפניות: <strong style={{ color: 'var(--color-text)' }}>{partner.total_referrals}</strong></span>
                  <span style={{ color: 'var(--color-primary)' }}>נסגרו: <strong>{partner.converted_referrals}</strong></span>
                </div>
                {partner.last_contact && (
                  <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>קשר אחרון: {formatDate(partner.last_contact)}</p>
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
              <h2 className="text-[17px] font-bold" style={{ color: 'var(--color-text)' }}>מפנה חדש</h2>
              <button onClick={() => setShowNewModal(false)} style={{ color: 'var(--color-text-muted)' }}>
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
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
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
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>סוג</label>
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
                  disabled={createReferral.isPending}
                  className="flex-1 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ borderRadius: 12, background: 'var(--color-primary)' }}
                >
                  {createReferral.isPending ? 'שומר...' : 'שמור'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80"
                  style={{ borderRadius: 12, background: 'var(--color-border-light)', color: 'var(--color-text-sub)' }}
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
