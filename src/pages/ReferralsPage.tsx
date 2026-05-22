import { useState } from 'react'
import { Share2, Plus, Phone, TrendingUp, Loader2, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useReferrals, useCreateReferral } from '@/hooks/queries/useReferrals'
import { toast } from '@/components/ui'
import { useTheme } from '@/theme/ThemeContext'

const partnerTypes = ['סוכן נדל"ן', 'עו"ד', 'רו"ח', 'לקוח קיים', 'אחר']

export default function ReferralsPage() {
  const t = useTheme()
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

  const totalRefs = partners.reduce((s, p) => s + p.total_referrals, 0)
  const totalConv = partners.reduce((s, p) => s + p.converted_referrals, 0)
  const globalRate = totalRefs ? Math.round((totalConv / totalRefs) * 100) : 0

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: `1.5px solid ${t.border}`,
    borderRadius: 10, fontSize: 14, color: t.text, background: t.inputBg,
    outline: 'none', fontFamily: 'Heebo,sans-serif',
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Share2 size={22} style={{ color: t.primary }} />
              שותפי הפניה
            </h1>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
              {partners.length} שותפים · {totalRefs} הפניות · {globalRate}% המרה
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="crm-btn-primary"
            style={{
              background: t.primary, color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 4px 14px ${t.primary}45`,
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            מפנה חדש
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
            <Loader2 size={32} style={{ color: t.primary }} className="animate-spin" />
          </div>
        ) : partners.length === 0 ? (
          <div style={{
            background: t.cardBg, borderRadius: 20, boxShadow: t.shadow, border: `1px solid ${t.border}`,
            padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <Share2 size={40} style={{ color: t.textMuted, marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: t.textSub }}>אין שותפי הפניה עדיין</p>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>הוסף את שותף ההפניה הראשון שלך</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 18 }}>
            {partners.map((partner, i) => {
              const rate = partner.total_referrals > 0
                ? Math.round((partner.converted_referrals / partner.total_referrals) * 100)
                : 0
              return (
                <PartnerCard key={partner.id} partner={partner} rate={rate} index={i} t={t} />
              )
            })}
          </div>
        )}

        {showNewModal && (
          <div
            onClick={() => setShowNewModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: t.cardBg, borderRadius: 20, padding: 28, width: '100%', maxWidth: 420,
                boxShadow: t.shadowHover, animation: 'scaleIn 0.25s ease', border: `1px solid ${t.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: t.text }}>מפנה חדש</h2>
                <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} style={{ color: t.textMuted }} />
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([
                  { label: 'שם', field: 'name' as const, required: true },
                  { label: 'טלפון', field: 'phone' as const, dir: 'ltr' as const },
                  { label: 'אימייל', field: 'email' as const, dir: 'ltr' as const },
                  { label: 'חברה', field: 'company' as const },
                ]).map(({ label, field, required, dir }) => (
                  <div key={field}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>{label}</label>
                    <input
                      required={required}
                      value={newPartner[field]}
                      onChange={e => setNewPartner(p => ({ ...p, [field]: e.target.value }))}
                      style={inputSt}
                      dir={dir}
                    />
                  </div>
                ))}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5 }}>סוג</label>
                  <select
                    value={newPartner.type}
                    onChange={e => setNewPartner(p => ({ ...p, type: e.target.value }))}
                    style={inputSt}
                  >
                    {partnerTypes.map(pt => <option key={pt}>{pt}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="submit"
                    disabled={createReferral.isPending}
                    className="crm-btn-primary"
                    style={{
                      flex: 1, background: t.primary, color: '#fff', border: 'none', borderRadius: 12,
                      padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'Heebo,sans-serif', boxShadow: `0 4px 14px ${t.primary}45`,
                      opacity: createReferral.isPending ? 0.5 : 1,
                    }}
                  >
                    {createReferral.isPending ? 'שומר...' : 'שמור'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="crm-btn"
                    style={{
                      flex: 1, background: t.bg, color: t.textSub, border: `1px solid ${t.border}`,
                      borderRadius: 12, padding: '11px 0', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Heebo,sans-serif',
                    }}
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface PartnerCardProps {
  partner: import('@/types/database').ReferralPartner
  rate: number
  index: number
  t: import('@/theme/themes').Theme
}

function PartnerCard({ partner, rate, index, t }: PartnerCardProps) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: t.cardBg, borderRadius: 20, padding: '20px 22px',
        boxShadow: hov ? t.shadowHover : t.shadow, border: `1px solid ${t.border}`,
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        animation: `fadeUp 0.4s ease ${index * 0.06 + 0.05}s backwards`, cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 5 }}>{partner.name}</h3>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
            background: t.successBg, color: t.success,
          }}>{partner.type}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <TrendingUp size={13} style={{ color: t.primary }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: t.primary }}>{rate}%</span>
          </div>
          <span style={{ fontSize: 11, color: t.textMuted }}>המרה</span>
        </div>
      </div>
      {partner.company && <p style={{ fontSize: 13, color: t.textSub, marginBottom: 8 }}>{partner.company}</p>}
      {partner.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.textSub, marginBottom: 12 }} dir="ltr">
          <Phone size={12} style={{ color: t.textMuted }} />{partner.phone}
        </div>
      )}
      <div style={{
        display: 'flex', justifyContent: 'space-between', paddingTop: 12,
        borderTop: `1px solid ${t.borderLight}`, fontSize: 13,
      }}>
        <span style={{ color: t.textMuted }}>הפניות: <strong style={{ color: t.text }}>{partner.total_referrals}</strong></span>
        <span style={{ color: t.primary }}>נסגרו: <strong>{partner.converted_referrals}</strong></span>
      </div>
      {partner.last_contact && (
        <p style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>קשר אחרון: {formatDate(partner.last_contact)}</p>
      )}
    </div>
  )
}
