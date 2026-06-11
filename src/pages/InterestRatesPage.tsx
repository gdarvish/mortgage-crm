import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, RefreshCw, Loader2, Pencil, AlertTriangle } from 'lucide-react'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useTheme } from '@/theme/ThemeContext'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { settingsService, type BankRate, type RatesDoc } from '@/services/settingsService'

const CACHE_KEY = 'boi_rates_cache'
const CACHE_TS_KEY = 'boi_rates_ts'
const CACHE_TTL = 24 * 60 * 60 * 1000
const STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000

// Refreshed seed values for Israeli mortgages, mid-2026.
const seedBankRates: BankRate[] = [
  { bank: 'בנק הפועלים', prime: 6.0, fixedNonLinked: 4.45, fixedLinked: 3.75, variableLinked: 3.20, variableNotLinked: 5.15 },
  { bank: 'בנק לאומי', prime: 6.0, fixedNonLinked: 4.50, fixedLinked: 3.80, variableLinked: 3.25, variableNotLinked: 5.20 },
  { bank: 'בנק דיסקונט', prime: 6.0, fixedNonLinked: 4.40, fixedLinked: 3.70, variableLinked: 3.15, variableNotLinked: 5.05 },
  { bank: 'בנק מזרחי', prime: 6.0, fixedNonLinked: 4.55, fixedLinked: 3.85, variableLinked: 3.30, variableNotLinked: 5.25 },
  { bank: 'בנק בינלאומי', prime: 6.0, fixedNonLinked: 4.35, fixedLinked: 3.65, variableLinked: 3.10, variableNotLinked: 5.00 },
]

const seedRates: RatesDoc = {
  bankRates: seedBankRates,
  prime: 6.0,
  boiRate: 4.5,
  lastCpi: 0.3,
  updated_at: '',
}

const fallbackHistory = [
  { date: 'ינו 25', rate: 5.75 }, { date: 'מרץ 25', rate: 5.50 }, { date: 'מאי 25', rate: 5.50 },
  { date: 'יול 25', rate: 5.75 }, { date: 'ספט 25', rate: 5.75 }, { date: 'נוב 25', rate: 6.00 },
  { date: 'ינו 26', rate: 6.00 }, { date: 'מרץ 26', rate: 6.00 },
]

interface BOIFetchResult {
  prime: number
  boiRate: number
  lastUpdate: string
}

// BOI rates are synced server-side by the scheduled `syncBoiRates` Cloud
// Function (direct browser fetch to edge.boi.gov.il is blocked by CORS).
// The shared doc is publicly readable per firestore.rules.
async function fetchBOIRates(): Promise<BOIFetchResult> {
  const snap = await getDoc(doc(db, 'interest_rates', 'current'))
  if (!snap.exists()) throw new Error('No BOI rates synced yet')
  const data = snap.data() as {
    boi_rate?: number
    prime?: number
    period?: string
    updated_at?: Timestamp
  }
  if (typeof data.boi_rate !== 'number') throw new Error('Invalid BOI rates doc')
  return {
    boiRate: data.boi_rate,
    prime: data.prime ?? data.boi_rate + 1.5,
    lastUpdate: data.period ?? '',
  }
}

interface LinePoint { l: string; v: number }

function SVGLine({ data, color = '#059669', h = 180, yDomain }: {
  data: LinePoint[]; color?: string; h?: number; yDomain?: [number, number]
}) {
  if (!data || !data.length) return null
  const pad = { l: 44, r: 12, t: 12, b: 28 }, W = 480, H = h
  const vals = data.map(d => d.v)
  const min = yDomain ? yDomain[0] : Math.min(...vals)
  const max = yDomain ? yDomain[1] : Math.max(...vals, min + 0.1)
  const px = (i: number) => pad.l + (i / (Math.max(data.length - 1, 1))) * (W - pad.l - pad.r)
  const py = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b)
  const pts = data.map((d, i) => `${px(i).toFixed(1)},${py(d.v).toFixed(1)}`).join(' ')
  const area = `${px(0).toFixed(1)},${(H - pad.b).toFixed(1)} ` + pts + ` ${px(data.length - 1).toFixed(1)},${(H - pad.b).toFixed(1)}`
  const gridVals = [min, (min + max) / 2, max]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: h, display: 'block' }} preserveAspectRatio="none">
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={py(v).toFixed(1)} x2={W - pad.r} y2={py(v).toFixed(1)} stroke="#f0efed" strokeDasharray="4 3" />
          <text x={pad.l - 4} y={py(v) + 4} textAnchor="end" fontSize={9} fill="#a8a29e">{v.toFixed(2)}%</text>
        </g>
      ))}
      <polygon points={area} fill={color + '15'} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={px(i)} cy={py(d.v)} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
      ))}
      {data.map((d, i) => (
        <text key={i} x={px(i)} y={H - 7} textAnchor="middle" fontSize={9} fill="#a8a29e">{d.l}</text>
      ))}
    </svg>
  )
}

