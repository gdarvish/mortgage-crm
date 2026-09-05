import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, RefreshCw, Loader2, Pencil, X, Check, AlertTriangle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '@/lib/firebase'
import { Modal, toast } from '@/components/ui'
import { settingsService } from '@/services/settingsService'
import type { BankRate, RatesDoc } from '@/types/database'
import { applyBoiReading, defaultRatesDoc, isRatesStale, normalizeRatesDoc, parseRateInput } from '@/utils/bankRates'
import { useChartTheme } from '@/theme/chartTheme'

const CACHE_KEY = 'boi_rates_cache'
const CACHE_TS_KEY = 'boi_rates_ts'
const CACHE_TTL = 24 * 60 * 60 * 1000

const fallbackHistory = [
  { date: 'ינו 25', rate: 5.75 }, { date: 'מרץ 25', rate: 5.50 }, { date: 'מאי 25', rate: 5.50 },
  { date: 'יול 25', rate: 5.75 }, { date: 'ספט 25', rate: 5.75 }, { date: 'נוב 25', rate: 6.00 },
  { date: 'ינו 26', rate: 6.00 }, { date: 'מרץ 26', rate: 6.00 },
]

const cardStyle = {
  background: 'var(--color-card)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border)',
}

interface BOIReading {
  prime: number
  boiRate: number
  lastUpdate: string
  /** True when the server handed back a reading it could not refresh. */
  stale?: boolean
  /** Why the refresh failed, when it did. */
  error?: string
}

/**
 * The reading comes from the fetchBoiRates Cloud Function, not from the
 * browser. edge.boi.gov.il is another origin and grants no CORS, so a fetch
 * from the tab was blocked before it left — which is why every refresh
 * reported a failure. The function also has a real timeout and a shared
 * cache, and reports why a fetch failed instead of an opaque error.
 */
async function fetchBOIRates(force = false): Promise<BOIReading> {
  const fn = httpsCallable<{ force: boolean }, BOIReading>(functions, 'fetchBoiRates')
  const res = await fn({ force })
  const data = res.data
  if (typeof data?.boiRate !== 'number' || typeof data?.prime !== 'number') {
    throw new Error('לא התקבלה ריבית מהשרת')
  }
  return data
}

function writeCache(rates: RatesDoc) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rates))
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
  } catch {
    // a full or disabled localStorage must not break the page
  }
}

function readCache(): RatesDoc | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const cachedTs = localStorage.getItem(CACHE_TS_KEY)
    if (!cached || !cachedTs || Date.now() - +cachedTs >= CACHE_TTL) return null
    return normalizeRatesDoc(JSON.parse(cached))
  } catch {
    return null
  }
}

