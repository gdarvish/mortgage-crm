import { useState, useEffect, useRef } from 'react'
import { Settings, UploadCloud, CheckSquare, Check, Bell, Trash2, Loader2, Users } from 'lucide-react'
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { settingsService } from '@/services/settingsService'
import { toast } from '@/components/ui'
import { useTheme, useThemeControls } from '@/theme/ThemeContext'
import { THEMES, type Theme } from '@/theme/themes'

export default function SettingsPage() {
  const t = useTheme()
  const { themeId, setThemeId } = useThemeControls()
  const [settings, setSettings] = useState({
    name: '',
    title: 'יועץ משכנתאות',
    licenseNumber: '',
    phone: '',
    email: '',
    website: '',
    primaryColor: '#059669',
    secondaryColor: '#d1fae5',
    footerText: 'כל הזכויות שמורות © 2026',
    logoSize: 'medium',
    logoPosition: 'right',
    alertWindowMonths: 6,
    logo_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    settingsService.get().then(({ data }) => {
      if (data) {
        setSettings(prev => ({
          ...prev,
          name: data.name ?? '',
          title: data.title ?? 'יועץ משכנתאות',
          licenseNumber: data.license_number ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          website: data.website ?? '',
          primaryColor: data.primary_color ?? '#059669',
          secondaryColor: data.secondary_color ?? '#d1fae5',
          footerText: data.footer_text ?? 'כל הזכויות שמורות © 2026',
          logoSize: data.logo_size ?? 'medium',
          logoPosition: data.logo_position ?? 'right',
          alertWindowMonths: data.alert_window_months ?? 6,
          logo_url: data.logo_url ?? '',
        }))
      }
    })
  }, [])

  const updateField = (field: string, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await settingsService.upsert({
      name: settings.name,
      title: settings.title,
      license_number: settings.licenseNumber,
      phone: settings.phone,
      email: settings.email,
      website: settings.website,
      primary_color: settings.primaryColor,
      secondary_color: settings.secondaryColor,
      footer_text: settings.footerText,
      logo_size: settings.logoSize,
      logo_position: settings.logoPosition,
      alert_window_months: settings.alertWindowMonths,
      logo_url: settings.logo_url,
    })
    setSaving(false)
    if (error) {
      toast.error('שגיאה בשמירה', error.message)
    } else {
      setSaved(true)
      toast.success('ההגדרות נשמרו בהצלחה')
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const { url, error } = await settingsService.uploadLogo(file)
    if (url) {
      setSettings(prev => ({ ...prev, logo_url: url }))
      await settingsService.upsert({ logo_url: url })
      toast.success('הלוגו הועלה בהצלחה')
    } else if (error) {
      toast.error('שגיאה בהעלאת לוגו', error.message)
    }
    setUploadingLogo(false)
    e.target.value = ''
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`,
    borderRadius: 9, fontSize: 13, color: t.text, background: t.inputBg,
    outline: 'none', fontFamily: 'Heebo,sans-serif',
  }
  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5,
  }
  const cardSt: React.CSSProperties = {
    background: t.cardBg, borderRadius: 20, padding: '22px 24px',
    boxShadow: t.shadow, border: `1px solid ${t.border}`,
  }
  const cardIconSt: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 9, background: t.primary + '18',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={22} style={{ color: t.primary }} />
            הגדרות
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>פרטי היועץ, ברנד והגדרות מערכת</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* Logo Upload */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={cardIconSt}><UploadCloud size={14} style={{ color: t.primary }} /></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>לוגו</h3>
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
            <div
              onClick={() => logoInputRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border }}
              style={{
                border: `2px dashed ${t.border}`, borderRadius: 14, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer', background: t.bg, transition: 'border-color 0.15s',
              }}
            >
              {uploadingLogo ? (
                <Loader2 size={32} className="animate-spin" style={{ color: t.primary, margin: '0 auto 10px', display: 'block' }} />
              ) : settings.logo_url ? (
                <img src={settings.logo_url} alt="לוגו" style={{ height: 56, margin: '0 auto 10px', display: 'block', objectFit: 'contain' }} />
              ) : (
                <div style={{
                  width: 52, height: 52, borderRadius: 14, background: t.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px',
                }}>
                  <UploadCloud size={22} style={{ color: t.textMuted }} />
                </div>
              )}
              <p style={{ fontSize: 13, color: t.textSub, fontWeight: 500 }}>
                {settings.logo_url ? 'לחץ להחלפת לוגו' : 'גרור או לחץ להעלאת לוגו'}
              </p>
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>PNG, JPG, SVG עד 5MB</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <div>
                <label style={labelSt}>גודל</label>
                <select value={settings.logoSize} onChange={e => updateField('logoSize', e.target.value)} style={inputSt}>
                  <option value="small">קטן</option>
                  <option value="medium">בינוני</option>
                  <option value="large">גדול</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>מיקום</label>
                <select value={settings.logoPosition} onChange={e => updateField('logoPosition', e.target.value)} style={inputSt}>
                  <option value="right">ימין</option>
                  <option value="center">מרכז</option>
                  <option value="left">שמאל</option>
                </select>
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={cardIconSt}><Users size={14} style={{ color: t.primary }} /></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>פרטי עסק</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field t={t} label="שם מלא" value={settings.name} onChange={v => updateField('name', v)} />
                <Field t={t} label="תואר" value={settings.title} onChange={v => updateField('title', v)} />
              </div>
              <Field t={t} label="מספר רישיון" value={settings.licenseNumber} onChange={v => updateField('licenseNumber', v)} dir="ltr" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field t={t} label="טלפון" value={settings.phone} onChange={v => updateField('phone', v)} dir="ltr" />
                <Field t={t} label="אימייל" value={settings.email} onChange={v => updateField('email', v)} type="email" dir="ltr" />
              </div>
              <Field t={t} label="אתר אינטרנט" value={settings.website} onChange={v => updateField('website', v)} type="url" dir="ltr" />
            </div>
          </div>

          {/* Colors & Brand */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={cardIconSt}><span style={{ fontSize: 15 }}>🎨</span></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>צבעים ומיתוג</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([['צבע ראשי', 'primaryColor'], ['צבע משני', 'secondaryColor']] as const).map(([lbl, fld]) => (
                <div key={fld}>
                  <label style={labelSt}>{lbl}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="color" value={settings[fld]} onChange={e => updateField(fld, e.target.value)}
                      style={{ width: 40, height: 38, borderRadius: 9, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2, background: 'transparent' }}
                    />
                    <input value={settings[fld]} onChange={e => updateField(fld, e.target.value)} style={{ ...inputSt, flex: 1 }} dir="ltr" />
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: settings[fld], flexShrink: 0, border: `1px solid ${t.border}` }} />
                  </div>
                </div>
              ))}
              <div>
                <label style={labelSt}>טקסט תחתית</label>
                <input value={settings.footerText} onChange={e => updateField('footerText', e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>בחר צבע מהיר</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {['#059669', '#2563eb', '#d97706', '#8b5cf6', '#dc2626', '#0891b2', '#ea580c', '#0f172a'].map(col => (
                    <div
                      key={col}
                      onClick={() => updateField('primaryColor', col)}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.18)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      style={{
                        width: 32, height: 32, borderRadius: 9, background: col, cursor: 'pointer',
                        border: settings.primaryColor === col ? `3px solid ${t.text}` : '3px solid transparent',
                        boxShadow: settings.primaryColor === col ? `0 0 0 2px ${col}50` : 'none',
                        transition: 'transform 0.15s, border-color 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Theme Switcher */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={cardIconSt}><span style={{ fontSize: 15 }}>🌓</span></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>ערכת נושא</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.values(THEMES).map(th => {
                const active = themeId === th.id
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setThemeId(th.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                      fontFamily: 'Heebo,sans-serif', textAlign: 'right',
                      border: active ? `1.5px solid ${t.primary}` : `1.5px solid ${t.border}`,
                      background: active ? t.primary + '12' : t.bg,
                      boxShadow: active ? `0 0 0 3px ${t.primary}18` : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', background: th.primary,
                      flexShrink: 0, border: `2px solid ${t.cardBg}`, boxShadow: `0 0 0 1px ${t.border}`,
                    }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>{th.name}</span>
                    {active && <Check size={16} strokeWidth={3} style={{ color: t.primary }} />}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 12 }}>
              ערכת הנושא נשמרת במכשיר זה ומשנה את מראה כל המערכת
            </p>
          </div>

          {/* Alerts Settings */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={cardIconSt}><Bell size={14} style={{ color: t.primary }} /></div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>הגדרות התראות</h3>
            </div>
            <div>
              <label style={labelSt}>חלון התראות מסלולים (חודשים)</label>
              <input
                type="number" value={settings.alertWindowMonths}
                onChange={e => updateField('alertWindowMonths', +e.target.value)}
                style={{ ...inputSt, width: 120 }} dir="ltr"
              />
              <p style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>
                מסלולים שמסתיימים בתוך {settings.alertWindowMonths} חודשים יוצגו בהתראות
              </p>
            </div>
          </div>
        </div>

        {/* Save buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, animation: 'fadeUp 0.4s ease 0.3s backwards' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="crm-btn-primary"
            style={{
              background: saved ? t.success : t.primary, color: '#fff', border: 'none', borderRadius: 12,
              padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 4px 14px ${t.primary}45`, transition: 'background 0.3s ease',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> שומר...</>
              : saved
                ? <><Check size={15} strokeWidth={3} /> נשמר!</>
                : <><CheckSquare size={15} /> שמור הגדרות</>}
          </button>
        </div>

        {/* Danger Zone */}
        <DangerZone t={t} />
      </div>
    </div>
  )
}

