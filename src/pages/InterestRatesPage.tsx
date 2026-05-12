import { useState, useEffect } from 'react'
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

const cardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
}

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

export default function InterestRatesPage() {
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

  const displayedBankRates = bankRates.map(b => ({
    ...b,
    prime: rates.prime,
  }))

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
            <TrendingUp size={22} style={{ color: '#059669' }} />
            שוק הריביות
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>נתוני ריבית עדכניים מבנק ישראל</p>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] shrink-0" style={{ color: '#a8a29e' }}>
          {loading ? <Loader2 size={13} className="animate-spin" style={{ color: '#059669' }} /> : <RefreshCw size={13} />}
          {loading ? 'טוען...' : `עודכן: ${updatedAt}`}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div style={{ ...cardStyle, padding: 20, textAlign: 'center', borderRight: '4px solid #059669' }}>
          <p className="text-[13px] mb-1" style={{ color: '#a8a29e' }}>ריבית פריים</p>
          {loading ? <Loader2 size={24} className="mx-auto animate-spin" style={{ color: '#059669' }} /> : (
            <p className="text-[32px] font-black" style={{ color: '#059669' }}>{rates.prime.toFixed(2)}%</p>
          )}
        </div>
        <div style={{ ...cardStyle, padding: 20, textAlign: 'center', borderRight: '4px solid #f59e0b' }}>
          <p className="text-[13px] mb-1" style={{ color: '#a8a29e' }}>מדד אחרון</p>
          <p className="text-[32px] font-black" style={{ color: '#f59e0b' }}>{rates.lastCpi}%</p>
        </div>
        <div style={{ ...cardStyle, padding: 20, textAlign: 'center', borderRight: '4px solid #22c55e' }}>
          <p className="text-[13px] mb-1" style={{ color: '#a8a29e' }}>ריבית בנק ישראל</p>
          {loading ? <Loader2 size={24} className="mx-auto animate-spin" style={{ color: '#059669' }} /> : (
            <p className="text-[32px] font-black" style={{ color: '#22c55e' }}>{rates.boiRate.toFixed(2)}%</p>
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>מגמת ריבית פריים</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f4f2" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#a8a29e' }} />
            <YAxis domain={[5, 6.5]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12, fill: '#a8a29e' }} />
            <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 10, border: '1px solid #e7e5e4', fontSize: 13 }} />
            <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <h2 className="text-[15px] font-bold p-5" style={{ color: '#1c1917', borderBottom: '1px solid #f5f4f2' }}>ריביות לפי בנק</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: '#faf9f7' }}>
                <th className="text-right p-3 font-semibold" style={{ color: '#a8a29e' }}>בנק</th>
                <th className="text-right p-3 font-semibold" style={{ color: '#a8a29e' }}>פריים</th>
                <th className="text-right p-3 font-semibold" style={{ color: '#a8a29e' }}>קל"צ</th>
                <th className="text-right p-3 font-semibold" style={{ color: '#a8a29e' }}>קל"ב</th>
                <th className="text-right p-3 font-semibold" style={{ color: '#a8a29e' }}>משתנה צמודה</th>
              </tr>
            </thead>
            <tbody>
              {displayedBankRates.map(bank => (
                <tr key={bank.bank} style={{ borderTop: '1px solid #f5f4f2' }} className="transition-colors hover:bg-[#faf9f7]">
                  <td className="p-3 font-semibold" style={{ color: '#1c1917' }}>{bank.bank}</td>
                  <td className="p-3 font-semibold" style={{ color: '#059669' }}>{bank.prime.toFixed(2)}%</td>
                  <td className="p-3" style={{ color: '#57534e' }}>{bank.fixedNonLinked}%</td>
                  <td className="p-3" style={{ color: '#57534e' }}>{bank.fixedLinked}%</td>
                  <td className="p-3" style={{ color: '#57534e' }}>{bank.variableLinked}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