export default function InterestRatesPage() {
  const chart = useChartTheme()
  const [rates, setRates] = useState<RatesDoc>(defaultRatesDoc)
  const [history] = useState(fallbackHistory)
  const [loading, setLoading] = useState(true)
  const [boiLoading, setBoiLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    // The cache is only a fast first paint — Firestore is authoritative, and
    // the BOI reading is applied last so a slow Firestore read cannot land
    // on top of it and undo the refresh.
    const cached = readCache()
    if (cached) setRates(cached)

    void (async () => {
      const { data, error } = await settingsService.getRates()
      if (cancelled) return
      if (error) toast.warning('שגיאה בטעינת הריביות', 'מוצגים הנתונים המקומיים')
      if (data) {
        setRates(data)
        writeCache(data)
      }
      setLoading(false)

      setBoiLoading(true)
      try {
        const boi = await fetchBOIRates()
        if (cancelled) return
        setRates(prev => applyBoiReading(prev, boi))
      } catch {
        // the saved figures stay on screen; no toast on first load
      } finally {
        if (!cancelled) setBoiLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const refreshBOI = useCallback(async () => {
    setBoiLoading(true)
    try {
      const boi = await fetchBOIRates(true)
      const next = { ...applyBoiReading(rates, boi), updated_at: new Date().toISOString() }
      setRates(next)
      const { error } = await settingsService.saveRates(next)
      if (error) {
        toast.warning('הריבית עודכנה אך לא נשמרה', error.message)
      } else {
        writeCache(next)
        // A stale reading is still worth keeping, but say that it is stale.
        if (boi.stale) toast.warning('בנק ישראל לא זמין', boi.error ?? 'מוצג הנתון השמור האחרון')
        else toast.success('ריבית בנק ישראל עודכנה')
      }
    } catch (e) {
      // The message now names the actual failure — a status code, a timeout,
      // an unparseable body — rather than hiding it.
      toast.warning('לא הצלחנו לעדכן את ריבית בנק ישראל', e instanceof Error ? e.message : undefined)
    } finally {
      setBoiLoading(false)
    }
  }, [rates])

  const handleSave = useCallback(async (next: RatesDoc) => {
    const { error } = await settingsService.saveRates(next)
    if (error) {
      toast.error('שגיאה בשמירת הריביות', error.message)
      return
    }
    setRates(next)
    writeCache(next)
    toast.success('הריביות נשמרו')
    setEditOpen(false)
  }, [])

  const displayedBankRates = rates.bankRates.map(b => ({ ...b, prime: rates.prime }))
  const stale = isRatesStale(rates)
  const updatedAtLabel = rates.updated_at
    ? new Date(rates.updated_at).toLocaleDateString('he-IL')
    : 'לא נשמר עדיין'

  return (
    <div className="crm-page animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>
            <TrendingUp size={22} style={{ color: 'var(--color-primary)' }} />
            שוק הריביות
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>נתוני ריבית עדכניים מבנק ישראל</p>
          {stale && (
            <div
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
            >
              <AlertTriangle size={13} />
              הריביות לא עודכנו למעלה משבוע
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            {loading || boiLoading ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-primary)' }} /> : <RefreshCw size={13} />}
            {loading ? 'טוען...' : `עודכן: ${updatedAtLabel}`}
          </div>
          <button
            type="button"
            onClick={() => void refreshBOI()}
            disabled={boiLoading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-sub)', border: '1px solid var(--color-border)' }}
          >
            <RefreshCw size={12} />
            רענן מבנק ישראל
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div style={{ ...cardStyle, padding: 20, textAlign: 'center', borderRight: '4px solid var(--color-primary)' }}>
          <p className="text-[13px] mb-1" style={{ color: 'var(--color-text-muted)' }}>ריבית פריים</p>
          {loading ? <Loader2 size={24} className="mx-auto animate-spin" style={{ color: 'var(--color-primary)' }} /> : (
            <p className="text-[32px] font-black" style={{ color: 'var(--color-primary)' }}>{rates.prime.toFixed(2)}%</p>
          )}
        </div>
        <div style={{ ...cardStyle, padding: 20, textAlign: 'center', borderRight: '4px solid #f59e0b' }}>
          <p className="text-[13px] mb-1" style={{ color: 'var(--color-text-muted)' }}>מדד אחרון</p>
          <p className="text-[32px] font-black" style={{ color: '#f59e0b' }}>{rates.lastCpi}%</p>
        </div>
        <div style={{ ...cardStyle, padding: 20, textAlign: 'center', borderRight: '4px solid #22c55e' }}>
          <p className="text-[13px] mb-1" style={{ color: 'var(--color-text-muted)' }}>ריבית בנק ישראל</p>
          {loading ? <Loader2 size={24} className="mx-auto animate-spin" style={{ color: 'var(--color-primary)' }} /> : (
            <p className="text-[32px] font-black" style={{ color: '#22c55e' }}>{rates.boiRate.toFixed(2)}%</p>
          )}
        </div>
      </div>

      <AdminLiveRatesSection />

      <div style={{ ...cardStyle, padding: 20 }}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>מגמת ריבית פריים</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={history}>
            <CartesianGrid {...chart.grid} />
            <XAxis dataKey="date" tick={chart.tick(12)} />
            <YAxis domain={[5, 6.5]} tickFormatter={v => `${v}%`} tick={chart.tick(12)} />
            <Tooltip formatter={(v) => `${v}%`} contentStyle={chart.tooltip} />
            <Line type="monotone" dataKey="rate" stroke={chart.series} strokeWidth={2} dot={{ fill: chart.series }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="flex items-center justify-between gap-3 p-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>ריביות לפי בנק</h2>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)' }}
          >
            <Pencil size={13} />
            ערוך ריביות
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {['בנק', 'פריים', 'קל"צ', 'קל"ב', 'מ"צ (משתנה צמודה)', 'מ"ל (משתנה לא צמודה)'].map(h => (
                  <th key={h} className="text-right p-3 font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedBankRates.map(bank => (
                <tr key={bank.bank} style={{ borderTop: '1px solid var(--color-border-light)' }} className="transition-colors hover:bg-[var(--color-bg)]">
                  <td className="p-3 font-semibold" style={{ color: 'var(--color-text)' }}>{bank.bank}</td>
                  <td className="p-3 font-semibold" style={{ color: 'var(--color-primary)' }}>{bank.prime.toFixed(2)}%</td>
                  <td className="p-3" style={{ color: 'var(--color-text-sub)' }}>{bank.fixedNonLinked.toFixed(2)}%</td>
                  <td className="p-3" style={{ color: 'var(--color-text-sub)' }}>{bank.fixedLinked.toFixed(2)}%</td>
                  <td className="p-3" style={{ color: 'var(--color-text-sub)' }}>{bank.variableLinked.toFixed(2)}%</td>
                  <td className="p-3" style={{ color: 'var(--color-text-sub)' }}>{bank.variableNotLinked.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EditRatesModal open={editOpen} onClose={() => setEditOpen(false)} initial={rates} onSave={handleSave} />
    </div>
  )
}

interface EditRatesModalProps {
  open: boolean
  onClose: () => void
  initial: RatesDoc
  onSave: (next: RatesDoc) => void | Promise<void>
}

const NUMERIC_FIELDS: { field: keyof BankRate; label: string }[] = [
  { field: 'prime', label: 'פריים' },
  { field: 'fixedNonLinked', label: 'קל"צ' },
  { field: 'fixedLinked', label: 'קל"ב' },
  { field: 'variableLinked', label: 'מ"צ' },
  { field: 'variableNotLinked', label: 'מ"ל' },
]

function EditRatesModal({ open, onClose, initial, onSave }: EditRatesModalProps) {
  const [draft, setDraft] = useState<RatesDoc>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft(initial)
  }, [open, initial])

  const updateBank = (idx: number, field: keyof BankRate, value: string) => {
    setDraft(prev => ({
      ...prev,
      bankRates: prev.bankRates.map((b, i) => {
        if (i !== idx) return b
        if (field === 'bank') return { ...b, bank: value }
        return { ...b, [field]: parseRateInput(value, b[field] as number) }
      }),
    }))
  }

  const updateTop = (field: 'prime' | 'boiRate' | 'lastCpi', value: string) => {
    setDraft(prev => ({ ...prev, [field]: parseRateInput(value, prev[field]) }))
  }

  const addBank = () => {
    setDraft(prev => ({
      ...prev,
      bankRates: [...prev.bankRates, {
        bank: '', prime: prev.prime, fixedNonLinked: 0, fixedLinked: 0, variableLinked: 0, variableNotLinked: 0,
      }],
    }))
  }

  const removeBank = (idx: number) => {
    setDraft(prev => ({ ...prev, bankRates: prev.bankRates.filter((_, i) => i !== idx) }))
  }

  const submit = async () => {
    // An unnamed row has no key to render by and no meaning in the table.
    const bankRates = draft.bankRates
      .map(b => ({ ...b, bank: b.bank.trim() }))
      .filter(b => b.bank !== '')
    if (!bankRates.length) {
      toast.error('יש להזין בנק אחד לפחות')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...draft, bankRates, updated_at: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-md px-2 py-1.5 text-[13px] tabular-nums outline-none focus:ring-2'
  const inputStyle = {
    background: 'var(--color-input-bg)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  }
  const labelClass = 'block mb-1 text-[11px] font-semibold'
  const labelStyle = { color: 'var(--color-text-muted)' }

  return (
    <Modal open={open} onClose={onClose} title="עריכת ריביות" size="2xl">
      <div dir="rtl" className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        <div
          className="grid grid-cols-3 gap-3 rounded-xl p-3"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          {([
            { field: 'prime' as const, label: 'פריים' },
            { field: 'boiRate' as const, label: 'ריבית בנק ישראל' },
            { field: 'lastCpi' as const, label: 'מדד אחרון (%)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <label className={labelClass} style={labelStyle} htmlFor={`rates-${field}`}>{label}</label>
              <input
                id={`rates-${field}`}
                type="number" step="0.01" min="0" max="20" dir="ltr"
                value={draft[field]}
                onChange={e => updateTop(field, e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {draft.bankRates.map((b, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1.4fr_repeat(5,1fr)_auto] gap-2 items-end rounded-xl p-3"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
            >
              <div>
                <label className={labelClass} style={labelStyle} htmlFor={`bank-name-${idx}`}>בנק</label>
                <input
                  id={`bank-name-${idx}`}
                  type="text"
                  value={b.bank}
                  onChange={e => updateBank(idx, 'bank', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              {NUMERIC_FIELDS.map(({ field, label }) => (
                <div key={field}>
                  <label className={labelClass} style={labelStyle} htmlFor={`bank-${field}-${idx}`}>{label}</label>
                  <input
                    id={`bank-${field}-${idx}`}
                    type="number" step="0.01" min="0" max="20" dir="ltr"
                    value={b[field] as number}
                    onChange={e => updateBank(idx, field, e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => removeBank(idx)}
                aria-label={`הסר ${b.bank || 'בנק'}`}
                className="rounded-lg p-1.5 mb-0.5"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addBank}
          className="self-start rounded-lg px-3 py-1.5 text-[13px] font-semibold"
          style={{ background: 'var(--color-bg)', color: 'var(--color-text-sub)', border: '1px solid var(--color-border)' }}
        >
          הוסף בנק
        </button>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)' }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            שמור
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-sub)', border: '1px solid var(--color-border)' }}
          >
            ביטול
          </button>
        </div>
      </div>
    </Modal>
  )
}

const LIVE_TRACK_TYPES: { key: string; label: string }[] = [
  { key: 'קל"צ', label: 'קל"צ (קבועה לא צמודה)' },
  { key: 'קל"ב', label: 'קל"ב (קבועה צמודה)' },
  { key: 'משתנה_צמודה', label: 'משתנה צמודה' },
  { key: 'משתנה_לא_צמודה', label: 'משתנה לא צמודה' },
  { key: 'פריים', label: 'פריים' },
  { key: 'זכאות', label: 'זכאות' },
]

/**
 * Live rates stored in the interest_rates collection — the source consumed by the
 * mortgage calculator and the refinance engine. Read-only for everyone; admins
 * (custom claim) can push updates via the updateInterestRate Cloud Function.
 *
 * Deliberately separate from the per-advisor board above: this one drives
 * calculations for every user, that one is one advisor's comparison table.
 */
function AdminLiveRatesSection() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [rates, setRates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'interest_rates'), orderBy('effective_date', 'desc'), limit(50)))
      const map: Record<string, number> = {}
      for (const d of snap.docs) {
        const data = d.data()
        if (data.track_type && !(data.track_type in map) && typeof data.rate === 'number') {
          map[data.track_type] = data.rate
        }
      }
      setRates(map)
    } catch {
      // read may be blocked before any rates exist — leave empty
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    auth.currentUser?.getIdTokenResult().then(r => setIsAdmin(r.claims.admin === true)).catch(() => {})
  }, [load])

  const startEdit = (key: string) => {
    setEditing(key)
    setDraft(rates[key] != null ? String(rates[key]) : '')
  }

  const save = async (key: string) => {
    const rate = parseFloat(draft)
    if (!Number.isFinite(rate) || rate < 0 || rate > 30) {
      toast.error('ריבית אינה תקינה')
      return
    }
    setSaving(true)
    try {
      const fn = httpsCallable(functions, 'updateInterestRate')
      await fn({ track_type: key, rate })
      toast.success('הריבית עודכנה')
      setEditing(null)
      await load()
    } catch (e) {
      const err = e as { message?: string }
      toast.error('שגיאה בעדכון הריבית', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}>
      <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>ריביות מערכת (מחשבון ומנוע מחזור)</h2>
        {isAdmin && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-success-bg)', color: '#065f46' }}>מנהל</span>}
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
        {LIVE_TRACK_TYPES.map(t => (
          <div key={t.key} className="flex items-center justify-between px-5 py-3">
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{t.label}</span>
            {editing === t.key ? (
              <div className="flex items-center gap-2">
                <input
                  type="number" step="0.01" dir="ltr" autoFocus value={draft}
                  onChange={e => setDraft(e.target.value)}
                  className="w-24 px-2 py-1 text-[13px] outline-none rounded-lg"
                  style={{ border: '1.5px solid var(--color-border)' }}
                />
                <button onClick={() => save(t.key)} disabled={saving} className="p-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: 'var(--color-primary)' }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--color-border-light)', color: 'var(--color-text-sub)' }}><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-black tabular-nums" style={{ color: rates[t.key] != null ? 'var(--color-primary)' : '#d6d3d1' }} dir="ltr">
                  {loading ? '…' : rates[t.key] != null ? `${rates[t.key].toFixed(2)}%` : '—'}
                </span>
                {isAdmin && (
                  <button onClick={() => startEdit(t.key)} className="p-1.5 rounded-lg hover:bg-[var(--color-pill-bg)]" style={{ color: 'var(--color-text-muted)' }} aria-label="עדכן ריבית">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {!isAdmin && (
        <p className="px-5 py-3 text-[11px]" style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-light)' }}>
          עדכון ריביות מתאפשר למנהלי מערכת בלבד.
        </p>
      )}
    </div>
  )
}