interface FieldProps {
  t: Theme
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  dir?: 'ltr' | 'rtl'
}

function Field({ t, label, value, onChange, type = 'text', dir }: FieldProps) {
  const [focus, setFocus] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, letterSpacing: '0.03em' }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1.5px solid ${focus ? t.primary : t.border}`,
        borderRadius: 10, background: t.inputBg,
        boxShadow: focus ? `0 0 0 3px ${t.primary}18` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s', overflow: 'hidden',
      }}>
        <input
          type={type}
          value={value}
          dir={dir}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, padding: '10px 12px', border: 'none', outline: 'none',
            background: 'transparent', color: t.text, fontSize: 14, fontFamily: 'Heebo,sans-serif',
          }}
        />
      </div>
    </div>
  )
}

function DangerZone({ t }: { t: Theme }) {
  const [deleting, setDeleting] = useState(false)
  const [done, setDone] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const handleDelete = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setDeleting(true)
    try {
      // Delete every user-scoped collection — each doc carries user_id,
      // which the Firestore rules require the query to filter on.
      const userScoped = [
        'customers', 'leads', 'tasks', 'alerts', 'commissions', 'documents',
        'messages', 'referral_partners', 'mortgages', 'loan_tracks', 'bank_responses',
      ]
      for (const col of userScoped) {
        const snap = await getDocs(query(collection(db, col), where('user_id', '==', uid)))
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, col, d.id))))
      }

      setDone(true)
      setConfirm(false)
    } catch (e) {
      console.error('deleteAllData failed', e)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{
      background: t.cardBg, borderRadius: 20, padding: '22px 24px',
      boxShadow: t.shadow, border: `1.5px solid ${t.danger}40`, marginTop: 18,
      animation: 'fadeUp 0.4s ease 0.35s backwards',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Trash2 size={17} style={{ color: t.danger }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: t.danger }}>אזור מסוכן</h3>
      </div>
      <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
        מחיקת כל הנתונים מהמערכת — פעולה בלתי הפיכה
      </p>
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.success, fontSize: 13, fontWeight: 600 }}>
          <Check size={15} strokeWidth={3} />כל הנתונים נמחקו בהצלחה
        </div>
      ) : confirm ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ fontSize: 13, color: t.danger, fontWeight: 600 }}>האם אתה בטוח לחלוטין?</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: t.danger, color: '#fff', border: 'none', borderRadius: 9,
              padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Heebo,sans-serif', opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? 'מוחק...' : 'כן, מחק הכל'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            style={{
              background: t.bg, color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 9,
              padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo,sans-serif',
            }}
          >
            ביטול
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}40`, borderRadius: 10,
            padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Heebo,sans-serif',
          }}
        >
          <Trash2 size={14} />מחק את כל הנתונים
        </button>
      )}
    </div>
  )
}
