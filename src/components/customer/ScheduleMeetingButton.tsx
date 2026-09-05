import { useState } from 'react'
import { CalendarPlus, Loader2, X } from 'lucide-react'
import { toast, ConfirmDialog } from '@/components/ui'
import { meetingService } from '@/services/meetingService'
import { customerService } from '@/services/customerService'
import type { CustomerStatus } from '@/types/database'

const inputClass =
  'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm'

interface Props {
  customerId: string
  customerName: string
  currentStatus: CustomerStatus
  onDone?: () => void
}

export default function ScheduleMeetingButton({ customerId, customerName, currentStatus, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suggestStatus, setSuggestStatus] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [form, setForm] = useState({ title: 'פגישת ייעוץ', date: '', time: '10:00', duration_minutes: 60, location: '' })

  const save = async () => {
    if (!form.date) { toast.error('חסר תאריך'); return }
    setSaving(true)
    const starts_at = new Date(`${form.date}T${form.time || '10:00'}`).toISOString()
    const { error } = await meetingService.create({
      customer_id: customerId,
      title: form.title.trim() || 'פגישה',
      starts_at,
      duration_minutes: form.duration_minutes || 60,
      location: form.location.trim() || null,
      status: 'מתוכננת',
      notes: null,
    })
    setSaving(false)
    if (error) { toast.error('שגיאה בקביעת פגישה', error.message); return }
    toast.success('הפגישה נקבעה')
    setOpen(false)
    onDone?.()
    if (currentStatus === 'ליד') setSuggestStatus(true)
  }

  const applyStatusUpdate = async () => {
    setUpdatingStatus(true)
    await customerService.update(customerId, { status: 'פגישה' })
    setUpdatingStatus(false)
    setSuggestStatus(false)
    toast.success('סטטוס הלקוח עודכן ל"פגישה"')
    onDone?.()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors text-sm">
        <CalendarPlus size={16} /> קבע פגישה
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-[var(--color-card)] rounded-2xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--color-text)]">קביעת פגישה — {customerName}</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--color-text-muted)]"><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">נושא</label>
              <input className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">תאריך</label>
                <input className={inputClass} type="date" dir="ltr" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">שעה</label>
                <input className={inputClass} type="time" dir="ltr" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">משך (דקות)</label>
                <input className={inputClass} type="number" dir="ltr" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">מיקום</label>
                <input className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="כתובת / זום / טלפון" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-sub)] bg-[var(--color-pill-bg)] hover:bg-[var(--color-border)] transition-colors">ביטול</button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />} קבע
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={suggestStatus}
        title="עדכון סטטוס"
        message="נקבעה פגישה ללקוח בסטטוס 'ליד'. לעדכן את הסטטוס ל'פגישה'?"
        confirmText="עדכן ל'פגישה'"
        loading={updatingStatus}
        onConfirm={applyStatusUpdate}
        onCancel={() => setSuggestStatus(false)}
      />
    </>
  )
}
