import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, ChevronRight, ChevronLeft, Loader2, MapPin, User, Trash2, Check, X } from 'lucide-react'
import { toast } from '@/components/ui'
import { meetingService, type MeetingWithCustomer } from '@/services/meetingService'
import { customerService } from '@/services/customerService'
import type { Customer } from '@/types/database'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const statusColors: Record<string, string> = {
  'מתוכננת': 'bg-blue-100 text-blue-700',
  'התקיימה': 'bg-green-100 text-green-700',
  'בוטלה': 'bg-[var(--color-pill-bg)] text-[var(--color-text-muted)]',
}

const inputClass =
  'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm'

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - date.getDay()) // Sunday
  return date
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingWithCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '', customer_id: '', date: '', time: '10:00', duration_minutes: 60, location: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await meetingService.getAll()
    setMeetings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    customerService.getAll().then(({ data }) => { if (data) setCustomers(data) })
  }, [load])

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)

  const meetingsForDay = (day: Date) =>
    meetings
      .filter(m => {
        const t = new Date(m.starts_at)
        return t.getFullYear() === day.getFullYear() && t.getMonth() === day.getMonth() && t.getDate() === day.getDate()
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  const save = async () => {
    if (!form.title.trim() || !form.date) { toast.error('חסר נושא או תאריך'); return }
    setSaving(true)
    const starts_at = new Date(`${form.date}T${form.time || '10:00'}`).toISOString()
    const { error } = await meetingService.create({
      customer_id: form.customer_id || null,
      title: form.title.trim(),
      starts_at,
      duration_minutes: form.duration_minutes || 60,
      location: form.location.trim() || null,
      status: 'מתוכננת',
      notes: null,
    })
    setSaving(false)
    if (error) { toast.error('שגיאה בשמירה', error.message); return }
    toast.success('הפגישה נקבעה')
    setShowForm(false)
    setForm({ title: '', customer_id: '', date: '', time: '10:00', duration_minutes: 60, location: '' })
    load()
  }

  const setStatus = async (m: MeetingWithCustomer, status: MeetingWithCustomer['status']) => {
    await meetingService.update(m.id, { status })
    load()
  }
  const remove = async (id: string) => { await meetingService.delete(id); load() }

  return (
    <div className="crm-page animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>
          <Calendar size={22} style={{ color: 'var(--color-primary)' }} /> פגישות
        </h1>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm">
          <Plus size={16} /> קבע פגישה
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border-light)] p-3">
        <button onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
          className="p-2 rounded-lg hover:bg-[var(--color-pill-bg)] text-[var(--color-text-sub)]"><ChevronRight size={18} /></button>
        <div className="text-sm font-medium text-[var(--color-text-sub)]">
          {weekStart.toLocaleDateString('he-IL')} – {new Date(weekEnd.getTime() - 1).toLocaleDateString('he-IL')}
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="mr-3 text-xs text-[var(--color-primary)] hover:underline">היום</button>
        </div>
        <button onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
          className="p-2 rounded-lg hover:bg-[var(--color-pill-bg)] text-[var(--color-text-sub)]"><ChevronLeft size={18} /></button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={28} className="text-[var(--color-primary)] animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {weekDays.map(day => {
            const dayMeetings = meetingsForDay(day)
            const isToday = day.toDateString() === new Date().toDateString()
            return (
              <div key={day.toISOString()} className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
                <div className={`px-4 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 ${isToday ? 'bg-emerald-50' : 'bg-[var(--color-bg)]'}`}>
                  <span className="text-sm font-bold text-[var(--color-text)]">יום {DAY_NAMES[day.getDay()]}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{day.toLocaleDateString('he-IL')}</span>
                  {isToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white">היום</span>}
                </div>
                {dayMeetings.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] px-4 py-3">אין פגישות</p>
                ) : (
                  <div className="divide-y divide-[var(--color-border-light)]">
                    {dayMeetings.map(m => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-sm font-bold text-[var(--color-primary)] tabular-nums shrink-0" dir="ltr">{timeStr(m.starts_at)}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-[var(--color-text)]">{m.title}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[m.status]}`}>{m.status}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-0.5 flex-wrap">
                              {m.customer && (
                                <Link to={`/customers/${m.customer_id}`} className="inline-flex items-center gap-1 hover:text-[var(--color-primary)]">
                                  <User size={11} /> {m.customer.first_name} {m.customer.last_name}
                                </Link>
                              )}
                              {m.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {m.location}</span>}
                              <span>{m.duration_minutes} דק'</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.status === 'מתוכננת' && (
                            <>
                              <button onClick={() => setStatus(m, 'התקיימה')} title="התקיימה" className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"><Check size={14} /></button>
                              <button onClick={() => setStatus(m, 'בוטלה')} title="בטל" className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-pill-bg)]"><X size={14} /></button>
                            </>
                          )}
                          <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New meeting modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md bg-[var(--color-card)] rounded-2xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--color-text)]">קביעת פגישה</h2>
              <button onClick={() => setShowForm(false)} className="text-[var(--color-text-muted)]"><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">נושא</label>
              <input className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="פגישת ייעוץ" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">לקוח (אופציונלי)</label>
              <select className={`${inputClass} bg-[var(--color-card)]`} value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">ללא לקוח</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
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
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-sub)] bg-[var(--color-pill-bg)] hover:bg-[var(--color-border)] transition-colors">ביטול</button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} קבע פגישה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
