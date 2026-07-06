import { useEffect, useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui'
import { mortgageService } from '@/services/mortgageService'
import { referralService } from '@/services/referralService'
import type { MortgageWithTracks, ReferralPartner } from '@/types/database'

type InsuranceStatus = 'נדרש' | 'בתהליך' | 'הופק'
const STATUSES: InsuranceStatus[] = ['נדרש', 'בתהליך', 'הופק']

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#059669] focus:border-transparent outline-none text-sm bg-white'

interface Props {
  mortgage: MortgageWithTracks
  onUpdated?: () => void
}

export default function InsuranceSection({ mortgage, onUpdated }: Props) {
  const [life, setLife] = useState<InsuranceStatus>((mortgage.life_insurance_status as InsuranceStatus) ?? 'נדרש')
  const [property, setProperty] = useState<InsuranceStatus>((mortgage.property_insurance_status as InsuranceStatus) ?? 'נדרש')
  const [partnerId, setPartnerId] = useState(mortgage.insurance_referral_partner_id ?? '')
  const [partners, setPartners] = useState<ReferralPartner[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    referralService.getAll().then(({ data }) => { if (data) setPartners(data) })
  }, [])

  const persist = async (updates: Partial<MortgageWithTracks>) => {
    setSaving(true)
    const { error } = await mortgageService.update(mortgage.id, updates)
    setSaving(false)
    if (error) toast.error('שגיאה בשמירה', error.message)
    else onUpdated?.()
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
        <ShieldCheck size={15} className="text-[#059669]" /> ביטוח
        {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </h5>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ביטוח חיים</label>
          <select className={inputClass} value={life}
            onChange={e => { const v = e.target.value as InsuranceStatus; setLife(v); persist({ life_insurance_status: v }) }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ביטוח מבנה</label>
          <select className={inputClass} value={property}
            onChange={e => { const v = e.target.value as InsuranceStatus; setProperty(v); persist({ property_insurance_status: v }) }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">שותף הפניה לביטוח</label>
          <select className={inputClass} value={partnerId}
            onChange={e => { setPartnerId(e.target.value); persist({ insurance_referral_partner_id: e.target.value || null }) }}>
            <option value="">ללא</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
