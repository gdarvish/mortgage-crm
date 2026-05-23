import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Sparkles, AlertTriangle, CheckCircle, Download, Save, X, Loader2 } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
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
} from '@/utils/mortgageCalculations'
import type { LoanTrackType, PropertyType } from '@/types/database'
import { functions } from '@/lib/firebase'
import { mortgageService } from '@/services/mortgageService'
import { toast } from '@/components/ui'
import { useTheme } from '@/theme/ThemeContext'
import type { Theme } from '@/theme/themes'
import { SaveMortgageDialog } from '@/components/SaveMortgageDialog'

// Local track type with per-track drawdown date
type CalcTrack = TrackInput & { startDate?: string | null }

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

const emptyTrack: CalcTrack = { type: 'קל"צ', amount: 0, interestRate: 4.5, periodMonths: 300, startDate: null }

// ─── SHARED: INPUT FIELD ──────────────────────────────────────────────────────
function Field({
  t, label, value, onChange, type = 'text', prefix, suffix, readOnly, min,
}: {
  t: Theme
  label: string
  value: number | string
  onChange?: (v: string) => void
  type?: string
  prefix?: string
  suffix?: string
  readOnly?: boolean
  min?: string // A3-17: allow min attribute
}) {
  const [focus, setFocus] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, letterSpacing: '0.03em' }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1.5px solid ${focus ? t.primary : t.border}`,
        borderRadius: 10, background: readOnly ? t.bg : t.inputBg,
        boxShadow: focus ? `0 0 0 3px ${t.primary}18` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s', overflow: 'hidden',
      }}>
        {prefix && <span style={{ padding: '0 10px 0 4px', color: t.textMuted, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{prefix}</span>}
        <input
          type={type} value={value}
          onChange={onChange ? e => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          dir="ltr"
          min={min}
          style={{
            flex: 1, padding: '10px 12px', border: 'none', outline: 'none',
            background: 'transparent', color: readOnly ? t.textSub : t.text,
            fontSize: 14, fontFamily: 'Heebo,sans-serif',
          }}
        />
        {suffix && <span style={{ padding: '0 12px', color: t.textMuted, fontSize: 13, flexShrink: 0 }}>{suffix}</span>}
      </div>
    </div>
  )
}

export default function MortgageCalculatorPage() {
  const t = useTheme()
  const [propertyPrice, setPropertyPrice] = useState(1500000)
  const [ownCapital, setOwnCapital] = useState(300000)
  const [propertyType, setPropertyType] = useState<PropertyType>('דירה_ראשונה')
  const [monthlyIncome, setMonthlyIncome] = useState(25000)
  const [tracks, setTracks] = useState<CalcTrack[]>([
    { type: 'פריים', amount: 600000, interestRate: 5.0, periodMonths: 240, startDate: null },
    { type: 'קל"צ',  amount: 600000, interestRate: 3.2, periodMonths: 300, startDate: null },
  ])
  const [showAmortization, setShowAmortization] = useState(false)
  const [activeRecommendation, setActiveRecommendation] = useState<number | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [aiAdvising, setAiAdvising] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<{ rationale: string; risk_level: string } | null>(null)

  const loanAmount  = Math.max(0, propertyPrice - ownCapital)
  const ltv         = propertyPrice > 0 ? Math.round((loanAmount / propertyPrice) * 100) : 0
  const ltvColor    = ltv > 75 ? t.danger : ltv > 60 ? t.warning : t.success
  const tracksTotal = tracks.reduce((s, tr) => s + tr.amount, 0)

  const totalMonthlyPayment = useMemo(() =>
    tracks.reduce((sum, tr) => sum + effectiveMonthlyPayment(tr), 0),
    [tracks]
  )

  const totalCost = useMemo(() =>
    tracks.reduce((s, tr) => s + effectiveMonthlyPayment(tr) * tr.periodMonths, 0),
    [tracks]
  )

  const compliance = useMemo(() =>
    checkCompliance(tracks, propertyPrice, propertyType, monthlyIncome),
    [tracks, propertyPrice, propertyType, monthlyIncome]
  )

  const recommendations = useMemo(() =>
    generateRecommendedMixes(loanAmount, 300, 6.0),
    [loanAmount]
  )

  const amortizationData = useMemo(() => {
    // A3-23: aggregate amortization across ALL tracks (not just first)
    // A3-05: use actual months from each track (not hardcoded 240)
    if (!showAmortization || tracks.length === 0) return []
    const maxMonths = Math.max(...tracks.map(tr => tr.periodMonths))
    const aggregated: { payment: number; principal: number; interest: number; balance: number }[] =
      Array.from({ length: maxMonths }, () => ({ payment: 0, principal: 0, interest: 0, balance: 0 }))

    for (const tr of tracks) {
      const schedule = calculateAmortizationSchedule(
        tr.amount, tr.interestRate, tr.periodMonths,
        tr.graceMonths ?? 0, tr.graceType ?? 'חלקי'
      )
      for (let i = 0; i < schedule.length; i++) {
        aggregated[i].payment   += schedule[i].payment
        aggregated[i].principal += schedule[i].principal
        aggregated[i].interest  += schedule[i].interest
        aggregated[i].balance   += schedule[i].balance
      }
    }

    return aggregated
      .map((row, i) => ({ ...row, month: i + 1 }))
      .filter((_, i) => i % 12 === 0)
      .map(row => ({
        year: Math.ceil(row.month / 12),
        payment: Math.round(row.payment),
        principal: Math.round(row.principal),
        interest: Math.round(row.interest),
        balance: Math.round(row.balance),
      }))
  }, [showAmortization, tracks])

  const addTrack = () => setTracks([...tracks, { ...emptyTrack }])
  const removeTrack = (idx: number) => setTracks(tracks.filter((_, i) => i !== idx))
  const updateTrack = (idx: number, field: keyof TrackInput, value: number | string) => {
    setTracks(tracks.map((tr, i) => i === idx ? { ...tr, [field]: value } : tr))
  }
  const updateTrackStartDate = (idx: number, value: string) => {
    setTracks(tracks.map((tr, i) => i === idx ? { ...tr, startDate: value === '' ? null : value } : tr))
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
        tracks: tracks.map(tr => ({
          type: tr.type,
          amount: tr.amount,
          interestRate: tr.interestRate,
          periodMonths: tr.periodMonths,
          monthlyPayment: Math.round(effectiveMonthlyPayment(tr)),
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
      // A3-13: surface PDF export errors to user
      console.error('PDF export failed', e)
      toast.error('שגיאה ביצוא PDF', e instanceof Error ? e.message : undefined)
    } finally {
      setGeneratingPdf(false)
    }
  }

  // A3-15: implement save mix handler — opens dialog and persists to Firestore
  const [searchParams] = useSearchParams()
  const urlCustomerId = searchParams.get('customerId') ?? undefined
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savingMix, setSavingMix] = useState(false)

  const openSaveDialog = () => setSaveDialogOpen(true)

  const handleSaveSubmit = async (v: {
    customerId: string
    name: string
    propertyAddress: string
    propertyX: number | null
    propertyY: number | null
  }) => {
    setSavingMix(true)
    try {
      const { data, error } = await mortgageService.create({
        customer_id: v.customerId,
        property_price: propertyPrice,
        loan_amount: loanAmount,
        own_capital: ownCapital,
        type: 'חדשה',
        status: 'טיוטה',
        property_type: propertyType,
        notes: null,
        compliance_status: null,
        name: v.name,
        property_address: v.propertyAddress || null,
        property_address_x: v.propertyX,
        property_address_y: v.propertyY,
      })
      if (error || !data) throw new Error(error?.message ?? 'שמירה נכשלה')

      // Persist tracks
      const trackResults = await Promise.all(
        tracks.map(tr =>
          mortgageService.addTrack({
            mortgage_id: data.id,
            type: tr.type,
            amount: tr.amount,
            interest_rate: tr.interestRate,
            period_months: tr.periodMonths,
            monthly_payment: Math.round(effectiveMonthlyPayment(tr)),
            is_existing: false,
            start_date: tr.startDate ?? null,
            end_date: null,
          }),
        ),
      )
      const trackErr = trackResults.find(r => r.error)
      if (trackErr?.error) throw new Error(trackErr.error.message)

      toast.success('התמהיל נשמר', `נוצר תיק משכנתא (${data.id})`)
      setSaveDialogOpen(false)
    } catch (e) {
      // Fallback: save to localStorage with the new metadata
      try {
        const saved = {
          savedAt: new Date().toISOString(),
          customerId: v.customerId,
          name: v.name,
          propertyAddress: v.propertyAddress,
          propertyX: v.propertyX,
          propertyY: v.propertyY,
          propertyPrice,
          ownCapital,
          loanAmount,
          monthlyIncome,
          propertyType,
          tracks,
        }
        const key = `mortgage_mix_${Date.now()}`
        localStorage.setItem(key, JSON.stringify(saved))
        toast.success('התמהיל נשמר מקומית', key)
        setSaveDialogOpen(false)
      } catch {
        toast.error('שגיאה בשמירת התמהיל', e instanceof Error ? e.message : undefined)
      }
    } finally {
      setSavingMix(false)
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
          data.tracks.map(tr => ({
            type: tr.type,
            amount: tr.amount,
            interestRate: tr.interest_rate,
            periodMonths: tr.period_months,
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

  const card = {
    background: t.cardBg,
    borderRadius: 20,
    boxShadow: t.shadow,
    border: `1px solid ${t.border}`,
  }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        {/* Header */}
        <div style={{ marginBottom: 28, animation: 'fadeUp 0.4s ease backwards' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>מחשבון משכנתא</h1>
          <p style={{ fontSize: 13, color: t.textMuted }}>חשב תשלום חודשי לפי מסלולים</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr]" style={{ gap: 20 }}>
          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Property inputs */}
            <div style={{ ...card, padding: '22px 24px', animation: 'fadeUp 0.4s ease 0.05s backwards' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>נתוני הנכס</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field t={t} label="מחיר הנכס" value={propertyPrice} onChange={v => setPropertyPrice(Number(v) || 0)} type="number" prefix="₪" min="0" />
                <Field t={t} label="הון עצמי" value={ownCapital} onChange={v => setOwnCapital(Number(v) || 0)} type="number" prefix="₪" min="0" />

                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                  <Field t={t} label="סכום הלוואה" value={formatCurrency(loanAmount)} readOnly />
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, letterSpacing: '0.03em' }}>LTV</label>
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: ltvColor + '15', border: `1.5px solid ${ltvColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: ltvColor }}>{ltv}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, letterSpacing: '0.03em' }}>סוג נכס</label>
                    <select
                      value={propertyType}
                      onChange={e => setPropertyType(e.target.value as PropertyType)}
                      style={{ width: '100%', padding: '10px 12px', fontSize: 14, outline: 'none', border: `1.5px solid ${t.border}`, borderRadius: 10, background: t.inputBg, color: t.text, fontFamily: 'Heebo,sans-serif' }}
                    >
                      {propertyTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <Field t={t} label="הכנסה חודשית נטו" value={monthlyIncome} onChange={v => setMonthlyIncome(Number(v) || 0)} type="number" prefix="₪" min="0" />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ ...card, padding: '22px 24px', animation: 'fadeUp 0.4s ease 0.1s backwards' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 18 }}>סיכום</h3>
              {[
                { label: 'תשלום חודשי', value: formatCurrency(Math.round(totalMonthlyPayment)), highlight: true, note: null as string | null },
                {
                  label: 'סה"כ מסלולים',
                  value: formatCurrency(tracksTotal),
                  highlight: false,
                  note: tracksTotal !== loanAmount ? `פער: ${formatCurrency(Math.abs(loanAmount - tracksTotal))}` : null,
                },
                { label: 'עלות כוללת', value: formatCurrency(Math.round(totalCost)), highlight: false, note: null as string | null },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${t.borderLight}` }}>
                  <span style={{ fontSize: 13, color: t.textMuted }}>{row.label}</span>
                  <div style={{ textAlign: 'left' }}>
                    {row.note && <span style={{ fontSize: 11, color: t.warning, marginLeft: 6 }}>{row.note}</span>}
                    <span style={{ fontSize: row.highlight ? 22 : 15, fontWeight: 800, color: row.highlight ? t.primary : t.text }}>{row.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Compliance */}
            <div style={{ ...card, padding: '22px 24px', animation: 'fadeUp 0.4s ease 0.15s backwards' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                {compliance.isValid
                  ? <CheckCircle size={16} style={{ color: t.success }} />
                  : <AlertTriangle size={16} style={{ color: t.danger }} />}
                בדיקת Compliance
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {compliance.checks.map((check, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: t.textSub }}>{check.name}</span>
                      <span style={{ fontWeight: 600, color: check.isValid ? t.success : t.danger }}>{check.value}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: t.borderLight }}>
                      <div style={{
                        height: '100%', borderRadius: 3, transition: 'width 0.5s',
                        width: `${Math.min((check.value / check.limit) * 100, 100)}%`,
                        background: check.isValid ? t.success : t.danger,
                      }} />
                    </div>
                    <p style={{ fontSize: 11, marginTop: 2, color: check.isValid ? t.success : t.danger }}>{check.message}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ ...card, padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeUp 0.4s ease 0.2s backwards' }}>
              <button
                onClick={handleAiAdvice}
                disabled={aiAdvising}
                className="crm-btn"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer', background: t.accentBg, color: t.accent, fontFamily: 'Heebo,sans-serif', opacity: aiAdvising ? 0.5 : 1 }}
              >
                {aiAdvising ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {aiAdvising ? 'מנתח...' : 'המלצת AI לתמהיל'}
              </button>
              <button
                onClick={openSaveDialog}
                disabled={savingMix}
                className="crm-btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer', background: t.primary, color: '#fff', fontFamily: 'Heebo,sans-serif', boxShadow: `0 4px 14px ${t.primary}45`, opacity: savingMix ? 0.5 : 1 }}
              >
                {savingMix ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {savingMix ? 'שומר...' : 'שמור תמהיל ללקוח'}
              </button>
              <button
                onClick={handleExportPdf}
                disabled={generatingPdf}
                className="crm-btn"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 12, border: `1px solid ${t.border}`, cursor: 'pointer', background: t.bg, color: t.textSub, fontFamily: 'Heebo,sans-serif', opacity: generatingPdf ? 0.5 : 1 }}
              >
                <Download size={15} />
                {generatingPdf ? 'מכין PDF...' : 'הורד PDF'}
              </button>
            </div>

            {/* AI advice */}
            {aiAdvice && (
              <div style={{ ...card, padding: '20px 24px', animation: 'fadeUp 0.4s ease backwards' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} style={{ color: t.accent }} />
                  המלצת AI
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>רמת סיכון:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: t.accentBg, color: t.accent }}>{aiAdvice.risk_level}</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: t.textSub }}>{aiAdvice.rationale}</p>
              </div>
            )}

            {/* Sensitivity */}
            <div style={{ ...card, padding: '22px 24px', animation: 'fadeUp 0.4s ease 0.25s backwards' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>ניתוח רגישות</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 0.5, 1, 1.5, 2].map(delta => {
                  const adjusted = tracks.reduce((sum, tr) =>
                    sum + calculateMonthlyPayment(tr.amount, tr.interestRate + delta, tr.periodMonths), 0
                  )
                  const isCurrent = delta === 0
                  return (
                    <div key={delta} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: t.textMuted }}>{isCurrent ? 'נוכחי' : `+${delta}%`}</span>
                      <span style={{ fontWeight: 700, color: isCurrent ? t.primary : t.text }}>{formatCurrency(Math.round(adjusted))}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Track header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, animation: 'fadeUp 0.4s ease 0.08s backwards' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>מסלולים ({tracks.length})</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => applyRecommendation(1)}
                  className="crm-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer', background: t.accentBg, color: t.accent, fontFamily: 'Heebo,sans-serif' }}
                >
                  <Sparkles size={13} />
                  תמהילים מומלצים
                </button>
                <button
                  onClick={addTrack}
                  disabled={tracks.length >= 6}
                  className="crm-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer', background: t.primary, color: '#fff', fontFamily: 'Heebo,sans-serif', boxShadow: `0 3px 10px ${t.primary}40`, opacity: tracks.length >= 6 ? 0.4 : 1 }}
                >
                  <Plus size={13} strokeWidth={2.5} />
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
                <div key={idx} style={{ ...card, padding: '20px 22px', animation: `fadeUp 0.4s ease ${idx * 0.08 + 0.12}s backwards` }}>
                  {/* Track header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: col }} />
                      <select
                        value={track.type}
                        onChange={e => updateTrack(idx, 'type', e.target.value)}
                        style={{ background: 'transparent', border: 'none', fontSize: 15, fontWeight: 700, color: t.text, cursor: 'pointer', fontFamily: 'Heebo,sans-serif', outline: 'none' }}
                      >
                        {trackTypes.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: t.textMuted, background: t.bg, padding: '3px 10px', borderRadius: 20 }}>{pct}% מהלוואה</span>
                      <button
                        onClick={() => removeTrack(idx)}
                        className="crm-btn"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, borderRadius: 6 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inputs grid */}
                  {/* A3-17: min attributes to prevent negative values */}
                  <div className="grid grid-cols-1 sm:grid-cols-4" style={{ gap: 12, marginBottom: 16 }}>
                    <Field t={t} label="סכום" value={track.amount} onChange={v => updateTrack(idx, 'amount', +v || 0)} type="number" prefix="₪" min="0" />
                    <Field t={t} label="ריבית שנתית" value={track.interestRate} onChange={v => updateTrack(idx, 'interestRate', +v || 0)} type="number" suffix="%" min="0" />
                    <Field t={t} label="תקופה" value={track.periodMonths} onChange={v => updateTrack(idx, 'periodMonths', +v || 0)} type="number" suffix="חו'" min="1" />
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, letterSpacing: '0.03em' }}>תאריך משיכה</label>
                      <input
                        type="date"
                        value={track.startDate ?? ''}
                        onChange={e => updateTrackStartDate(idx, e.target.value)}
                        dir="ltr"
                        style={{ width: '100%', padding: '10px 12px', fontSize: 14, outline: 'none', border: `1.5px solid ${t.border}`, borderRadius: 10, background: t.inputBg, color: t.text, fontFamily: 'Heebo,sans-serif', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Grace period */}
                  <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
                    <Field t={t} label="גרייס (חודשים)" value={track.graceMonths ?? 0} onChange={v => updateTrack(idx, 'graceMonths', +v || 0)} type="number" />
                    {hasGrace && (
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, letterSpacing: '0.03em' }}>סוג גרייס</label>
                        <select
                          value={track.graceType ?? 'חלקי'}
                          onChange={e => updateTrack(idx, 'graceType', e.target.value as GraceType)}
                          style={{ width: '100%', padding: '10px 12px', fontSize: 14, outline: 'none', border: `1.5px solid ${t.border}`, borderRadius: 10, background: t.inputBg, color: t.text, fontFamily: 'Heebo,sans-serif' }}
                        >
                          <option value="חלקי">חלקי (ריבית בלבד)</option>
                          <option value="מלא">מלא (קרן + ריבית נדחים)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {hasGrace && gracePayments && (
                    <div style={{ marginBottom: 16, fontSize: 12, padding: '8px 12px', borderRadius: 8, background: t.warningBg, color: t.warning, border: `1px solid ${t.warning}40` }}>
                      <span style={{ fontWeight: 600 }}>גרייס {track.graceType} · {track.graceMonths} חודשים: </span>
                      {track.graceType === 'מלא'
                        ? `ללא תשלום → ${formatCurrency(gracePayments.afterGrace)}/חודש לאחר מכן`
                        : `${formatCurrency(gracePayments.duringGrace)}/חודש (ריבית) → ${formatCurrency(gracePayments.afterGrace)}/חודש לאחר מכן`}
                    </div>
                  )}

                  {/* Monthly result */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: col + '12', borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: t.textSub }}>תשלום חודשי</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: col }}>{formatCurrency(Math.round(monthly))}</span>
                  </div>
                </div>
              )
            })}

            {/* Recommendations */}
            <div style={{ ...card, padding: '22px 24px', animation: 'fadeUp 0.4s ease 0.3s backwards' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={15} style={{ color: t.accent }} />
                תמהילים מומלצים
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                {recommendations.map((rec, idx) => {
                  const monthly = rec.tracks.reduce((s, tr) => s + calculateMonthlyPayment(tr.amount, tr.interestRate, tr.periodMonths), 0)
                  const active = activeRecommendation === idx
                  return (
                    <button
                      key={idx}
                      onClick={() => applyRecommendation(idx)}
                      className="crm-btn"
                      style={{ textAlign: 'right', padding: 12, borderRadius: 12, cursor: 'pointer', border: `2px solid ${active ? t.primary : t.border}`, background: active ? t.successBg : t.bg, fontFamily: 'Heebo,sans-serif' }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{rec.name}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: t.primary }}>{formatCurrency(Math.round(monthly))}/חודש</p>
                      <p style={{ fontSize: 11, marginTop: 4, color: t.textMuted }}>{rec.tracks.length} מסלולים</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Amortization chart */}
            <div style={{ ...card, padding: '22px 24px', animation: 'fadeUp 0.4s ease 0.35s backwards' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text }}>גרף החזרים לאורך זמן</h3>
                <button
                  onClick={() => setShowAmortization(!showAmortization)}
                  style={{ fontSize: 13, fontWeight: 500, textDecoration: 'underline', color: t.primary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Heebo,sans-serif' }}
                >
                  {showAmortization ? 'הסתר' : 'הצג'} לוח סילוקין
                </button>
              </div>
              {showAmortization && amortizationData.length > 0 && (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={amortizationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.borderLight} />
                    <XAxis dataKey="year" label={{ value: 'שנה', position: 'bottom' }} tick={{ fontSize: 11, fill: t.textMuted }} />
                    <YAxis tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: t.textMuted }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) => formatCurrency(v as number)}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${t.border}`, fontSize: 12, background: t.cardBg }}
                    />
                    <Bar dataKey="principal" name="קרן"   fill={t.primary} stackId="a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="interest"  name="ריבית" fill={t.accent} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {!showAmortization && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, fontSize: 13, color: t.textMuted }}>
                  לחץ "הצג לוח סילוקין" כדי לראות את הגרף
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <SaveMortgageDialog
        open={saveDialogOpen}
        onClose={() => { if (!savingMix) setSaveDialogOpen(false) }}
        onSubmit={handleSaveSubmit}
        defaultCustomerId={urlCustomerId}
        saving={savingMix}
        title="שמור תמהיל ללקוח"
      />
    </div>
  )
}
