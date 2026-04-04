import { useState, useMemo } from 'react'
import { Calculator, Plus, Trash2, Sparkles, AlertTriangle, CheckCircle, Download, Save } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  calculateMonthlyPayment,
  calculateAmortizationSchedule,
  checkCompliance,
  generateRecommendedMixes,
  type TrackInput,
} from '@/utils/mortgageCalculations'
import type { LoanTrackType, PropertyType } from '@/types/database'

const trackTypes: { value: LoanTrackType; label: string }[] = [
  { value: 'פריים', label: 'פריים' },
  { value: 'קל"צ', label: 'קבועה לא צמודה' },
  { value: 'קל"ב', label: 'קבועה צמודה' },
  { value: 'משתנה_צמודה', label: 'משתנה צמודה' },
  { value: 'משתנה_לא_צמודה', label: 'משתנה לא צמודה' },
  { value: 'זכאות', label: 'זכאות' },
]

const propertyTypes: { value: PropertyType; label: string }[] = [
  { value: 'דירה_ראשונה', label: 'דירה ראשונה' },
  { value: 'משפרי_דיור', label: 'משפרי דיור' },
  { value: 'להשקעה', label: 'להשקעה' },
]

const emptyTrack: TrackInput = { type: 'קל"צ', amount: 0, interestRate: 4.5, periodMonths: 300 }

