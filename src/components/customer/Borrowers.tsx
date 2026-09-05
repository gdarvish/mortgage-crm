import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Loader2, Pencil, Users, Info, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { validateIsraeliId } from '@/utils/israeliValidations'
import { toast } from '@/components/ui'
import { borrowerService, totalHouseholdIncome } from '@/services/borrowerService'
import { getChecklist } from '@/utils/documentChecklist'
import type { Borrower } from '@/types/database'

const inputClass =
  'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm'

const EMPLOYMENT_TYPES = ['שכיר', 'עצמאי', 'שכיר + עצמאי'] as const

type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

interface FormState {
  role: 'לווה שני' | 'ערב'
  first_name: string
  last_name: string
  id_number: string
  phone: string
  email: string
  birth_date: string
  employment_type: EmploymentType
  monthly_income: number
}

const emptyForm: FormState = {
  role: 'לווה שני',
  first_name: '',
  last_name: '',
  id_number: '',
  phone: '',
  email: '',
  birth_date: '',
  employment_type: 'שכיר',
  monthly_income: 0,
}

interface SectionProps {
  customerId: string
  primaryIncome?: number | null
  partnerIncome?: number | null
}

export function BorrowersSection({ customerId, primaryIncome, partnerIncome }: SectionProps) {
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await borrowerService.getByCustomer(customerId)
    setBorrowers(data ?? [])
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false) }

  const startEdit = (b: Borrower) => {
    setForm({
      role: b.role,
      first_name: b.first_name,
      last_name: b.last_name,
      id_number: b.id_number ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      birth_date: b.birth_date ? b.birth_date.split('T')[0] : '',
      employment_type: (b.employment_type as EmploymentType) ?? 'שכיר',
      monthly_income: b.monthly_income ?? 0,
    })
    setEditingId(b.id)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { toast.error('חסר שם'); return }
    if (form.id_number && !validateIsraeliId(form.id_number)) { toast.error('ת.ז לא תקינה'); return }
    setSaving(true)
    const payload = {
      customer_id: customerId,
      role: form.role,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      id_number: form.id_number.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      birth_date: form.birth_date || null,
      employment_type: form.employment_type,
      monthly_income: form.monthly_income || null,
    }
    const { error } = editingId
      ? await borrowerService.update(editingId, payload)
      : await borrowerService.create(payload)
    setSaving(false)
    if (error) { toast.error('שגיאה בשמירה', error.message); return }
    toast.success(editingId ? 'הלווה עודכן' : 'לווה נוסף')
    resetForm()
    load()
  }

  const remove = async (id: string) => { await borrowerService.delete(id); load() }

  const householdIncome = totalHouseholdIncome(primaryIncome, partnerIncome, borrowers)
  const hasCoBorrowers = borrowers.some(b => b.role === 'לווה שני')

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 size={22} className="text-[var(--color-primary)] animate-spin" /></div>
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-[var(--color-text)] flex items-center gap-2">
          <Users size={16} className="text-[var(--color-primary)]" /> לווים נוספים וערבים
        </h4>
        {!showForm && (
          <button onClick={() => { setForm(emptyForm); setShowForm(true) }}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors">
            <Plus size={15} /> הוסף
          </button>
        )}
      </div>

      {hasCoBorrowers && (
        <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm text-emerald-800">
          <Info size={15} />
          הכנסה משקית כוללת ל-DTI: <b>{formatCurrency(householdIncome)}</b>
          <span className="text-xs text-emerald-600">(ערבים אינם נספרים בהכנסה)</span>
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--color-bg)] rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">תפקיד</label>
              <select className={`${inputClass} bg-[var(--color-card)]`} value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as FormState['role'] })}>
                <option value="לווה שני">לווה שני</option>
                <option value="ערב">ערב</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">שם פרטי</label>
              <input className={inputClass} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">שם משפחה</label>
              <input className={inputClass} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">ת.ז</label>
              <input className={inputClass} dir="ltr" value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">טלפון</label>
              <input className={inputClass} dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">אימייל</label>
              <input className={inputClass} dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">תאריך לידה</label>
              <input className={inputClass} type="date" dir="ltr" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">סוג העסקה</label>
              <select className={`${inputClass} bg-[var(--color-card)]`} value={form.employment_type}
                onChange={e => setForm({ ...form, employment_type: e.target.value as EmploymentType })}>
                {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">הכנסה חודשית (₪)</label>
              <input className={inputClass} type="number" dir="ltr" value={form.monthly_income || ''}
                onChange={e => setForm({ ...form, monthly_income: +e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-sub)] bg-[var(--color-pill-bg)] hover:bg-[var(--color-border)] transition-colors">ביטול</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {editingId ? 'עדכן' : 'הוסף'}
            </button>
          </div>
        </div>
      )}

      {borrowers.length === 0 && !showForm && (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-3">אין לווים נוספים או ערבים</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {borrowers.map(b => (
          <div key={b.id} className="border border-[var(--color-border-light)] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.role === 'ערב' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{b.role}</span>
                <span className="text-sm font-medium text-[var(--color-text)]">{b.first_name} {b.last_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(b)} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"><Pencil size={14} /></button>
                <button onClick={() => remove(b.id)} className="text-[var(--color-text-muted)] hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1 space-x-2 space-x-reverse">
              {b.employment_type && <span>{b.employment_type}</span>}
              {b.role === 'לווה שני' && b.monthly_income ? <span>· {formatCurrency(b.monthly_income)}</span> : null}
              {b.phone && <span dir="ltr">· {b.phone}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ChecklistProps {
  customerId: string
  primaryName: string
  primaryEmployment: 'שכיר' | 'עצמאי'
  /** Outstanding types from the case snapshot; all of them when not supplied. */
  missingDocuments?: string[]
}

/** Document checklist duplicated per borrower, shown in the documents tab. */
export function BorrowerChecklist({
  customerId, primaryName, primaryEmployment, missingDocuments,
}: ChecklistProps) {
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    borrowerService.getByCustomer(customerId).then(({ data }) => {
      setBorrowers(data ?? [])
      setLoading(false)
    })
  }, [customerId])

  if (loading) return null

  const coBorrowers = borrowers.filter(b => b.role === 'לווה שני')
  const checklistBorrowers = [
    { name: primaryName, employmentType: primaryEmployment },
    ...coBorrowers.map(b => ({
      name: `${b.first_name} ${b.last_name}`,
      employmentType: (b.employment_type === 'עצמאי' ? 'עצמאי' : 'שכיר') as 'שכיר' | 'עצמאי',
    })),
  ]
  const checklist = getChecklist(checklistBorrowers)

  // What is still outstanding comes from the case snapshot, so this list and
  // the summary bar's document counter can never disagree.
  const missing = new Set(missingDocuments ?? checklist.map(c => c.type))
  const done = checklist.length - checklist.filter(c => missing.has(c.type)).length

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-[var(--color-text)]">צ'קליסט מסמכים נדרשים</h4>
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{done}/{checklist.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checklist.map((item, i) => {
          const outstanding = missing.has(item.type)
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-sm ${outstanding ? 'text-[var(--color-text-sub)]' : 'text-[var(--color-text-muted)] line-through'}`}
            >
              <CheckCircle2
                size={14}
                className={`shrink-0 ${outstanding ? 'text-[var(--color-text-muted)]' : 'text-green-500'}`}
              />
              {item.type}
            </div>
          )
        })}
      </div>
    </div>
  )
}
