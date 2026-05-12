import { useState, useMemo } from 'react'
import { RefreshCw, Plus, Trash2, TrendingDown, Upload } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { calculateMonthlyPayment, calculateRefinanceSavings, type TrackInput } from '@/utils/mortgageCalculations'
import type { LoanTrackType } from '@/types/database'

const trackTypes: { value: LoanTrackType; label: string }[] = [
  { value: 'פריים', label: 'פריים' },
  { value: 'קל"צ', label: 'קבועה לא צמודה' },
  { value: 'קל"ב', label: 'קבועה צמודה' },
  { value: 'משתנה_צמודה', label: 'משתנה צמודה' },
  { value: 'משתנה_לא_צמודה', label: 'משתנה לא צמודה' },
  { value: 'זכאות', label: 'זכאות' },
]

export default function RefinanceCalculatorPage() {
  const [existingTracks, setExistingTracks] = useState<TrackInput[]>([
    { type: 'קל"צ', amount: 400000, interestRate: 5.2, periodMonths: 240 },
    { type: 'פריים', amount: 300000, interestRate: 6.5, periodMonths: 240 },
  ])
  const [newTracks, setNewTracks] = useState<TrackInput[]>([
    { type: 'קל"צ', amount: 350000, interestRate: 4.2, periodMonths: 240 },
    { type: 'קל"ב', amount: 200000, interestRate: 3.5, periodMonths: 240 },
    { type: 'פריים', amount: 150000, interestRate: 6.0, periodMonths: 240 },
  ])
  const [earlyRepaymentFee, setEarlyRepaymentFee] = useState(15000)

  const savings = useMemo(() =>
    calculateRefinanceSavings(existingTracks, newTracks, earlyRepaymentFee),
    [existingTracks, newTracks, earlyRepaymentFee]
  )

  const cumulativeSavings = useMemo(() => {
    const data = []
    let cumulative = -earlyRepaymentFee
    for (let month = 1; month <= 240; month++) {
      cumulative += savings.monthlySaving
      if (month % 6 === 0) {
        data.push({ month, saving: Math.round(cumulative) })
      }
    }
    return data
  }, [savings, earlyRepaymentFee])

  const updateTrack = (tracks: TrackInput[], setTracks: (t: TrackInput[]) => void, idx: number, field: keyof TrackInput, value: number | string) => {
    setTracks(tracks.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const renderTrackEditor = (tracks: TrackInput[], setTracks: (t: TrackInput[]) => void, title: string) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <button onClick={() => setTracks([...tracks, { type: 'קל"צ', amount: 0, interestRate: 4.0, periodMonths: 240 }])} className="text-sm bg-[#1a4f8a] text-white px-3 py-1.5 rounded-lg hover:bg-[#143d6b] flex items-center gap-1">
          <Plus size={14} /> הוסף
        </button>
      </div>
      <div className="space-y-2">
        {tracks.map((track, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-2 items-end p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs text-gray-500 mb-1">סוג</label>
              <select value={track.type} onChange={e => updateTrack(tracks, setTracks, idx, 'type', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-white">
                {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">יתרה</label>
              <input type="number" value={track.amount} onChange={e => updateTrack(tracks, setTracks, idx, 'amount', +e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ריבית %</label>
              <input type="number" step="0.1" value={track.interestRate} onChange={e => updateTrack(tracks, setTracks, idx, 'interestRate', +e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">חודשים שנותרו</label>
              <input type="number" value={track.periodMonths} onChange={e => updateTrack(tracks, setTracks, idx, 'periodMonths', +e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" dir="ltr" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{formatCurrency(calculateMonthlyPayment(track.amount, track.interestRate, track.periodMonths))}</span>
              <button onClick={() => setTracks(tracks.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-left text-sm font-medium text-[#1a4f8a]">
        סה"כ: {formatCurrency(tracks.reduce((s, t) => s + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0))}/חודש
      </div>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <RefreshCw className="text-[#1a4f8a]" size={28} />
          מחשבון מחזור משכנתא
        </h1>
        <button className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-1">
          <Upload size={14} />
          העלה PDF דוח יתרות
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderTrackEditor(existingTracks, setExistingTracks, "תמהיל קיים")}
        {renderTrackEditor(newTracks, setNewTracks, "תמהיל מוצע")}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">עמלת פירעון מוקדם</label>
        <input type="number" value={earlyRepaymentFee} onChange={e => setEarlyRepaymentFee(+e.target.value)} className="w-48 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
      </div>

      {/* Comparison */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingDown className="text-green-500" size={18} />
          השוואה
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">החזר נוכחי</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(savings.existingMonthly)}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">החזר חדש</p>
            <p className="text-xl font-bold text-[#1a4f8a]">{formatCurrency(savings.newMonthly)}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">חיסכון חודשי</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(savings.monthlySaving)}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">חיסכון כולל</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(savings.totalSaving)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <span className="text-gray-600">עמלת פירעון: {formatCurrency(earlyRepaymentFee)}</span>
          <span className="text-gray-600">Break-Even: {savings.breakEvenMonths === Infinity ? 'לא רלוונטי' : `${savings.breakEvenMonths} חודשים`}</span>
          <span className={`font-bold px-3 py-1 rounded-full ${savings.isWorthIt ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {savings.isWorthIt ? '✅ כדאי לבצע מחזור' : '❌ לא כדאי כרגע'}
          </span>
        </div>
      </div>

      {/* Cumulative Savings Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">חיסכון מצטבר</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cumulativeSavings}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" label={{ value: 'חודש', position: 'bottom' }} />
            <YAxis tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v) => formatCurrency(v as number)} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="saving" stroke="#1a4f8a" strokeWidth={2} name="חיסכון מצטבר" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
