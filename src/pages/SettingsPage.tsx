import { useState } from 'react'
import { Settings, Upload, Save, Eye } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    name: 'ישראל ישראלי',
    title: 'יועץ משכנתאות',
    licenseNumber: '12345',
    phone: '050-1234567',
    email: 'advisor@example.com',
    website: 'www.mortgage-advisor.co.il',
    primaryColor: '#1a4f8a',
    secondaryColor: '#e8f0fe',
    footerText: 'כל הזכויות שמורות © 2026',
    logoSize: 'medium',
    logoPosition: 'right',
    alertWindowMonths: 6,
  })

  const updateField = (field: string, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Settings className="text-[#1a4f8a]" size={28} />
        הגדרות
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">לוגו</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#1a4f8a] transition-colors cursor-pointer">
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600">גרור או לחץ להעלאת לוגו</p>
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

        {/* Alert Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">הגדרות התראות</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">חלון התראות מסלולים (חודשים)</label>
            <input type="number" value={settings.alertWindowMonths} onChange={e => updateField('alertWindowMonths', +e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">מסלולים שמסתיימים בתוך {settings.alertWindowMonths} חודשים יוצגו בהתראות</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex items-center gap-2 bg-[#1a4f8a] text-white px-6 py-2.5 rounded-lg hover:bg-[#143d6b] transition-colors">
          <Save size={18} /> שמור הגדרות
        </button>
        <button className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors">
          <Eye size={18} /> תצוגה מקדימה
        </button>
      </div>
    </div>
  )
}
