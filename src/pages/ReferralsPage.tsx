import { useState } from 'react'
import { Share2, Plus, Phone, Mail, TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const partnerTypes = ['סוכן נדל"ן', 'עו"ד', 'רו"ח', 'לקוח קיים', 'אחר']

const mockPartners = [
  { id: '1', name: 'משה כהן', type: 'סוכן נדל"ן', phone: '050-1111111', email: 'moshe@realestate.com', company: 'כהן נדל"ן', totalReferrals: 12, convertedReferrals: 8, lastContact: '2026-03-28' },
  { id: '2', name: 'עו"ד שרה לוי', type: 'עו"ד', phone: '052-2222222', email: 'sara@law.com', company: 'לוי ושות', totalReferrals: 6, convertedReferrals: 4, lastContact: '2026-04-01' },
  { id: '3', name: 'רו"ח דוד', type: 'רו"ח', phone: '054-3333333', email: 'david@cpa.com', company: 'דוד CPA', totalReferrals: 3, convertedReferrals: 2, lastContact: '2026-03-15' },
  { id: '4', name: 'יעל אברהמי', type: 'לקוח קיים', phone: '050-4444444', email: 'yael@email.com', company: '', totalReferrals: 2, convertedReferrals: 1, lastContact: '2026-02-20' },
]

export default function ReferralsPage() {
  const [showNewModal, setShowNewModal] = useState(false)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Share2 className="text-[#1a4f8a]" size={28} />
          שותפי הפניה
        </h1>
        <button onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-2 bg-[#1a4f8a] text-white px-4 py-2 rounded-lg hover:bg-[#143d6b]">
          <Plus size={18} /> מפנה חדש
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockPartners.map(partner => {
          const rate = partner.totalReferrals > 0 ? Math.round((partner.convertedReferrals / partner.totalReferrals) * 100) : 0
          return (
            <div key={partner.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                  <span className="text-xs bg-[#e8f0fe] text-[#1a4f8a] px-2 py-0.5 rounded-full">{partner.type}</span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1 text-[#1a4f8a]">
                    <TrendingUp size={14} />
                    <span className="font-bold text-lg">{rate}%</span>
                  </div>
                  <span className="text-xs text-gray-400">המרה</span>
                </div>
              </div>
              {partner.company && <p className="text-sm text-gray-500 mb-2">{partner.company}</p>}
              <div className="flex gap-4 text-sm text-gray-600 mb-3">
                <span className="flex items-center gap-1" dir="ltr"><Phone size={12} /> {partner.phone}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
                <span className="text-gray-500">הפניות: <strong>{partner.totalReferrals}</strong></span>
                <span className="text-green-600">נסגרו: <strong>{partner.convertedReferrals}</strong></span>
              </div>
              <p className="text-xs text-gray-400 mt-2">קשר אחרון: {formatDate(partner.lastContact)}</p>
            </div>
          )
        })}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">מפנה חדש</h2>
            <form className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">שם</label><input className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">סוג</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white">{partnerTypes.map(t => <option key={t}>{t}</option>)}</select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label><input className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label><input type="email" className="w-full px-3 py-2 border border-gray-200 rounded-lg" dir="ltr" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">חברה</label><input className="w-full px-3 py-2 border border-gray-200 rounded-lg" /></div>
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