export default function MortgageCalculatorPage() {
  const [propertyPrice, setPropertyPrice] = useState(2000000)
  const [ownCapital, setOwnCapital] = useState(500000)
  const [propertyType, setPropertyType] = useState<PropertyType>('דירה_ראשונה')
  const [monthlyIncome, setMonthlyIncome] = useState(25000)
  const [tracks, setTracks] = useState<TrackInput[]>([
    { type: 'קל"צ', amount: 500000, interestRate: 4.5, periodMonths: 300 },
    { type: 'קל"ב', amount: 500000, interestRate: 3.8, periodMonths: 300 },
    { type: 'פריים', amount: 500000, interestRate: 6.0, periodMonths: 300 },
  ])
  const [showAmortization, setShowAmortization] = useState(false)
  const [activeRecommendation, setActiveRecommendation] = useState<number | null>(null)

  const loanAmount = propertyPrice - ownCapital

  const totalMonthlyPayment = useMemo(() =>
    tracks.reduce((sum, t) => sum + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0),
    [tracks]
  )

  const tracksTotal = tracks.reduce((sum, t) => sum + t.amount, 0)

  const compliance = useMemo(() =>
    checkCompliance(tracks, propertyPrice, propertyType, monthlyIncome),
    [tracks, propertyPrice, propertyType, monthlyIncome]
  )

  const recommendations = useMemo(() =>
    generateRecommendedMixes(loanAmount, 300, 6.0),
    [loanAmount]
  )

  const amortizationData = useMemo(() => {
    if (!showAmortization || tracks.length === 0) return []
    const schedule = calculateAmortizationSchedule(tracks[0].amount, tracks[0].interestRate, tracks[0].periodMonths)
    return schedule.filter((_, i) => i % 12 === 0).map(row => ({
      year: Math.ceil(row.month / 12),
      payment: row.payment,
      principal: row.principal,
      interest: row.interest,
      balance: row.balance,
    }))
  }, [showAmortization, tracks])

  const addTrack = () => setTracks([...tracks, { ...emptyTrack }])
  const removeTrack = (idx: number) => setTracks(tracks.filter((_, i) => i !== idx))
  const updateTrack = (idx: number, field: keyof TrackInput, value: number | string) => {
    setTracks(tracks.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const applyRecommendation = (idx: number) => {
    setTracks(recommendations[idx].tracks)
    setActiveRecommendation(idx)
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Calculator className="text-[#1a4f8a]" size={28} />
        מחשבון משכנתא
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input */}
        <div className="lg:col-span-2 space-y-4">
          {/* Property Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">פרטי הנכס</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">מחיר נכס</label>
                <input type="number" value={propertyPrice} onChange={e => setPropertyPrice(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">הון עצמי</label>
                <input type="number" value={ownCapital} onChange={e => setOwnCapital(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">סוג נכס</label>
                <select value={propertyType} onChange={e => setPropertyType(e.target.value as PropertyType)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none bg-white">
                  {propertyTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">הכנסה חודשית נטו</label>
                <input type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(+e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a4f8a] outline-none" dir="ltr" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="text-gray-600">סכום הלוואה: <strong className="text-[#1a4f8a]">{formatCurrency(loanAmount)}</strong></span>
              {tracksTotal !== loanAmount && (
                <span className="text-red-500">סה"כ מסלולים: {formatCurrency(tracksTotal)} (הפרש: {formatCurrency(Math.abs(loanAmount - tracksTotal))})</span>
              )}
            </div>
          </div>

          {/* Tracks */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">מסלולי תמהיל</h2>
              <div className="flex gap-2">
                <button onClick={() => applyRecommendation(1)} className="text-sm bg-[#e8f0fe] text-[#1a4f8a] px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                  <Sparkles size={14} />
                  תמהילים מומלצים
                </button>
                <button onClick={addTrack} disabled={tracks.length >= 6} className="text-sm bg-[#1a4f8a] text-white px-3 py-1.5 rounded-lg hover:bg-[#143d6b] flex items-center gap-1 disabled:opacity-50">
                  <Plus size={14} />
                  הוסף מסלול
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {tracks.map((track, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-3 items-end p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">סוג</label>
                    <select value={track.type} onChange={e => updateTrack(idx, 'type', e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">סכום</label>
                    <input type="number" value={track.amount} onChange={e => updateTrack(idx, 'amount', +e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ריבית %</label>
                    <input type="number" step="0.1" value={track.interestRate} onChange={e => updateTrack(idx, 'interestRate', +e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">תקופה (חודשים)</label>
                    <input type="number" value={track.periodMonths} onChange={e => updateTrack(idx, 'periodMonths', +e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm" dir="ltr" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1a4f8a]">{formatCurrency(calculateMonthlyPayment(track.amount, track.interestRate, track.periodMonths))}/חודש</span>
                    <button onClick={() => removeTrack(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 p-4 bg-[#e8f0fe] rounded-lg flex items-center justify-between">
              <span className="font-semibold text-gray-800">סה"כ החזר חודשי</span>
              <span className="text-2xl font-bold text-[#1a4f8a]">{formatCurrency(totalMonthlyPayment)}</span>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-[#f59e0b]" />
              תמהילים מומלצים
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {recommendations.map((rec, idx) => {
                const monthly = rec.tracks.reduce((s, t) => s + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0)
                return (
                  <button key={idx} onClick={() => applyRecommendation(idx)} className={`p-3 rounded-lg border-2 text-right transition-all ${activeRecommendation === idx ? 'border-[#1a4f8a] bg-[#e8f0fe]' : 'border-gray-200 hover:border-[#1a4f8a]/50'}`}>
                    <p className="font-medium text-gray-900">{rec.name}</p>
                    <p className="text-sm text-[#1a4f8a] font-bold mt-1">{formatCurrency(monthly)}/חודש</p>
                    <p className="text-xs text-gray-500 mt-1">{rec.tracks.length} מסלולים</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">גרף החזרים לאורך זמן</h2>
              <button onClick={() => setShowAmortization(!showAmortization)} className="text-sm text-[#1a4f8a] hover:underline">
                {showAmortization ? 'הסתר' : 'הצג'} לוח סילוקין
              </button>
            </div>
            {showAmortization && amortizationData.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={amortizationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" label={{ value: 'שנה', position: 'bottom' }} />
                  <YAxis tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="principal" name="קרן" fill="#1a4f8a" stackId="a" />
                  <Bar dataKey="interest" name="ריבית" fill="#f59e0b" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Compliance + Summary */}
        <div className="space-y-4">
          {/* Compliance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {compliance.isValid ? <CheckCircle className="text-green-500" size={18} /> : <AlertTriangle className="text-red-500" size={18} />}
              בדיקת Compliance
            </h2>
            <div className="space-y-3">
              {compliance.checks.map((check, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{check.name}</span>
                    <span className={check.isValid ? 'text-green-600' : 'text-red-600'}>{check.value}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${check.isValid ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min((check.value / check.limit) * 100, 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-0.5 ${check.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {check.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <button className="w-full flex items-center justify-center gap-2 bg-[#1a4f8a] text-white py-2.5 rounded-lg hover:bg-[#143d6b] transition-colors">
              <Save size={18} />
              שמור תמהיל ללקוח
            </button>
            <button className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition-colors">
              <Download size={18} />
              הורד PDF
            </button>
          </div>

          {/* Sensitivity Analysis */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">ניתוח רגישות</h2>
            <div className="space-y-2">
              {[0, 0.5, 1, 1.5, 2].map(delta => {
                const adjusted = tracks.reduce((sum, t) =>
                  sum + calculateMonthlyPayment(t.amount, t.interestRate + delta, t.periodMonths), 0
                )
                return (
                  <div key={delta} className="flex justify-between text-sm">
                    <span className="text-gray-600">{delta === 0 ? 'נוכחי' : `+${delta}%`}</span>
                    <span className={delta === 0 ? 'font-bold text-[#1a4f8a]' : 'text-gray-700'}>{formatCurrency(adjusted)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
