import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Pencil } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui'
import {
  obligationService,
  totalMonthlyObligations,
  shouldIncludeInDti,
  isCountedInDti,
  monthsUntilEnd,
  DEFAULT_DTI_MONTHS_THRESHOLD,
} from '@/services/obligationService'
import { settingsService } from '@/services/settingsService'
import type { Obligation, ObligationType } from '@/types/database'

const OBLIGATION_TYPES: ObligationType[] = [
  'הלוואה בנקאית', 'הלוואה חוץ בנקאית', 'ליסינג', 'משכנתא קיימת', 'מזונות', 'אחר',
]

const inputClass =
  'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm'

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
  /** null = follow the 18-month rule automatically. */
  dti_override: boolean | null
  notes: string
}

const emptyForm: FormState = {
  type: 'הלוואה בנקאית',
  lender: '',
  monthly_payment: 0,
  balance: 0,
  end_date: '',
  dti_override: null,
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
      dti_override: o.dti_override ?? null,
      notes: o.notes ?? '',
    })
    setEditingId(o.id)
    setShowForm(true)
  }

  // The end date no longer freezes a DTI flag — inclusion is derived from it on
  // every read — so this only records the date.
  const onEndDateChange = (value: string) => {
    setForm(prev => ({ ...prev, end_date: value }))
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
      dti_override: form.dti_override,
      // Kept in step for anything still reading the legacy field.
      include_in_dti: form.dti_override ?? shouldIncludeInDti(form.end_date || null, threshold),
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

  // Clicking the badge pins an explicit decision; clicking "אוטומטי" hands it
  // back to the 18-month rule.
  const setOverride = async (o: Obligation, value: boolean | null) => {
    await obligationService.update(o.id, {
      dti_override: value,
      include_in_dti: value ?? shouldIncludeInDti(o.end_date, threshold),
    })
    load()
  }

  const remove = async (id: string) => {
    await obligationService.delete(id)
    load()
  }

  const total = totalMonthlyObligations(obligations, threshold)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="text-[var(--color-primary)] animate-spin" />
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
        <div className="bg-[var(--color-bg)] rounded-xl p-4 border border-[var(--color-border-light)] space-y-3">
          <h4 className="text-sm font-medium text-[var(--color-text-sub)]">{editingId ? 'עריכת התחייבות' : 'התחייבות חדשה'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">סוג</label>
              <select className={`${inputClass} bg-[var(--color-card)]`} value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as ObligationType })}>
                {OBLIGATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">מלווה</label>
              <input className={inputClass} value={form.lender}
                onChange={e => setForm({ ...form, lender: e.target.value })} placeholder="שם הבנק / הגוף" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">החזר חודשי (₪)</label>
              <input className={inputClass} type="number" dir="ltr" value={form.monthly_payment || ''}
                onChange={e => setForm({ ...form, monthly_payment: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">יתרה (₪)</label>
              <input className={inputClass} type="number" dir="ltr" value={form.balance || ''}
                onChange={e => setForm({ ...form, balance: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">מועד סיום</label>
              <input className={inputClass} type="date" dir="ltr" value={form.end_date}
                onChange={e => onEndDateChange(e.target.value)} />
            </div>
            <div className="flex flex-col justify-end">
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">נכלל ביחס ההחזר</label>
              <select
                className={`${inputClass} bg-[var(--color-card)]`}
                value={form.dti_override === null ? 'auto' : form.dti_override ? 'yes' : 'no'}
                onChange={e => setForm({
                  ...form,
                  dti_override: e.target.value === 'auto' ? null : e.target.value === 'yes',
                })}
              >
                <option value="auto">
                  אוטומטי — לפי כלל {threshold} החודשים
                  {form.end_date ? ` (${shouldIncludeInDti(form.end_date, threshold) ? 'נספר' : 'לא נספר'})` : ''}
                </option>
                <option value="yes">נכלל — החלטה ידנית</option>
                <option value="no">לא נכלל — החלטה ידנית</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-sub)] bg-[var(--color-pill-bg)] hover:bg-[var(--color-border)] transition-colors">
              ביטול
            </button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {editingId ? 'עדכן' : 'הוסף'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setForm(emptyForm); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm">
          <Plus size={16} /> הוסף התחייבות
        </button>
      )}

      {/* Table */}
      {obligations.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-8">אין התחייבויות רשומות</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-[var(--color-text-sub)]">
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
                const counted = isCountedInDti(o, threshold)
                const overridden = o.dti_override !== null && o.dti_override !== undefined
                const monthsLeft = monthsUntilEnd(o.end_date)
                return (
                  <tr key={o.id} className="border-b border-[var(--color-border-light)]">
                    <td className="py-2 text-[var(--color-text)]">{o.type}</td>
                    <td className="py-2 text-[var(--color-text-sub)]">{o.lender || '—'}</td>
                    <td className="py-2 text-[var(--color-text)] font-medium">{formatCurrency(o.monthly_payment || 0)}</td>
                    <td className="py-2 text-[var(--color-text-sub)]">{o.balance ? formatCurrency(o.balance) : '—'}</td>
                    <td className="py-2 text-[var(--color-text-sub)]" dir="ltr">{o.end_date ? formatDate(o.end_date) : '—'}</td>
                    <td className="py-2">
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setOverride(o, !counted)}
                            title="לחץ כדי לקבוע ידנית"
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              counted ? 'bg-green-100 text-green-700' : 'bg-[var(--color-pill-bg)] text-[var(--color-text-muted)]'
                            }`}
                          >
                            {counted ? '✓ נספר ב-DTI' : '✗ לא נספר'}
                          </button>
                          {overridden && (
                            <span title="נקבע ידנית — אינו נגזר מכלל החודשים" className="text-amber-500">
                              <AlertTriangle size={13} />
                            </span>
                          )}
                        </div>
                        {overridden ? (
                          <button
                            onClick={() => setOverride(o, null)}
                            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                          >
                            החזר לחישוב אוטומטי
                          </button>
                        ) : !counted && monthsLeft !== null ? (
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {monthsLeft > 0 ? `מסתיים בעוד ${monthsLeft} חודשים` : 'הסתיים'}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => startEdit(o)} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove(o.id)} className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors">
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
                <td colSpan={2} className="py-2 font-bold text-[var(--color-text)]">סה"כ החזרים חודשיים הנכללים</td>
                <td className="py-2 font-bold text-[var(--color-primary)]">{formatCurrency(total)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
