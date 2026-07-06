import { useState, useMemo, useEffect } from 'react'
import { Plus, Sparkles, AlertTriangle, CheckCircle, Download, Save, X, Loader2 } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import {
  calculateMonthlyPayment,
  calculateAmortizationSchedule,
  checkCompliance,
  generateRecommendedMixes,
  calculateGracePayments,
  effectiveMonthlyPayment,
  type TrackInput,
  type GraceType,
  type LiveRates,
} from '@/utils/mortgageCalculations'
import type { LoanTrackType, PropertyType } from '@/types/database'
import { db, functions } from '@/lib/firebase'
import { toast } from '@/components/ui'

const TRACK_COLORS = ['#059669', '#2563eb', '#d97706', '#8b5cf6']

const trackTypes: { value: LoanTrackType; label: string }[] = [
  { value: 'פריים',            label: 'פריים' },
  { value: 'קל"צ',             label: 'קבועה לא צמודה' },
  { value: 'קל"ב',             label: 'קבועה צמודה' },
  { value: 'משתנה_צמודה',      label: 'משתנה צמודה' },
  { value: 'משתנה_לא_צמודה',  label: 'משתנה לא צמודה' },
  { value: 'זכאות',            label: 'זכאות' },
]

const propertyTypes: { value: PropertyType; label: string }[] = [
  { value: 'דירה_ראשונה', label: 'דירה ראשונה' },
  { value: 'משפרי_דיור',  label: 'משפרי דיור' },
  { value: 'להשקעה',     label: 'להשקעה' },
]

const emptyTrack: TrackInput = { type: 'קל"צ', amount: 0, interestRate: 4.5, periodMonths: 300 }

