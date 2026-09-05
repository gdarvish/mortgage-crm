import { useState, useEffect, useRef } from 'react'
import { Settings, Upload, Save, Eye, Trash2, Loader2, CheckCircle, Check } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { settingsService } from '@/services/settingsService'
import { regulatoryService } from '@/services/regulatoryService'
import { useThemeControls } from '@/theme/ThemeContext'
import { THEMES } from '@/theme/themes'
import { FALLBACK_REGULATORY_PARAMS } from '@/utils/regulatoryParams'
import { toast } from '@/components/ui'

export default function SettingsPage() {
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
    dtiWarnThreshold: FALLBACK_REGULATORY_PARAMS.dti_warn_threshold,
    dtiHardThreshold: FALLBACK_REGULATORY_PARAMS.dti_hard_threshold,
    logo_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Seed the thresholds from the regulator's published values, so an advisor
    // who never touches them still sees the numbers the app is actually using.
    regulatoryService.getInForceAt().then(params => {
      setSettings(prev => ({
        ...prev,
        dtiWarnThreshold: prev.dtiWarnThreshold || params.dti_warn_threshold,
        dtiHardThreshold: prev.dtiHardThreshold || params.dti_hard_threshold,
      }))
    })
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
          dtiWarnThreshold: data.dti_warn_threshold ?? prev.dtiWarnThreshold,
          dtiHardThreshold: data.dti_hard_threshold ?? prev.dtiHardThreshold,
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
      dti_warn_threshold: settings.dtiWarnThreshold,
      dti_hard_threshold: settings.dtiHardThreshold,
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

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
        <Settings style={{ color: '#059669' }} size={24} />
        הגדרות
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">לוגו</h2>
          <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#059669] transition-colors cursor-pointer"
            onClick={() => logoInputRef.current?.click()}
          >
            {uploadingLogo ? (
              <Loader2 size={32} className="mx-auto text-[#059669] animate-spin mb-2" />
            ) : settings.logo_url ? (
              <img src={settings.logo_url} alt="לוגו" className="h-16 mx-auto mb-2 object-contain" />
            ) : (
              <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            )}
            <p className="text-gray-600">{settings.logo_url ? 'לחץ להחלפת לוגו' : 'גרור או לחץ להעלאת לוגו'}</p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG עד 5MB</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">גודל</label>
              <select value={settings.logoSize} onChange={e => updateField('logoSize', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white">
                <option value="small">קטן</option>
                <option value="medium">בינוני</option>
                <option value="large">גדול</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">מיקום</label>
              <select value={settings.logoPosition} onChange={e => updateField('logoPosition', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white">
                <option value="right">ימין</option>
                <option value="center">מרכז</option>
                <option value="left">שמאל</option>
              </select>
            </div>
          </div>
        </div>

        {/* Business Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">פרטי עסק</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm text-gray-600 mb-1">שם מלא</label><input value={settings.name} onChange={e => updateField('name', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">תואר</label><input value={settings.title} onChange={e => updateField('title', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" /></div>
            </div>
            <div><label className="block text-sm text-gray-600 mb-1">מספר רישיון</label><input value={settings.licenseNumber} onChange={e => updateField('licenseNumber', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm text-gray-600 mb-1">טלפון</label><input value={settings.phone} onChange={e => updateField('phone', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">אימייל</label><input value={settings.email} onChange={e => updateField('email', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" /></div>
            </div>
            <div><label className="block text-sm text-gray-600 mb-1">אתר</label><input value={settings.website} onChange={e => updateField('website', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" /></div>
          </div>
        </div>

        {/* Colors */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">צבעים</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">צבע ראשי</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.primaryColor} onChange={e => updateField('primaryColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                <input value={settings.primaryColor} onChange={e => updateField('primaryColor', e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">צבע משני</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.secondaryColor} onChange={e => updateField('secondaryColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                <input value={settings.secondaryColor} onChange={e => updateField('secondaryColor', e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" dir="ltr" />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1">טקסט תחתית</label>
            <input value={settings.footerText} onChange={e => updateField('footerText', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          </div>
        </div>

        {/* Theme picker */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">ערכת נושא</h2>
          <div className="flex flex-col gap-2.5">
            {Object.values(THEMES).map(th => {
              const active = themeId === th.id
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setThemeId(th.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-xl border text-right transition-all ${
                    active
                      ? 'border-[#059669] ring-2 ring-[#059669]/15 bg-[#059669]/[0.06]'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className="w-5.5 h-5.5 rounded-full shrink-0 border-2 border-white"
                    style={{ width: 22, height: 22, background: th.primary, boxShadow: '0 0 0 1px #e7e5e4' }}
                  />
                  <span className="flex-1 text-sm font-semibold text-gray-900">{th.name}</span>
                  {active && <Check size={16} strokeWidth={3} className="text-[#059669]" />}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            ערכת הנושא נשמרת במכשיר זה ומשנה את מראה כל המערכת.
          </p>
        </div>

        {/* Alert Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">הגדרות התראות</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">חלון התראות מסלולים (חודשים)</label>
            <input type="number" value={settings.alertWindowMonths} onChange={e => updateField('alertWindowMonths', +e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">מסלולים שמסתיימים בתוך {settings.alertWindowMonths} חודשים יוצגו בהתראות</p>
          </div>
        </div>

        {/* Compliance thresholds */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">ספי יחס החזר (DTI)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">סף אזהרה (%)</label>
              <input
                type="number"
                value={settings.dtiWarnThreshold}
                onChange={e => updateField('dtiWarnThreshold', +e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">סף חריגה (%)</label>
              <input
                type="number"
                value={settings.dtiHardThreshold}
                onChange={e => updateField('dtiHardThreshold', +e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                dir="ltr"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            מעל {settings.dtiWarnThreshold}% התיק מסומן באזהרה כתומה; מעל {settings.dtiHardThreshold}% כחריגה אדומה.
            ברירת המחדל מגיעה מהפרמטרים הרגולטוריים המפורסמים; ערך שנקבע כאן גובר עליהם.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#059669] text-white px-6 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saved ? 'נשמר!' : 'שמור הגדרות'}
        </button>
        <button className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors">
          <Eye size={18} /> תצוגה מקדימה
        </button>
      </div>

      {/* Danger Zone */}
      <DangerZone />
    </div>
  )
}

function DangerZone() {
  const [deleting, setDeleting] = useState(false)
  const [done, setDone] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const fn = httpsCallable(functions, 'deleteAllUserData')
      await fn()
      setDone(true)
      setConfirm(false)
    } catch (e) {
      console.error('deleteAllData failed', e)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-red-200 p-5">
      <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
        <Trash2 size={17} /> אזור מסוכן
      </h2>
      <p className="text-sm text-gray-500 mb-4">מחיקת כל הנתונים מהמערכת — פעולה בלתי הפיכה</p>
      {done ? (
        <p className="text-sm font-medium text-green-600">✓ כל נתוני הלקוחות נמחקו (יומן הביקורת נשמר)</p>
      ) : confirm ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-red-600 font-medium">האם אתה בטוח לחלוטין?</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'מוחק...' : 'כן, מחק הכל'}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            ביטול
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
        >
          <Trash2 size={15} /> מחק את כל הנתונים
        </button>
      )}
    </div>
  )
}
