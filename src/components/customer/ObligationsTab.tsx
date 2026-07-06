import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Pencil } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui'
import {
  obligationService,
  totalMonthlyObligations,
  shouldIncludeInDti,
  DEFAULT_DTI_MONTHS_THRESHOLD,
} from '@/services/obligationService'
import { settingsService } from '@/services/settingsService'
import type { Obligation, ObligationType } from '@/types/database'

const OBLIGATION_TYPES: ObligationType[] = [
  'הלוואה בנקאית', 'הלוואה חוץ בנקאית', 'ליסינג', 'משכנתא קיימת', 'מזונות', 'אחר',
]

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#059669] focus:border-transparent outline-none text-sm'

interface Props {
  customerId: string
  existingObligationsFromQuestionnaire?: number | null
}

interface FormState {
  type: ObligationType
  lender: string
  monthly_payment: number
  balance: number
  end_date: string
  include_in_dti: boolean
  notes: string
}

const emptyForm: FormState = {
  type: 'הלוואה בנקאית',
  lender: '',
  monthly_payment: 0,
  balance: 0,
  end_date: '',
  include_in_dti: true,
  notes: '',
}

export default function ObligationsTab({ customerId, existingObligationsFromQuestionnaire }: Props) {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [threshold, setThreshold] = useState(DEFAULT_DTI_MONTHS_THRESHOLD)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await obligationService.getByCustomer(customerId)
    setObligations(data ?? [])
    setLoading(false)
  }, [customerId])

  useEffect(() => {
    load()
    settingsService.get().then(({ data }) => {
      if (data?.dti_obligation_months_threshold) setThreshold(data.dti_obligation_months_threshold)
    })
  }, [load])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (o: Obligation) => {
    setForm({
      type: o.type,
      lender: o.lender ?? '',
      monthly_payment: o.monthly_payment ?? 0,
      balance: o.balance ?? 0,
      end_date: o.end_date ? o.end_date.split('T')[0] : '',
      include_in_dti: o.include_in_dti,
      notes: o.notes ?? '',
    })
    setEditingId(o.id)
    setShowForm(true)
  }

  // Whenever the end date changes in the form, recompute the auto default for
  // include_in_dti — the advisor can still override it manually afterwards.
  const onEndDateChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      end_date: value,
      include_in_dti: shouldIncludeInDti(value || null, threshold),
    }))
  }

  const save = async () => {
    if (!form.lender.trim() && form.type !== 'מזונות') {
      toast.error('חסר שם מלווה')
      return
    }
    setSaving(true)
    const payload = {
      customer_id: customerId,
      type: form.type,
      lender: form.lender.trim() || null,
      monthly_payment: form.monthly_payment || 0,
      balance: form.balance || null,
      end_date: form.end_date || null,
      include_in_dti: form.include_in_dti,
      notes: form.notes.trim() || null,
    }
    const { error } = editingId
      ? await obligationService.update(editingId, payload)
      : await obligationService.create(payload)
    setSaving(false)
    if (error) {
      toast.error('שגיאה בשמירה', error.message)
      return
    }
    toast.success(editingId ? 'ההתחייבות עודכנה' : 'ההתחייבות נוספה')
    resetForm()
    load()
  }

  const toggleInclude = async (o: Obligation) => {
    await obligationService.update(o.id, { include_in_dti: !o.include_in_dti })
    load()
  }

  const remove = async (id: string) => {
    await obligationService.delete(id)
    load()
  }

  const total = totalMonthlyObligations(obligations)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="text-[#059669] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legacy questionnaire value hint */}
      {obligations.length === 0 && !!existingObligationsFromQuestionnaire && existingObligationsFromQuestionnaire > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            יתרת התחייבויות מהשאלון: {formatCurrency(existingObligationsFromQuestionnaire)} — פרט להחזרים חודשיים לחישוב מדויק של יחס ההחזר.
          </span>
        </div>
      )}

      {/* Add / edit form */}
      {showForm ? (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">{editingId ? 'עריכת התחייבות' : 'התחייבות חדשה'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">סוג</label>
              <select className={`${inputClass} bg-white`} value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as ObligationType })}>
                {OBLIGATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">מלווה</label>
              <input className={inputClass} value={form.lender}
                onChange={e => setForm({ ...form, lender: e.target.value })} placeholder="שם הבנק / הגוף" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">החזר חודשי (₪)</label>
              <input className={inputClass} type="number" dir="ltr" value={form.monthly_payment || ''}
                onChange={e => setForm({ ...form, monthly_payment: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">יתרה (₪)</label>
              <input className={inputClass} type="number" dir="ltr" value={form.balance || ''}
                onChange={e => setForm({ ...form, balance: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">מועד סיום</label>
              <input className={inputClass} type="date" dir="ltr" value={form.end_date}
                onChange={e => onEndDateChange(e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                <input type="checkbox" checked={form.include_in_dti}
                  onChange={e => setForm({ ...form, include_in_dti: e.target.checked })} />
                נכלל ביחס ההחזר
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              ביטול
            </button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-[#059669] text-white px-4 py-2 rounded-lg hover:bg-[#047857] transition-colors text-sm disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {editingId ? 'עדכן' : 'הוסף'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setForm(emptyForm); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-[#059669] text-white px-4 py-2 rounded-lg hover:bg-[#047857] transition-colors text-sm">
          <Plus size={16} /> הוסף התחייבות
        </button>
      )}

      {/* Table */}
      {obligations.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">אין התחייבויות רשומות</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-600">
                <th className="text-right pb-2 font-medium">סוג</th>
                <th className="text-right pb-2 font-medium">מלווה</th>
                <th className="text-right pb-2 font-medium">החזר חודשי</th>
                <th className="text-right pb-2 font-medium">יתרה</th>
                <th className="text-right pb-2 font-medium">סיום</th>
                <th className="text-right pb-2 font-medium">נכלל ב-DTI</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {obligations.map(o => {
                const autoInclude = shouldIncludeInDti(o.end_date, threshold)
                const overridden = o.include_in_dti !== autoInclude
                return (
                  <tr key={o.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{o.type}</td>
                    <td className="py-2 text-gray-700">{o.lender || '—'}</td>
                    <td className="py-2 text-gray-900 font-medium">{formatCurrency(o.monthly_payment || 0)}</td>
                    <td className="py-2 text-gray-600">{o.balance ? formatCurrency(o.balance) : '—'}</td>
                    <td className="py-2 text-gray-600" dir="ltr">{o.end_date ? formatDate(o.end_date) : '—'}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleInclude(o)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            o.include_in_dti ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {o.include_in_dti ? '✓ כן' : '✗ לא'}
                        </button>
                        {overridden && (
                          <span title="נדרס ידנית ביחס לחוק 18 החודשים" className="text-amber-500">
                            <AlertTriangle size={13} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => startEdit(o)} className="text-gray-300 hover:text-[#059669] transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove(o.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50">
                <td colSpan={2} className="py-2 font-bold text-gray-900">סה"כ החזרים חודשיים הנכללים</td>
                <td className="py-2 font-bold text-[#059669]">{formatCurrency(total)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
