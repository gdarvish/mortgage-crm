import { useState, useEffect } from 'react'
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react'
import { useTheme } from '@/theme/ThemeContext'

const CACHE_KEY = 'boi_rates_cache'
const CACHE_TS_KEY = 'boi_rates_ts'
const CACHE_TTL = 24 * 60 * 60 * 1000

const fallbackRates = { prime: 6.0, boiRate: 4.5, lastCpi: 0.3, lastUpdate: '' }
const fallbackHistory = [
  { date: 'ינו 25', rate: 5.75 }, { date: 'מרץ 25', rate: 5.50 }, { date: 'מאי 25', rate: 5.50 },
  { date: 'יול 25', rate: 5.75 }, { date: 'ספט 25', rate: 5.75 }, { date: 'נוב 25', rate: 6.00 },
  { date: 'ינו 26', rate: 6.00 }, { date: 'מרץ 26', rate: 6.00 },
]

const bankRates = [
  { bank: 'בנק הפועלים', prime: 6.0, fixedNonLinked: 4.45, fixedLinked: 3.75, variableLinked: 3.20 },
  { bank: 'בנק לאומי', prime: 6.0, fixedNonLinked: 4.50, fixedLinked: 3.80, variableLinked: 3.25 },
  { bank: 'בנק דיסקונט', prime: 6.0, fixedNonLinked: 4.40, fixedLinked: 3.70, variableLinked: 3.15 },
  { bank: 'בנק מזרחי', prime: 6.0, fixedNonLinked: 4.55, fixedLinked: 3.85, variableLinked: 3.30 },
  { bank: 'בנק בינלאומי', prime: 6.0, fixedNonLinked: 4.35, fixedLinked: 3.65, variableLinked: 3.10 },
]

interface RatesData {
  prime: number
  boiRate: number
  lastCpi: number
  lastUpdate: string
}

async function fetchBOIRates(): Promise<RatesData> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch('https://edge.boi.gov.il/FusionEdge/skewers/clients/json/en/page_1007.aspx', {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = await res.json()
    const series = json?.resultSet?.series?.[0]?.points ?? []
    const latest = series[series.length - 1]
    const prime = latest ? parseFloat(latest.value) + 1.5 : fallbackRates.prime
    const boiRate = latest ? parseFloat(latest.value) : fallbackRates.boiRate
    const lastUpdate = latest?.period ?? ''
    return { prime, boiRate, lastCpi: fallbackRates.lastCpi, lastUpdate }
  } catch {
    clearTimeout(timeout)
    throw new Error('BOI fetch failed')
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
  const [rates, setRates] = useState<RatesData>(fallbackRates)
  const [history, setHistory] = useState(fallbackHistory)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState('')

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY)
    const cachedTs = localStorage.getItem(CACHE_TS_KEY)
    if (cached && cachedTs && Date.now() - +cachedTs < CACHE_TTL) {
      const data = JSON.parse(cached)
      setRates(data.rates)
      if (data.history) setHistory(data.history)
      setUpdatedAt(new Date(+cachedTs).toLocaleDateString('he-IL'))
      setLoading(false)
      return
    }
    fetchBOIRates()
      .then(data => {
        setRates(data)
        const now = Date.now()
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: data, history: fallbackHistory }))
        localStorage.setItem(CACHE_TS_KEY, String(now))
        setUpdatedAt(new Date(now).toLocaleDateString('he-IL'))
      })
      .catch(() => {
        setUpdatedAt('נתוני ברירת מחדל')
      })
      .finally(() => setLoading(false))
  }, [])

  const displayedBankRates = bankRates.map(b => ({ ...b, prime: rates.prime }))
  const chartData: LinePoint[] = history.map(h => ({ l: h.date, v: h.rate }))

  const kpis = [
    { label: 'ריבית פריים', value: loading ? '—' : `${rates.prime.toFixed(2)}%`, color: t.primary, accent: t.primary },
    { label: 'מדד אחרון', value: `${rates.lastCpi}%`, color: t.accent, accent: t.accent },
    { label: 'ריבית בנק ישראל', value: loading ? '—' : `${rates.boiRate.toFixed(2)}%`, color: t.success, accent: t.success },
  ]

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={22} style={{ color: t.primary }} />
              שוק הריביות
            </h1>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>נתוני ריבית עדכניים מבנק ישראל</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textMuted }}>
            {loading
              ? <Loader2 size={13} className="animate-spin" style={{ color: t.primary }} />
              : <RefreshCw size={13} style={{ color: t.textMuted }} />}
            <span>{loading ? 'טוען...' : `עודכן: ${updatedAt}`}</span>
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
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${t.border}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>ריביות לפי בנק</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.bg }}>
                  {['בנק', 'פריים', 'קל"צ', 'קל"ב', 'משתנה צמודה'].map(h => (
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
      </div>
    </div>
  )
}

interface BankRowProps {
  bank: { bank: string; prime: number; fixedNonLinked: number; fixedLinked: number; variableLinked: number }
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
      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>{bank.fixedNonLinked}%</td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>{bank.fixedLinked}%</td>
      <td style={{ padding: '14px 20px', fontSize: 13, color: t.textSub }}>{bank.variableLinked}%</td>
    </tr>
  )
}