function InputField({
  label, value, onChange, type = 'number', prefix, suffix, readOnly = false,
}: {
  label: string
  value: number | string
  onChange?: (v: string) => void
  type?: string
  prefix?: string
  suffix?: string
  readOnly?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e', letterSpacing: '0.03em' }}>
        {label}
      </label>
      <div
        className="flex items-center overflow-hidden transition-all duration-150"
        style={{
          border: `1.5px solid ${focused ? '#059669' : '#e7e5e4'}`,
          borderRadius: 10,
          background: readOnly ? '#faf9f7' : '#ffffff',
          boxShadow: focused ? '0 0 0 3px rgba(5,150,105,0.12)' : 'none',
        }}
      >
        {prefix && (
          <span className="px-3 text-[14px] font-semibold shrink-0" style={{ color: '#a8a29e' }}>{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 py-2.5 bg-transparent outline-none text-[14px]"
          style={{
            color: readOnly ? '#57534e' : '#1c1917',
            paddingRight: prefix ? 4 : 12,
            paddingLeft: suffix ? 4 : 12,
            fontFamily: 'var(--font-heebo)',
          }}
          dir="ltr"
        />
        {suffix && (
          <span className="px-3 text-[13px] shrink-0" style={{ color: '#a8a29e' }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}

export default function MortgageCalculatorPage() {
  const [propertyPrice, setPropertyPrice] = useState(1500000)
  const [ownCapital, setOwnCapital] = useState(300000)
  const [propertyType, setPropertyType] = useState<PropertyType>('דירה_ראשונה')
  const [monthlyIncome, setMonthlyIncome] = useState(25000)
  const [tracks, setTracks] = useState<TrackInput[]>([
    { type: 'פריים', amount: 600000, interestRate: 5.0, periodMonths: 240 },
    { type: 'קל"צ',  amount: 600000, interestRate: 3.2, periodMonths: 300 },
  ])
  const [showAmortization, setShowAmortization] = useState(false)
  const [activeRecommendation, setActiveRecommendation] = useState<number | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [aiAdvising, setAiAdvising] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<{ rationale: string; risk_level: string } | null>(null)
  const [liveRates, setLiveRates] = useState<LiveRates | undefined>()

  useEffect(() => {
    const rateMap: Record<string, string> = {
      'קל"צ': 'fixed_linked',
      'קל"ב': 'fixed_unlinked',
      'משתנה_צמודה': 'variable_linked',
      'זכאות': 'eligibility',
    }
    getDocs(query(collection(db, 'interest_rates'), orderBy('effective_date', 'desc'), limit(20)))
      .then(snap => {
        const rates: LiveRates = {}
        const seen = new Set<string>()
        for (const d of snap.docs) {
          const data = d.data()
          const key = rateMap[data.track_type]
          if (key && !seen.has(key) && typeof data.rate === 'number') {
            (rates as Record<string, number>)[key] = data.rate
            seen.add(key)
          }
        }
        if (Object.keys(rates).length > 0) setLiveRates(rates)
      })
      .catch(() => {})
  }, [])

  const loanAmount  = Math.max(0, propertyPrice - ownCapital)
  const ltv         = propertyPrice > 0 ? Math.round((loanAmount / propertyPrice) * 100) : 0
  const ltvColor    = ltv > 75 ? '#dc2626' : ltv > 60 ? '#d97706' : '#059669'
  const tracksTotal = tracks.reduce((s, t) => s + t.amount, 0)

  const totalMonthlyPayment = useMemo(() =>
    tracks.reduce((sum, t) => sum + effectiveMonthlyPayment(t), 0),
    [tracks]
  )

  const totalCost = useMemo(() =>
    tracks.reduce((s, t) => s + effectiveMonthlyPayment(t) * t.periodMonths, 0),
    [tracks]
  )

  const compliance = useMemo(() =>
    checkCompliance(tracks, propertyPrice, propertyType, monthlyIncome),
    [tracks, propertyPrice, propertyType, monthlyIncome]
  )

  const recommendations = useMemo(() =>
    generateRecommendedMixes(loanAmount, 300, 6.0, liveRates),
    [loanAmount, liveRates]
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

  const handleExportPdf = async () => {
    setGeneratingPdf(true)
    try {
      const { exportMortgagePdf } = await import('@/utils/pdfExport')
      await exportMortgagePdf({
        propertyPrice,
        ownCapital,
        loanAmount,
        ltv,
        monthlyIncome,
        tracks: tracks.map(t => ({
          type: t.type,
          amount: t.amount,
          interestRate: t.interestRate,
          periodMonths: t.periodMonths,
          monthlyPayment: Math.round(effectiveMonthlyPayment(t)),
        })),
        totalMonthlyPayment: Math.round(totalMonthlyPayment),
        totalCost: Math.round(totalCost),
        compliance: compliance.checks.map(c => ({
          name: c.name,
          value: c.value,
          limit: c.limit,
          isValid: c.isValid,
        })),
      })
    } catch (e) {
      console.error('PDF export failed', e)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleAiAdvice = async () => {
    setAiAdvising(true)
    try {
      const adviseFn = httpsCallable(functions, 'adviseMortgageMix')
      const res = await adviseFn({
        loan_amount: loanAmount,
        monthly_income: monthlyIncome,
        property_type: propertyType,
        property_price: propertyPrice,
      })
      const data = res.data as {
        rationale: string
        risk_level: string
        tracks: { type: LoanTrackType; amount: number; interest_rate: number; period_months: number }[]
      }
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        setTracks(
          data.tracks.map(t => ({
            type: t.type,
            amount: t.amount,
            interestRate: t.interest_rate,
            periodMonths: t.period_months,
          }))
        )
      }
      setAiAdvice({ rationale: data.rationale, risk_level: data.risk_level })
      toast.success('המלצת AI מוכנה', 'התמהיל המוצע הוחל על המחשבון')
    } catch (e) {
      toast.error('שגיאה בהפקת ההמלצה', e instanceof Error ? e.message : undefined)
    } finally {
      setAiAdvising(false)
    }
  }

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
    border: '1px solid #e7e5e4',
  }

  return (
    <div className="animate-fade-in max-w-[1360px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-black" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
          מחשבון משכנתא
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: '#a8a29e' }}>חשב תשלום חודשי לפי מסלולים</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Property inputs */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: '#1c1917' }}>נתוני הנכס</h3>
            <div className="flex flex-col gap-3">
              <InputField label="מחיר הנכס" value={propertyPrice} onChange={v => setPropertyPrice(Number(v) || 0)} prefix="₪" />
              <InputField label="הון עצמי" value={ownCapital} onChange={v => setOwnCapital(Number(v) || 0)} prefix="₪" />

              <div className="grid grid-cols-2 gap-3">
                <InputField label="סכום הלוואה" value={formatCurrency(loanAmount)} readOnly />
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e', letterSpacing: '0.03em' }}>LTV</label>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: ltvColor + '15',
                      border: `1.5px solid ${ltvColor}40`,
                    }}
                  >
                    <span className="font-black" style={{ fontSize: 18, color: ltvColor }}>{ltv}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e', letterSpacing: '0.03em' }}>סוג נכס</label>
                  <select
                    value={propertyType}
                    onChange={e => setPropertyType(e.target.value as PropertyType)}
                    className="w-full py-2.5 px-3 text-[14px] outline-none transition-all duration-150"
                    style={{
                      border: '1.5px solid #e7e5e4',
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#1c1917',
                      fontFamily: 'var(--font-heebo)',
                    }}
                  >
                    {propertyTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <InputField label="הכנסה חודשית נטו" value={monthlyIncome} onChange={v => setMonthlyIncome(Number(v) || 0)} prefix="₪" />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: '#1c1917' }}>סיכום</h3>
            <div className="flex flex-col divide-y" style={{ borderColor: '#f5f4f2' }}>
              {[
                { label: 'תשלום חודשי', value: formatCurrency(Math.round(totalMonthlyPayment)), highlight: true },
                {
                  label: 'סה"כ מסלולים',
                  value: formatCurrency(tracksTotal),
                  note: tracksTotal !== loanAmount ? `פער: ${formatCurrency(Math.abs(loanAmount - tracksTotal))}` : null,
                },
                { label: 'עלות כוללת', value: formatCurrency(Math.round(totalCost)) },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-3">
                  <span className="text-[13px]" style={{ color: '#a8a29e' }}>{row.label}</span>
                  <div className="flex items-center gap-2">
                    {row.note && (
                      <span className="text-[11px] font-medium" style={{ color: '#d97706' }}>{row.note}</span>
                    )}
                    <span
                      className="font-black tabular-nums"
                      style={{
                        fontSize: row.highlight ? 22 : 15,
                        color: row.highlight ? '#059669' : '#1c1917',
                        fontFamily: 'var(--font-heebo)',
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: '#1c1917' }}>
              {compliance.isValid
                ? <CheckCircle size={16} style={{ color: '#059669' }} />
                : <AlertTriangle size={16} style={{ color: '#dc2626' }} />
              }
              בדיקת Compliance
            </h3>
            <div className="space-y-3">
              {compliance.checks.map((check, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span style={{ color: '#57534e' }}>{check.name}</span>
                    <span className="font-semibold" style={{ color: check.isValid ? '#059669' : '#dc2626' }}>{check.value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f5f4f2' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((check.value / check.limit) * 100, 100)}%`,
                        background: check.isValid ? '#059669' : '#dc2626',
                      }}
                    />
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: check.isValid ? '#059669' : '#dc2626' }}>
                    {check.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ ...cardStyle, padding: '18px 24px' }} className="flex flex-col gap-2">
            <button
              onClick={handleAiAdvice}
              disabled={aiAdvising}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
              style={{ borderRadius: 12, background: '#fef3c7', color: '#d97706' }}
            >
              {aiAdvising ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {aiAdvising ? 'מנתח...' : 'המלצת AI לתמהיל'}
            </button>
            <button
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ borderRadius: 12, background: '#059669', boxShadow: '0 4px 14px rgba(5,150,105,0.27)' }}
            >
              <Save size={15} />
              שמור תמהיל ללקוח
            </button>
            <button
              onClick={handleExportPdf}
              disabled={generatingPdf}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80 disabled:opacity-50"
              style={{ borderRadius: 12, background: '#f5f4f2', color: '#57534e' }}
            >
              <Download size={15} />
              {generatingPdf ? 'מכין PDF...' : 'הורד PDF'}
            </button>
          </div>

          {/* AI advice */}
          {aiAdvice && (
            <div style={{ ...cardStyle, padding: '20px 24px' }}>
              <h3 className="text-[14px] font-bold mb-2 flex items-center gap-2" style={{ color: '#1c1917' }}>
                <Sparkles size={15} style={{ color: '#d97706' }} />
                המלצת AI
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px]" style={{ color: '#a8a29e' }}>רמת סיכון:</span>
                <span
                  className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#fef3c7', color: '#d97706' }}
                >
                  {aiAdvice.risk_level}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: '#57534e' }}>{aiAdvice.rationale}</p>
            </div>
          )}

          {/* Sensitivity */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-3" style={{ color: '#1c1917' }}>ניתוח רגישות</h3>
            <div className="space-y-2">
              {[0, 0.5, 1, 1.5, 2].map(delta => {
                const adjusted = tracks.reduce((sum, t) =>
                  sum + calculateMonthlyPayment(t.amount, t.interestRate + delta, t.periodMonths), 0
                )
                const isCurrent = delta === 0
                return (
                  <div key={delta} className="flex justify-between items-center text-[13px]">
                    <span style={{ color: '#a8a29e' }}>{isCurrent ? 'נוכחי' : `+${delta}%`}</span>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: isCurrent ? '#059669' : '#1c1917' }}
                    >
                      {formatCurrency(Math.round(adjusted))}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Track header */}
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold" style={{ color: '#1c1917' }}>
              מסלולים ({tracks.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => applyRecommendation(1)}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold transition-all hover:opacity-80"
                style={{ borderRadius: 10, background: '#fef3c7', color: '#d97706' }}
              >
                <Sparkles size={13} />
                תמהילים מומלצים
              </button>
              <button
                onClick={addTrack}
                disabled={tracks.length >= 6}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ borderRadius: 10, background: '#059669', boxShadow: '0 3px 10px rgba(5,150,105,0.35)' }}
              >
                <Plus size={13} />
                הוסף מסלול
              </button>
            </div>
          </div>

          {/* Track cards */}
          {tracks.map((track, idx) => {
            const col = TRACK_COLORS[idx % TRACK_COLORS.length]
            const monthly = effectiveMonthlyPayment(track)
            const pct = tracksTotal > 0 ? Math.round((track.amount / tracksTotal) * 100) : 0
            const hasGrace = (track.graceMonths ?? 0) > 0
            const gracePayments = hasGrace
              ? calculateGracePayments(track.amount, track.interestRate, track.periodMonths, track.graceMonths!, track.graceType || 'חלקי')
              : null

            return (
              <div
                key={idx}
                style={{
                  ...cardStyle,
                  padding: '20px 22px',
                  animationName: 'fadeUp',
                  animationDuration: '0.4s',
                  animationDelay: `${idx * 0.08}s`,
                  animationFillMode: 'backwards',
                }}
              >
                {/* Track header row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full shrink-0" style={{ width: 10, height: 10, background: col }} />
                    <select
                      value={track.type}
                      onChange={e => updateTrack(idx, 'type', e.target.value)}
                      className="text-[15px] font-bold outline-none bg-transparent cursor-pointer"
                      style={{ color: '#1c1917', fontFamily: 'var(--font-heebo)', border: 'none' }}
                    >
                      {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] px-2.5 py-1 rounded-full" style={{ background: '#f5f4f2', color: '#a8a29e' }}>
                      {pct}% מהלוואה
                    </span>
                    <button
                      onClick={() => removeTrack(idx)}
                      className="transition-colors hover:text-red-500"
                      style={{ color: '#a8a29e' }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Inputs grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <InputField label="סכום" value={track.amount} onChange={v => updateTrack(idx, 'amount', +v || 0)} prefix="₪" />
                  <InputField label="ריבית שנתית" value={track.interestRate} onChange={v => updateTrack(idx, 'interestRate', +v || 0)} suffix="%" />
                  <InputField label="תקופה" value={track.periodMonths} onChange={v => updateTrack(idx, 'periodMonths', +v || 0)} suffix="חו'" />
                </div>

                {/* Grace period */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <InputField
                    label="גרייס (חודשים)"
                    value={track.graceMonths ?? 0}
                    onChange={v => updateTrack(idx, 'graceMonths', +v || 0)}
                  />
                  {hasGrace && (
                    <div>
                      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e', letterSpacing: '0.03em' }}>סוג גרייס</label>
                      <select
                        value={track.graceType ?? 'חלקי'}
                        onChange={e => updateTrack(idx, 'graceType', e.target.value as GraceType)}
                        className="w-full py-2.5 px-3 text-[14px] outline-none"
                        style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, background: '#fff', color: '#1c1917', fontFamily: 'var(--font-heebo)' }}
                      >
                        <option value="חלקי">חלקי (ריבית בלבד)</option>
                        <option value="מלא">מלא (קרן + ריבית נדחים)</option>
                      </select>
                    </div>
                  )}
                </div>

                {hasGrace && gracePayments && (
                  <div className="mb-4 text-[12px] px-3 py-2 rounded-lg" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                    <span className="font-semibold">גרייס {track.graceType} · {track.graceMonths} חודשים: </span>
                    {track.graceType === 'מלא'
                      ? `ללא תשלום → ${formatCurrency(gracePayments.afterGrace)}/חודש לאחר מכן`
                      : `${formatCurrency(gracePayments.duringGrace)}/חודש (ריבית) → ${formatCurrency(gracePayments.afterGrace)}/חודש לאחר מכן`
                    }
                  </div>
                )}

                {/* Monthly result */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                  style={{ background: col + '12' }}
                >
                  <span className="text-[13px]" style={{ color: '#57534e' }}>תשלום חודשי</span>
                  <span className="font-black tabular-nums" style={{ fontSize: 18, color: col, fontFamily: 'var(--font-heebo)' }}>
                    {formatCurrency(Math.round(monthly))}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Recommendations */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: '#1c1917' }}>
              <Sparkles size={15} style={{ color: '#d97706' }} />
              תמהילים מומלצים
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {recommendations.map((rec, idx) => {
                const monthly = rec.tracks.reduce((s, t) => s + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0)
                const active = activeRecommendation === idx
                return (
                  <button
                    key={idx}
                    onClick={() => applyRecommendation(idx)}
                    className="text-right p-3 transition-all duration-150"
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${active ? '#059669' : '#e7e5e4'}`,
                      background: active ? '#d1fae5' : '#faf9f7',
                    }}
                  >
                    <p className="text-[13px] font-semibold" style={{ color: '#1c1917' }}>{rec.name}</p>
                    <p className="text-[13px] font-black mt-1" style={{ color: '#059669' }}>{formatCurrency(Math.round(monthly))}/חודש</p>
                    <p className="text-[11px] mt-1" style={{ color: '#a8a29e' }}>{rec.tracks.length} מסלולים</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amortization chart */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold" style={{ color: '#1c1917' }}>גרף החזרים לאורך זמן</h3>
              <button
                onClick={() => setShowAmortization(!showAmortization)}
                className="text-[13px] font-medium underline transition-colors"
                style={{ color: '#059669' }}
              >
                {showAmortization ? 'הסתר' : 'הצג'} לוח סילוקין
              </button>
            </div>
            {showAmortization && amortizationData.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={amortizationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f4f2" />
                  <XAxis dataKey="year" label={{ value: 'שנה', position: 'bottom' }} tick={{ fontSize: 11, fill: '#a8a29e' }} />
                  <YAxis tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => formatCurrency(v as number)}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e7e5e4', fontSize: 12 }}
                  />
                  <Bar dataKey="principal" name="קרן"   fill="#059669" stackId="a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interest"  name="ריבית" fill="#d97706" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {!showAmortization && (
              <div className="flex items-center justify-center h-16 text-[13px]" style={{ color: '#a8a29e' }}>
                לחץ "הצג לוח סילוקין" כדי לראות את הגרף
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