export default function InterestRatesPage() {
  const t = useTheme()
  const [ratesDoc, setRatesDoc] = useState<RatesDoc>(seedRates)
  const [history] = useState(fallbackHistory)
  const [loading, setLoading] = useState(true)
  const [boiLoading, setBoiLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Layer 1: localStorage cache for fast first paint of bank rates.
    const cached = localStorage.getItem(CACHE_KEY)
    const cachedTs = localStorage.getItem(CACHE_TS_KEY)
    if (cached && cachedTs && Date.now() - +cachedTs < CACHE_TTL) {
      try {
        const data = JSON.parse(cached) as RatesDoc
        if (data && Array.isArray(data.bankRates)) {
          setRatesDoc(data)
        }
      } catch {
        // ignore parse errors
      }
    }

    // Layer 2: Firestore — authoritative.
    void (async () => {
      const { data, error } = await settingsService.getRates()
      if (cancelled) return
      if (error) {
        toast.warning('שגיאה בטעינת ריביות', 'משתמש בנתון המקומי')
      }
      if (data) {
        setRatesDoc(data)
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
      }
      setLoading(false)
    })()

    // Layer 3: live BOI fetch — merge only prime/boiRate into local state.
    setBoiLoading(true)
    fetchBOIRates()
      .then(boi => {
        if (cancelled) return
        setRatesDoc(prev => ({ ...prev, prime: boi.prime, boiRate: boi.boiRate }))
      })
      .catch(() => {
        if (cancelled) return
        toast.warning('לא הצלחנו לעדכן ריבית בנק ישראל', 'משתמש בנתון המקומי האחרון')
      })
      .finally(() => {
        if (!cancelled) setBoiLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const refreshBOI = useCallback(async () => {
    setBoiLoading(true)
    try {
      const boi = await fetchBOIRates()
      const next: RatesDoc = { ...ratesDoc, prime: boi.prime, boiRate: boi.boiRate, updated_at: new Date().toISOString() }
      setRatesDoc(next)
      const { error } = await settingsService.saveRates(next)
      if (error) {
        toast.warning('שגיאה בשמירה', error.message)
      } else {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next))
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
        toast.success('ריבית בנק ישראל עודכנה')
      }
    } catch {
      toast.warning('לא הצלחנו לעדכן ריבית בנק ישראל', 'משתמש בנתון המקומי האחרון')
    } finally {
      setBoiLoading(false)
    }
  }, [ratesDoc])

  const handleSave = useCallback(async (next: RatesDoc) => {
    setRatesDoc(next)
    const { error } = await settingsService.saveRates(next)
    if (error) {
      toast.error('שגיאה בשמירה', error.message)
      return
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
    toast.success('הריביות נשמרו')
    setEditOpen(false)
  }, [])

  const displayedBankRates = ratesDoc.bankRates.map(b => ({ ...b, prime: ratesDoc.prime }))
  const chartData: LinePoint[] = history.map(h => ({ l: h.date, v: h.rate }))
  const lastCpiValue = ratesDoc.lastCpi > 0 ? `${ratesDoc.lastCpi.toFixed(1)}%` : '0.3%'

  const updatedAtMs = ratesDoc.updated_at ? new Date(ratesDoc.updated_at).getTime() : 0
  const isStale = updatedAtMs > 0 && Date.now() - updatedAtMs > STALE_THRESHOLD
  const updatedAtLabel = updatedAtMs > 0
    ? new Date(updatedAtMs).toLocaleDateString('he-IL')
    : 'לא נשמר עדיין'

  const kpis = [
    { label: 'ריבית פריים', value: loading ? '—' : `${ratesDoc.prime.toFixed(2)}%`, color: t.primary, accent: t.primary },
    { label: 'מדד אחרון', value: loading ? '—' : lastCpiValue, color: t.accent, accent: t.accent },
    { label: 'ריבית בנק ישראל', value: loading ? '—' : `${ratesDoc.boiRate.toFixed(2)}%`, color: t.success, accent: t.success },
  ]

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 28, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={22} style={{ color: t.primary }} />
              שוק הריביות
            </h1>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>נתוני ריבית עדכניים מבנק ישראל</p>
            {isStale && (
              <div style={{
                marginTop: 10,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: t.warningBg, color: t.warning,
                padding: '6px 12px', borderRadius: 999,
                fontSize: 12, fontWeight: 600,
                border: `1px solid ${t.warning}33`,
              }}>
                <AlertTriangle size={13} />
                ייתכן שהריביות אינן עדכניות — לחץ עריכה
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textMuted }}>
              {loading || boiLoading
                ? <Loader2 size={13} className="animate-spin" style={{ color: t.primary }} />
                : <RefreshCw size={13} style={{ color: t.textMuted }} />}
              <span>{loading ? 'טוען...' : `עודכן: ${updatedAtLabel}`}</span>
            </div>
            <button
              type="button"
              onClick={() => void refreshBOI()}
              disabled={boiLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: t.cardBg, color: t.textSub,
                border: `1px solid ${t.border}`, borderRadius: 8,
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                cursor: boiLoading ? 'not-allowed' : 'pointer',
                opacity: boiLoading ? 0.6 : 1,
              }}
            >
              <RefreshCw size={12} />
              רענן BOI
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 18, marginBottom: 22 }}>
          {kpis.map((k, i) => (
            <div key={k.label} style={{
              background: t.cardBg, borderRadius: 20, padding: '22px 26px',
              boxShadow: t.shadow, border: `1px solid ${t.border}`,
              borderRight: `4px solid ${k.accent}`, textAlign: 'center',
              animation: `fadeUp 0.4s ease ${i * 0.08 + 0.05}s backwards`,
            }}>
              <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 8 }}>{k.label}</p>
              {loading && k.value === '—' ? (
                <Loader2 size={28} className="animate-spin" style={{ color: t.primary, margin: '4px auto' }} />
              ) : (
                <p style={{ fontSize: 36, fontWeight: 800, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
              )}
            </div>
          ))}
        </div>

        <div style={{
          background: t.cardBg, borderRadius: 20, padding: '22px 26px',
          boxShadow: t.shadow, border: `1px solid ${t.border}`, marginBottom: 22,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 18 }}>מגמת ריבית פריים</h2>
          <SVGLine data={chartData} color={t.primary} h={180} yDomain={[5.2, 6.4]} />
        </div>

        <div style={{
          background: t.cardBg, borderRadius: 20, boxShadow: t.shadow,
          border: `1px solid ${t.border}`, overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px', borderBottom: `1px solid ${t.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>ריביות לפי בנק</h2>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: t.primary, color: t.primaryText,
                border: 'none', borderRadius: 8,
                padding: '7px 14px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Pencil size={13} />
              ערוך ריביות
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.bg }}>
                  {['בנק', 'פריים', 'קל"צ (לא צמודה)', 'קל"ב (צמודה)', 'מ"צ (צמודה)', 'מ"ל (לא צמודה)'].map(h => (
                    <th key={h} style={{
                      padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700,
                      color: t.textMuted, borderBottom: `1px solid ${t.border}`, letterSpacing: '0.04em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedBankRates.map((b, i) => (
                  <BankRow key={b.bank} bank={b} isLast={i === displayedBankRates.length - 1} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <EditRatesModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initial={ratesDoc}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}

interface BankRowProps {
  bank: BankRate
  isLast: boolean
  t: import('@/theme/themes').Theme
}

function BankRow({ bank, isLast, t }: BankRowProps) {
  const [hov, setHov] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? t.bg : 'transparent', transition: 'background 0.12s',
        borderBottom: isLast ? 'none' : `1px solid ${t.borderLight}`,
      }}
    >
      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: t.text }}>{bank.bank}</td>
      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 800, color: t.primary }}>{bank.prime.toFixed(2)}%</td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>{bank.fixedNonLinked.toFixed(2)}%</td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>{bank.fixedLinked.toFixed(2)}%</td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>{bank.variableLinked.toFixed(2)}%</td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>{bank.variableNotLinked.toFixed(2)}%</td>
    </tr>
  )
}

