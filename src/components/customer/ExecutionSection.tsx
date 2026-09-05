import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Loader2, Banknote, Check } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui'
import { disbursementService } from '@/services/disbursementService'
import type { Disbursement } from '@/types/database'

const inputClass =
  'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm'

interface Props {
  customerId: string
  mortgageId?: string | null
}

export default function ExecutionSection({ customerId, mortgageId }: Props) {
  const [items, setItems] = useState<Disbursement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ payee: '', amount: 0, due_date: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await disbursementService.getByCustomer(customerId)
    setItems(data ?? [])
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.payee.trim() || !form.amount) { toast.error('חסר גורם או סכום'); return }
    setSaving(true)
    const { error } = await disbursementService.create({
      customer_id: customerId,
      mortgage_id: mortgageId ?? null,
      payee: form.payee.trim(),
      amount: form.amount,
      due_date: form.due_date || null,
      status: 'מתוכנן',
      released_at: null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (error) { toast.error('שגיאה בשמירה', error.message); return }
    toast.success('שחרור נוסף')
    setForm({ payee: '', amount: 0, due_date: '', notes: '' })
    setShowForm(false)
    load()
  }

  const release = async (d: Disbursement) => {
    await disbursementService.update(d.id, { status: 'שוחרר', released_at: new Date().toISOString() })
    load()
  }
  const remove = async (id: string) => { await disbursementService.delete(id); load() }

  const totalPlanned = items.reduce((s, d) => s + (d.amount || 0), 0)
  const totalReleased = items.filter(d => d.status === 'שוחרר').reduce((s, d) => s + (d.amount || 0), 0)
  const pct = totalPlanned > 0 ? Math.round((totalReleased / totalPlanned) * 100) : 0

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 size={22} className="text-[var(--color-primary)] animate-spin" /></div>
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-[var(--color-text)] flex items-center gap-2">
          <Banknote size={16} className="text-[var(--color-primary)]" /> ביצוע — שחרור כספים
        </h4>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors">
            <Plus size={15} /> הוסף שחרור
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
            <span>שוחרר {formatCurrency(totalReleased)} מתוך {formatCurrency(totalPlanned)}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-pill-bg)] overflow-hidden">
            <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--color-bg)] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input className={inputClass} placeholder="גורם (קבלן/מוכר/עו״ד)" value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} />
          <input className={inputClass} type="number" dir="ltr" placeholder="סכום" value={form.amount || ''} onChange={e => setForm({ ...form, amount: +e.target.value })} />
          <input className={inputClass} type="date" dir="ltr" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-1 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 rounded-lg text-sm text-[var(--color-text-sub)] bg-[var(--color-pill-bg)] hover:bg-[var(--color-border)]">ביטול</button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-3">אין שחרורי כספים</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-[var(--color-text-sub)]">
                <th className="text-right pb-2 font-medium">גורם</th>
                <th className="text-right pb-2 font-medium">סכום</th>
                <th className="text-right pb-2 font-medium">מועד</th>
                <th className="text-right pb-2 font-medium">סטטוס</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id} className="border-b border-[var(--color-border-light)]">
                  <td className="py-2 text-[var(--color-text)]">{d.payee}</td>
                  <td className="py-2 text-[var(--color-text)] font-medium">{formatCurrency(d.amount)}</td>
                  <td className="py-2 text-[var(--color-text-sub)]" dir="ltr">{d.due_date ? formatDate(d.due_date) : '—'}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'שוחרר' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.status}</span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2 justify-end">
                      {d.status === 'מתוכנן' && (
                        <button onClick={() => release(d)} className="inline-flex items-center gap-1 text-xs bg-[var(--color-primary)] text-white px-2 py-1 rounded-lg hover:bg-[var(--color-primary-hover)]">
                          <Check size={12} /> שוחרר
                        </button>
                      )}
                      <button onClick={() => remove(d.id)} className="text-[var(--color-text-muted)] hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
