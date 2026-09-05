import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Upload, FileCheck, Pencil, Home } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast, AddressInput } from '@/components/ui'
import { appraisalService } from '@/services/appraisalService'
import { documentService } from '@/services/documentService'
import { additionalEquityRequired } from '@/utils/mortgageCalculations'
import type { Appraisal, AppraisalStatus, PropertyType } from '@/types/database'

const STATUSES: AppraisalStatus[] = ['הוזמנה', 'בוצע ביקור', 'התקבלה']

const statusColors: Record<AppraisalStatus, string> = {
  'הוזמנה': 'bg-yellow-100 text-yellow-700',
  'בוצע ביקור': 'bg-blue-100 text-blue-700',
  'התקבלה': 'bg-green-100 text-green-700',
}

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#059669] focus:border-transparent outline-none text-sm'

interface Props {
  customerId: string
  mortgageId?: string | null
  loanAmount?: number
  propertyPrice?: number
  propertyType?: PropertyType | null
}

interface FormState {
  property_address: string
  appraiser_name: string
  appraiser_phone: string
  status: AppraisalStatus
  ordered_at: string
  scheduled_at: string
  received_at: string
  purchase_price: number
  appraised_value: number
  notes: string
}

export default function AppraisalSection({ customerId, mortgageId, loanAmount, propertyPrice, propertyType }: Props) {
  const [appraisals, setAppraisals] = useState<Appraisal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const emptyForm: FormState = {
    property_address: '',
    appraiser_name: '',
    appraiser_phone: '',
    status: 'הוזמנה',
    ordered_at: new Date().toISOString().split('T')[0],
    scheduled_at: '',
    received_at: '',
    purchase_price: propertyPrice ?? 0,
    appraised_value: 0,
    notes: '',
  }
  const [form, setForm] = useState<FormState>(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await appraisalService.getByCustomer(customerId)
    setAppraisals(data ?? [])
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (a: Appraisal) => {
    setForm({
      property_address: a.property_address ?? '',
      appraiser_name: a.appraiser_name ?? '',
      appraiser_phone: a.appraiser_phone ?? '',
      status: a.status,
      ordered_at: a.ordered_at ? a.ordered_at.split('T')[0] : '',
      scheduled_at: a.scheduled_at ? a.scheduled_at.split('T')[0] : '',
      received_at: a.received_at ? a.received_at.split('T')[0] : '',
      purchase_price: a.purchase_price ?? 0,
      appraised_value: a.appraised_value ?? 0,
      notes: a.notes ?? '',
    })
    setEditingId(a.id)
    setShowForm(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      customer_id: customerId,
      mortgage_id: mortgageId ?? null,
      property_address: form.property_address.trim() || null,
      appraiser_name: form.appraiser_name.trim() || null,
      appraiser_phone: form.appraiser_phone.trim() || null,
      status: form.status,
      ordered_at: form.ordered_at || null,
      scheduled_at: form.scheduled_at || null,
      received_at: form.received_at || null,
      purchase_price: form.purchase_price || null,
      appraised_value: form.appraised_value || null,
      document_id: editingId ? undefined : null,
      notes: form.notes.trim() || null,
    }
    const { error } = editingId
      ? await appraisalService.update(editingId, payload)
      : await appraisalService.create({ ...payload, document_id: null })
    setSaving(false)
    if (error) {
      toast.error('שגיאה בשמירה', error.message)
      return
    }
    toast.success(editingId ? 'השמאות עודכנה' : 'השמאות נוספה')
    resetForm()
    load()
  }

  const remove = async (id: string) => {
    await appraisalService.delete(id)
    load()
  }

  const triggerUpload = (appraisalId: string) => {
    uploadTargetRef.current = appraisalId
    fileRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const appraisalId = uploadTargetRef.current
    e.target.value = ''
    if (!file || !appraisalId) return
    setUploadingFor(appraisalId)
    const { data, error } = await documentService.upload(customerId, file, 'דוח שמאות', 'נכס')
    if (error || !data) {
      toast.error('שגיאה בהעלאת הדוח', error?.message)
    } else {
      await appraisalService.update(appraisalId, { document_id: data.id })
      toast.success('דוח השמאות הועלה')
      load()
    }
    setUploadingFor(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="text-[#059669] animate-spin" />
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <input ref={fileRef} type="file" hidden accept="image/*,application/pdf" onChange={handleFile} />
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <Home size={16} className="text-[#059669]" /> שמאות
        </h4>
        {!showForm && (
          <button onClick={() => { setForm(emptyForm); setShowForm(true) }}
            className="inline-flex items-center gap-1.5 text-sm text-[#059669] hover:text-[#047857] transition-colors">
            <Plus size={15} /> הזמן שמאות
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">סטטוס</label>
              <select className={`${inputClass} bg-white`} value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as AppraisalStatus })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">שמאי</label>
              <input className={inputClass} value={form.appraiser_name}
                onChange={e => setForm({ ...form, appraiser_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">טלפון שמאי</label>
              <input className={inputClass} dir="ltr" value={form.appraiser_phone}
                onChange={e => setForm({ ...form, appraiser_phone: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-gray-500 mb-1" htmlFor="appraisal-property-address">כתובת הנכס</label>
              <AddressInput
                id="appraisal-property-address"
                className={inputClass}
                value={form.property_address}
                onChange={property_address => setForm({ ...form, property_address })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">הוזמנה</label>
              <input className={inputClass} type="date" dir="ltr" value={form.ordered_at}
                onChange={e => setForm({ ...form, ordered_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">מועד ביקור</label>
              <input className={inputClass} type="date" dir="ltr" value={form.scheduled_at}
                onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">התקבלה</label>
              <input className={inputClass} type="date" dir="ltr" value={form.received_at}
                onChange={e => setForm({ ...form, received_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">מחיר רכישה (₪)</label>
              <input className={inputClass} type="number" dir="ltr" value={form.purchase_price || ''}
                onChange={e => setForm({ ...form, purchase_price: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">שווי שמאות (₪)</label>
              <input className={inputClass} type="number" dir="ltr" value={form.appraised_value || ''}
                onChange={e => setForm({ ...form, appraised_value: +e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">ביטול</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-[#059669] text-white px-4 py-2 rounded-lg hover:bg-[#047857] transition-colors text-sm disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {editingId ? 'עדכן' : 'הוסף'}
            </button>
          </div>
        </div>
      )}

      {appraisals.length === 0 && !showForm && (
        <p className="text-center text-sm text-gray-400 py-4">לא הוזמנה שמאות</p>
      )}

      {appraisals.map(a => {
        const isLow = !!a.appraised_value && !!a.purchase_price && a.appraised_value < a.purchase_price
        const gap = isLow ? a.purchase_price! - a.appraised_value! : 0
        const extraEquity = isLow && loanAmount && propertyType
          ? additionalEquityRequired(loanAmount, a.purchase_price!, a.appraised_value!, propertyType)
          : 0
        return (
          <div key={a.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.status]}`}>{a.status}</span>
                {a.appraiser_name && <span className="text-sm text-gray-700">{a.appraiser_name}</span>}
                {a.property_address && <span className="text-xs text-gray-400">· {a.property_address}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(a)} className="text-gray-300 hover:text-[#059669] transition-colors"><Pencil size={14} /></button>
                <button onClick={() => remove(a.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div><span className="text-xs text-gray-400 block">מחיר רכישה</span>{a.purchase_price ? formatCurrency(a.purchase_price) : '—'}</div>
              <div><span className="text-xs text-gray-400 block">שווי שמאות</span>{a.appraised_value ? formatCurrency(a.appraised_value) : '—'}</div>
              <div><span className="text-xs text-gray-400 block">מועד ביקור</span><span dir="ltr">{a.scheduled_at ? formatDate(a.scheduled_at) : '—'}</span></div>
              <div><span className="text-xs text-gray-400 block">התקבלה</span><span dir="ltr">{a.received_at ? formatDate(a.received_at) : '—'}</span></div>
            </div>

            {isLow && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  ⚠️ השמאות נמוכה ממחיר הרכישה ב-{formatCurrency(gap)}.
                  {extraEquity > 0 && <> הון עצמי נוסף נדרש: <b>{formatCurrency(extraEquity)}</b></>}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {a.document_id ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                  <FileCheck size={14} /> דוח הועלה
                </span>
              ) : (
                <button onClick={() => triggerUpload(a.id)} disabled={uploadingFor === a.id}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#059669] transition-colors disabled:opacity-50">
                  {uploadingFor === a.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  העלה דוח שמאות
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