interface EditRatesModalProps {
  open: boolean
  onClose: () => void
  initial: RatesDoc
  onSave: (next: RatesDoc) => void | Promise<void>
}

function EditRatesModal({ open, onClose, initial, onSave }: EditRatesModalProps) {
  const t = useTheme()
  const [draft, setDraft] = useState<RatesDoc>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft(initial)
  }, [open, initial])

  const updateBank = (idx: number, field: keyof BankRate, value: string) => {
    setDraft(prev => {
      const next = { ...prev, bankRates: prev.bankRates.map((b, i) => {
        if (i !== idx) return b
        if (field === 'bank') return { ...b, bank: value }
        const num = parseFloat(value)
        return { ...b, [field]: isNaN(num) ? 0 : num }
      }) }
      return next
    })
  }

  const updateTop = (field: 'prime' | 'boiRate' | 'lastCpi', value: string) => {
    const num = parseFloat(value)
    setDraft(prev => ({ ...prev, [field]: isNaN(num) ? 0 : num }))
  }

  const submit = async () => {
    setSaving(true)
    try {
      await onSave({ ...draft, updated_at: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: t.textMuted,
    display: 'block', marginBottom: 4, letterSpacing: '0.02em',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', background: t.inputBg, color: t.text,
    border: `1px solid ${t.border}`, borderRadius: 6,
    padding: '6px 8px', fontSize: 13, fontVariantNumeric: 'tabular-nums',
  }
  const numericProps = { type: 'number' as const, step: '0.01', min: '0', max: '20' }

  return (
    <Modal open={open} onClose={onClose} title="עריכת ריביות" size="xl">
      <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
          padding: 12, background: t.bg, borderRadius: 10, border: `1px solid ${t.border}`,
        }}>
          <div>
            <label style={labelStyle}>פריים</label>
            <input {...numericProps} value={draft.prime} onChange={e => updateTop('prime', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>ריבית בנק ישראל</label>
            <input {...numericProps} value={draft.boiRate} onChange={e => updateTop('boiRate', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>מדד אחרון (%)</label>
            <input {...numericProps} value={draft.lastCpi} onChange={e => updateTop('lastCpi', e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {draft.bankRates.map((b, idx) => (
            <div key={idx} style={{
              padding: 12, background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 10,
              display: 'grid', gridTemplateColumns: '1.4fr repeat(5, 1fr)', gap: 8, alignItems: 'end',
            }}>
              <div>
                <label style={labelStyle}>בנק</label>
                <input type="text" value={b.bank} onChange={e => updateBank(idx, 'bank', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>קל"צ</label>
                <input {...numericProps} value={b.fixedNonLinked} onChange={e => updateBank(idx, 'fixedNonLinked', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>קל"ב</label>
                <input {...numericProps} value={b.fixedLinked} onChange={e => updateBank(idx, 'fixedLinked', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>מ"צ</label>
                <input {...numericProps} value={b.variableLinked} onChange={e => updateBank(idx, 'variableLinked', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>מ"ל</label>
                <input {...numericProps} value={b.variableNotLinked} onChange={e => updateBank(idx, 'variableNotLinked', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>פריים</label>
                <input {...numericProps} value={b.prime} onChange={e => updateBank(idx, 'prime', e.target.value)} style={inputStyle} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, paddingTop: 4 }}>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            style={{
              background: t.primary, color: t.primaryText,
              border: 'none', borderRadius: 8,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            שמור
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: t.cardBg, color: t.textSub,
              border: `1px solid ${t.border}`, borderRadius: 8,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </Modal>
  )
}
