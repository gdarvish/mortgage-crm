import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Sparkles, AlertTriangle, CheckCircle, Download, Save, X, Loader2, ArrowRight } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import {
  calculateMonthlyPayment,
  calculateAmortizationSchedule,
  generateRecommendedMixes,
  calculateGracePayments,
  effectiveMonthlyPayment,
  formatCheckValue,
  checkBarWidth,
  isCpiLinked,
  mixMonthlyPaymentAfterYears,
  mixTotalCostWithCpi,
  type TrackInput,
  type GraceType,
  type LiveRates,
  type DtiLimits,
} from '@/utils/mortgageCalculations'
import { evaluateMix } from '@/utils/caseEvaluation'
import type {
  LoanTrackType, Mortgage, MortgageVersionSnapshot, PropertyType,
} from '@/types/database'
import { db, functions } from '@/lib/firebase'
import { settingsService } from '@/services/settingsService'
import { mortgageService } from '@/services/mortgageService'
import { regulatoryService } from '@/services/regulatoryService'
import { useCaseSnapshot } from '@/hooks/queries/useCaseSnapshot'
import { FALLBACK_REGULATORY_PARAMS, type RegulatoryParams } from '@/utils/regulatoryParams'
import { toast, ConfirmDialog } from '@/components/ui'

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
      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em' }}>
        {label}
      </label>
      <div
        className="flex items-center overflow-hidden transition-all duration-150"
        style={{
          border: `1.5px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 10,
          background: readOnly ? 'var(--color-bg)' : 'var(--color-card)',
          boxShadow: focused ? '0 0 0 3px rgba(5,150,105,0.12)' : 'none',
        }}
      >
        {prefix && (
          <span className="px-3 text-[14px] font-semibold shrink-0" style={{ color: 'var(--color-text-muted)' }}>{prefix}</span>
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
            color: readOnly ? 'var(--color-text-sub)' : 'var(--color-text)',
            paddingRight: prefix ? 4 : 12,
            paddingLeft: suffix ? 4 : 12,
            fontFamily: 'var(--font-heebo)',
          }}
          dir="ltr"
        />
        {suffix && (
          <span className="px-3 text-[13px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>{suffix}</span>
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
  const [monthlyObligations, setMonthlyObligations] = useState(0)
  const [expectedCpi, setExpectedCpi] = useState(2.5)
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
  // Term used to build the recommended mixes — 300 months was hard-coded.
  const [recommendationMonths, setRecommendationMonths] = useState(300)

  // ── Case context (PR-A) ───────────────────────────────────────────────────
  // The calculator is reachable both standalone and from inside a case. With
  // ?customerId (and optionally ?mortgageId) it seeds itself from the case and
  // can write the mix back; without them it stays a scratch calculator.
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerId = searchParams.get('customerId')
  const mortgageId = searchParams.get('mortgageId')
  // The case's own numbers come from the shared snapshot, so the calculator
  // cannot disagree with the case file about income, obligations, the
  // appraisal or the rules in force. Only the mix being edited is local.
  const { data: snapshot, isLoading: caseLoading, isError: caseError } = useCaseSnapshot(
    customerId ?? undefined,
  )
  const [obligationsEditedManually, setObligationsEditedManually] = useState(false)
  const [dtiLimits, setDtiLimits] = useState<DtiLimits | undefined>(undefined)
  const [savingMix, setSavingMix] = useState(false)
  const [mismatchConfirm, setMismatchConfirm] = useState(false)
  // Saving an edited mix as a new version keeps the one the client already saw.
  const [saveAsNewVersion, setSaveAsNewVersion] = useState(false)
  const [versionLabel, setVersionLabel] = useState('')
  const [seededFor, setSeededFor] = useState<string | null>(null)

  const caseName = snapshot ? `${snapshot.customer.first_name} ${snapshot.customer.last_name}` : null
  const obligationCount = snapshot?.obligations.length ?? 0
  const appraisedValue = snapshot?.appraisal?.appraised_value ?? null
  const borrowerBirthDates = useMemo(
    () => (snapshot?.borrowers ?? []).map(b => b.birth_date),
    [snapshot],
  )

  // Standalone calculator: no case to date the rules from, so use today's.
  const [standaloneParams, setStandaloneParams] = useState<RegulatoryParams>(FALLBACK_REGULATORY_PARAMS)
  useEffect(() => {
    if (customerId) return
    regulatoryService.getInForceAt().then(setStandaloneParams)
  }, [customerId])
  const regParams = snapshot?.params ?? standaloneParams

  useEffect(() => {
    if (caseError) toast.error('שגיאה בטעינת התיק')
  }, [caseError])

  // Seed the editable fields from the case once, so a background refetch does
  // not overwrite a mix the advisor is in the middle of building.
  useEffect(() => {
    if (!snapshot || !customerId) return
    const seedKey = `${customerId}:${mortgageId ?? ''}`
    if (seededFor === seedKey) return
    setSeededFor(seedKey)

    const mortgage = mortgageId
      ? snapshot.mortgages.find(m => m.id === mortgageId) ?? null
      : null

    setPropertyPrice(mortgage?.property_price ?? snapshot.customer.requested_amount ?? 0)
    setOwnCapital(mortgage?.own_capital ?? snapshot.customer.own_capital ?? 0)
    if (mortgage?.property_type) setPropertyType(mortgage.property_type)
    setMonthlyIncome(snapshot.householdIncome)
    setMonthlyObligations(snapshot.monthlyObligations)

    const existingTracks = (mortgage?.loan_tracks ?? []).filter(t => !t.is_existing)
    if (existingTracks.length > 0) {
      setTracks(existingTracks.map(t => ({
        type: t.type,
        amount: t.amount ?? 0,
        interestRate: t.interest_rate ?? 0,
        periodMonths: t.period_months ?? 0,
      })))
    }
  }, [snapshot, customerId, mortgageId, seededFor])

  useEffect(() => {
    // קל"צ = קבועה לא צמודה, קל"ב = קבועה צמודה. The two were mapped the other
    // way round, which priced every recommended mix backwards.
    const rateMap: Record<string, keyof LiveRates> = {
      'קל"צ': 'fixed_kalatz',
      'קל"ב': 'fixed_kalab',
      'משתנה_צמודה': 'variable_linked',
      'זכאות': 'eligibility',
      'פריים': 'prime',
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
    settingsService.get().then(({ data }) => {
      if (typeof data?.expected_annual_cpi === 'number') setExpectedCpi(data.expected_annual_cpi)
      // Only an explicit advisor setting overrides the regulator's thresholds;
      // otherwise checkCompliance takes them from the parameters.
      if (typeof data?.dti_warn_threshold === 'number' && typeof data?.dti_hard_threshold === 'number') {
        setDtiLimits({ warn: data.dti_warn_threshold, hard: data.dti_hard_threshold })
      }
    })
  }, [])

  const loanAmount  = Math.max(0, propertyPrice - ownCapital)
  const ltv         = propertyPrice > 0 ? Math.round((loanAmount / propertyPrice) * 100) : 0
  const ltvColor    = ltv > 75 ? '#dc2626' : ltv > 60 ? '#d97706' : '#059669'
  const tracksTotal = tracks.reduce((s, t) => s + t.amount, 0)

  const totalMonthlyPayment = useMemo(() =>
    tracks.reduce((sum, t) => sum + effectiveMonthlyPayment(t), 0),
    [tracks]
  )

  const hasLinkedTracks = useMemo(() => tracks.some(t => isCpiLinked(t.type)), [tracks])
  const payment5yr = useMemo(() => mixMonthlyPaymentAfterYears(tracks, expectedCpi, 5), [tracks, expectedCpi])
  const payment10yr = useMemo(() => mixMonthlyPaymentAfterYears(tracks, expectedCpi, 10), [tracks, expectedCpi])
  const totalCostWithCpi = useMemo(() => mixTotalCostWithCpi(tracks, expectedCpi), [tracks, expectedCpi])

  // The draft mix is judged by the same function the case snapshot uses, so
  // the calculator and the case file can only disagree about a mix if they
  // were handed different mixes — never because they score them differently.
  const evaluation = useMemo(() => evaluateMix(tracks, {
    purchasePrice: propertyPrice,
    propertyType,
    appraisedValue,
    householdIncome: monthlyIncome,
    monthlyObligations,
    borrowerBirthDates,
    dtiLimits,
    params: regParams,
  }), [tracks, propertyPrice, propertyType, monthlyIncome, monthlyObligations,
       appraisedValue, borrowerBirthDates, dtiLimits, regParams])

  const compliance = evaluation.compliance
  const extraEquityNeeded = evaluation.additionalEquityRequired
  const totalCost = evaluation.totalCost

  const recommendations = useMemo(() =>
    generateRecommendedMixes(loanAmount, recommendationMonths, liveRates?.prime ?? 6.0, liveRates),
    [loanAmount, recommendationMonths, liveRates]
  )

  // The schedule covers the whole mix, not just tracks[0]: a three-track mix
  // was charted as though only the first track existed.
  const amortizationData = useMemo(() => {
    if (!showAmortization || tracks.length === 0) return []
    const schedules = tracks.map(t =>
      calculateAmortizationSchedule(t.amount, t.interestRate, t.periodMonths)
    )
    const maxMonths = Math.max(...tracks.map(t => t.periodMonths))
    const merged = Array.from({ length: maxMonths }, (_, i) => ({
      month: i + 1,
      payment: schedules.reduce((s, sch) => s + (sch[i]?.payment ?? 0), 0),
      principal: schedules.reduce((s, sch) => s + (sch[i]?.principal ?? 0), 0),
      interest: schedules.reduce((s, sch) => s + (sch[i]?.interest ?? 0), 0),
      balance: schedules.reduce((s, sch) => s + (sch[i]?.balance ?? 0), 0),
    }))
    return merged.filter((_, i) => i % 12 === 0).map(row => ({
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
          unit: c.unit,
        })),
      })
    } catch (e) {
      console.error('PDF export failed', e)
    } finally {
      setGeneratingPdf(false)
    }
  }

  // Writing the mix back to the case: upsert the mortgage, then replace its
  // track set atomically so a re-save edits the mix rather than duplicating it.
  /** The tracks in the shape loan_tracks stores them. */
  const trackRecords = () => tracks.map(t => ({
    type: t.type,
    amount: t.amount,
    interest_rate: t.interestRate,
    period_months: t.periodMonths,
    monthly_payment: Math.round(effectiveMonthlyPayment(t)),
    is_existing: false,
    start_date: null,
    end_date: null,
  }))

  /** The numbers frozen onto a version at the moment it is saved. */
  const versionSnapshot = (): MortgageVersionSnapshot => ({
    dti: evaluation.dti,
    ltv: evaluation.ltv,
    monthly_payment: evaluation.monthlyPayment,
    total_cost: evaluation.totalCost,
    compliance: compliance as unknown as MortgageVersionSnapshot['compliance'],
  })

  const persistMix = async () => {
    if (!customerId) return
    setSavingMix(true)
    try {
      // Editing an existing version updates it in place; anything else — a new
      // mix, or "save as a new version" — appends to the case's history rather
      // than overwriting what was already shown to the client.
      if (mortgageId && !saveAsNewVersion) {
        const { data: mortgage, error } = await mortgageService.update(mortgageId, {
          property_price: propertyPrice,
          property_type: propertyType,
          own_capital: ownCapital,
          loan_amount: tracksTotal,
          compliance_status: compliance as unknown as Mortgage['compliance_status'],
          snapshot: versionSnapshot(),
          ...(versionLabel.trim() ? { version_label: versionLabel.trim() } : {}),
        })
        if (error || !mortgage) throw new Error(error?.message ?? 'שמירה נכשלה')
        const { error: tracksError } = await mortgageService.replaceTracks(mortgage.id, trackRecords())
        if (tracksError) throw new Error(tracksError.message)
        toast.success('התמהיל עודכן בתיק הלקוח')
      } else {
        const parent = mortgageId
          ? snapshot?.mortgages.find(m => m.id === mortgageId) ?? null
          : null
        const { data, error } = await mortgageService.createVersion({
          customerId,
          parent,
          label: versionLabel.trim() || null,
          source: 'advisor',
          propertyPrice,
          propertyType,
          ownCapital,
          loanAmount: tracksTotal,
          snapshot: versionSnapshot(),
          tracks: trackRecords(),
        })
        if (error || !data) throw new Error(error?.message ?? 'שמירה נכשלה')
        toast.success(
          parent ? `נשמרה גרסה ${data.version} בתיק הלקוח` : 'התמהיל נשמר בתיק הלקוח',
        )
      }

      navigate(`/customers/${customerId}`)
    } catch (e) {
      toast.error('שגיאה בשמירת התמהיל', e instanceof Error ? e.message : undefined)
    } finally {
      setSavingMix(false)
    }
  }

  const handleSaveMix = () => {
    if (!customerId) return
    if (tracks.length === 0) {
      toast.error('אין מסלולים לשמירה')
      return
    }
    // A mix that does not add up to the loan is usually a half-finished edit,
    // but it is a legitimate what-if too — so confirm rather than block.
    if (Math.abs(tracksTotal - loanAmount) > 1000) {
      setMismatchConfirm(true)
      return
    }
    void persistMix()
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
    background: 'var(--color-card)',
    borderRadius: 20,
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
  }

  return (
    <div className="crm-page animate-fade-in">
      {/* Case banner — only when the calculator was opened from a case */}
      {customerId && (
        <div
          className="mb-4 flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14 }}
        >
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-primary-hover)' }}>
            {caseLoading
              ? 'טוען את התיק...'
              : `בונה תמהיל עבור ${caseName ?? 'הלקוח'}${mortgageId ? ' — עריכת תמהיל קיים' : ''}`}
          </p>
          <button
            onClick={() => navigate(`/customers/${customerId}`)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold hover:opacity-80 transition-opacity shrink-0"
            style={{ color: 'var(--color-primary-hover)' }}
          >
            <ArrowRight size={14} />
            חזרה לתיק
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-black" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>
          מחשבון משכנתא
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>חשב תשלום חודשי לפי מסלולים</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Property inputs */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>נתוני הנכס</h3>
            <div className="flex flex-col gap-3">
              <InputField label="מחיר הנכס" value={propertyPrice} onChange={v => setPropertyPrice(Number(v) || 0)} prefix="₪" />
              <InputField label="הון עצמי" value={ownCapital} onChange={v => setOwnCapital(Number(v) || 0)} prefix="₪" />

              <div className="grid grid-cols-2 gap-3">
                <InputField label="סכום הלוואה" value={formatCurrency(loanAmount)} readOnly />
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em' }}>LTV</label>
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
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em' }}>סוג נכס</label>
                  <select
                    value={propertyType}
                    onChange={e => setPropertyType(e.target.value as PropertyType)}
                    className="w-full py-2.5 px-3 text-[14px] outline-none transition-all duration-150"
                    style={{
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 10,
                      background: 'var(--color-card)',
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-heebo)',
                    }}
                  >
                    {propertyTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <InputField label="הכנסה חודשית נטו" value={monthlyIncome} onChange={v => setMonthlyIncome(Number(v) || 0)} prefix="₪" />
                <InputField
                label="התחייבויות חודשיות"
                value={monthlyObligations}
                onChange={v => {
                  setMonthlyObligations(Number(v) || 0)
                  if (obligationCount > 0) setObligationsEditedManually(true)
                }}
                prefix="₪"
              />
                <InputField label="הנחת מדד שנתי" value={expectedCpi} onChange={v => setExpectedCpi(Number(v) || 0)} suffix="%" />
              </div>
              {obligationCount > 0 ? (
                <p className="mt-2 text-[12px] flex flex-wrap items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span>מקור: {obligationCount} התחייבויות מהתיק</span>
                  {obligationsEditedManually && (
                    <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>· שונה ידנית</span>
                  )}
                  <button
                    onClick={() => navigate(`/customers/${customerId}`)}
                    className="font-semibold hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    ערוך בתיק
                  </button>
                </p>
              ) : monthlyObligations > 0 && (
                <p className="mt-2 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                  התחייבויות חודשיות: {formatCurrency(monthlyObligations)} — נכללות ביחס ההחזר
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>סיכום</h3>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
              {[
                { label: 'תשלום חודשי', value: formatCurrency(Math.round(totalMonthlyPayment)), highlight: true },
                {
                  label: 'סה"כ מסלולים',
                  value: formatCurrency(tracksTotal),
                  note: tracksTotal !== loanAmount ? `פער: ${formatCurrency(Math.abs(loanAmount - tracksTotal))}` : null,
                },
                { label: 'עלות כוללת', value: formatCurrency(Math.round(totalCost)) },
                ...(appraisedValue && appraisedValue < propertyPrice ? [
                  { label: 'שווי לפי שמאות', value: formatCurrency(appraisedValue) },
                ] : []),
                ...(extraEquityNeeded > 0 ? [
                  { label: 'הון עצמי נוסף נדרש', value: formatCurrency(extraEquityNeeded), warn: true },
                ] : []),
                ...(hasLinkedTracks ? [
                  { label: 'החזר חודשי צפוי בעוד 5 שנים', value: formatCurrency(Math.round(payment5yr)) },
                  { label: 'החזר חודשי צפוי בעוד 10 שנים', value: formatCurrency(Math.round(payment10yr)) },
                  { label: 'עלות כוללת (כולל הצמדה צפויה)', value: formatCurrency(Math.round(totalCostWithCpi)) },
                ] : []),
              ].map((row: { label: string; value: string; highlight?: boolean; note?: string | null; warn?: boolean }) => (
                <div key={row.label} className="flex items-center justify-between py-3">
                  <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                  <div className="flex items-center gap-2">
                    {row.note && (
                      <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>{row.note}</span>
                    )}
                    <span
                      className="font-black tabular-nums"
                      style={{
                        fontSize: row.highlight ? 22 : 15,
                        color: row.highlight ? 'var(--color-primary)' : row.warn ? 'var(--color-accent)' : 'var(--color-text)',
                        fontFamily: 'var(--font-heebo)',
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {hasLinkedTracks && (
              <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
                תחזית לפי הנחת מדד {expectedCpi}% — אינה התחייבות.
              </p>
            )}
          </div>

          {/* Compliance */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              {compliance.isValid
                ? <CheckCircle size={16} style={{ color: 'var(--color-primary)' }} />
                : <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
              }
              בדיקת Compliance
            </h3>
            <div className="space-y-3">
              {compliance.checks.map((check, idx) => {
                // Green when clean; amber for a warning-severity breach (a case
                // to discuss); red only for a hard breach.
                const color = check.isValid ? '#059669' : check.severity === 'warning' ? '#d97706' : '#dc2626'
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span style={{ color: 'var(--color-text-sub)' }}>{check.name}</span>
                      <span className="font-semibold" style={{ color }}>{formatCheckValue(check)}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border-light)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${checkBarWidth(check)}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color }}>
                      {check.message}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ ...cardStyle, padding: '18px 24px' }} className="flex flex-col gap-2">
            <button
              onClick={handleAiAdvice}
              disabled={aiAdvising}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
              style={{ borderRadius: 12, background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
            >
              {aiAdvising ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {aiAdvising ? 'מנתח...' : 'המלצת AI לתמהיל'}
            </button>
            <button
              onClick={handleSaveMix}
              disabled={!customerId || savingMix || caseLoading}
              title={customerId ? undefined : 'פתח את המחשבון מתוך תיק לקוח כדי לשמור תמהיל'}
              className="crm-btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderRadius: 12, background: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 27%, transparent)' }}
            >
              {savingMix ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {savingMix
                ? 'שומר...'
                : mortgageId
                  ? (saveAsNewVersion ? 'שמור כגרסה חדשה' : 'עדכן תמהיל בתיק')
                  : 'שמור תמהיל ללקוח'}
            </button>
            {!customerId && (
              <p className="text-[11px] text-center" style={{ color: 'var(--color-text-muted)' }}>
                פתח את המחשבון מתוך תיק לקוח כדי לשמור תמהיל
              </p>
            )}
            {customerId && (
              <div className="flex flex-col gap-2 pt-1">
                <input
                  value={versionLabel}
                  onChange={e => setVersionLabel(e.target.value)}
                  placeholder='שם הגרסה — למשל "אחרי מו"מ מזרחי"'
                  className="w-full py-2 px-3 text-[13px] outline-none"
                  style={{
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 10,
                    background: 'var(--color-card)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heebo)',
                  }}
                />
                {mortgageId && (
                  <label className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--color-text-sub)' }}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={saveAsNewVersion}
                      onChange={e => setSaveAsNewVersion(e.target.checked)}
                    />
                    <span>
                      שמור כגרסה חדשה
                      <span className="block" style={{ color: 'var(--color-text-muted)' }}>
                        הגרסה הקיימת נשמרת כפי שהיא — כך אפשר להשוות בין הסבבים
                      </span>
                    </span>
                  </label>
                )}
              </div>
            )}
            <button
              onClick={handleExportPdf}
              disabled={generatingPdf}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80 disabled:opacity-50"
              style={{ borderRadius: 12, background: 'var(--color-border-light)', color: 'var(--color-text-sub)' }}
            >
              <Download size={15} />
              {generatingPdf ? 'מכין PDF...' : 'הורד PDF'}
            </button>
          </div>

          {/* AI advice */}
          {aiAdvice && (
            <div style={{ ...cardStyle, padding: '20px 24px' }}>
              <h3 className="text-[14px] font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Sparkles size={15} style={{ color: 'var(--color-accent)' }} />
                המלצת AI
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>רמת סיכון:</span>
                <span
                  className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
                >
                  {aiAdvice.risk_level}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-sub)' }}>{aiAdvice.rationale}</p>
            </div>
          )}

          {/* Sensitivity */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <h3 className="text-[14px] font-bold mb-3" style={{ color: 'var(--color-text)' }}>ניתוח רגישות</h3>
            <div className="space-y-2">
              {[0, 0.5, 1, 1.5, 2].map(delta => {
                const adjusted = tracks.reduce((sum, t) =>
                  sum + calculateMonthlyPayment(t.amount, t.interestRate + delta, t.periodMonths), 0
                )
                const isCurrent = delta === 0
                return (
                  <div key={delta} className="flex justify-between items-center text-[13px]">
                    <span style={{ color: 'var(--color-text-muted)' }}>{isCurrent ? 'נוכחי' : `+${delta}%`}</span>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--color-text)' }}
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
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>
              מסלולים ({tracks.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => applyRecommendation(1)}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold transition-all hover:opacity-80"
                style={{ borderRadius: 10, background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
              >
                <Sparkles size={13} />
                תמהילים מומלצים
              </button>
              <button
                onClick={addTrack}
                disabled={tracks.length >= 6}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ borderRadius: 10, background: 'var(--color-primary)', boxShadow: '0 3px 10px rgba(5,150,105,0.35)' }}
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
                      style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heebo)', border: 'none' }}
                    >
                      {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {isCpiLinked(track.type) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}>
                        צמוד מדד
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] px-2.5 py-1 rounded-full" style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                      {pct}% מהלוואה
                    </span>
                    <button
                      onClick={() => removeTrack(idx)}
                      aria-label="הסר מסלול"
                      className="transition-colors hover:text-red-500"
                      style={{ color: 'var(--color-text-muted)' }}
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
                      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.03em' }}>סוג גרייס</label>
                      <select
                        value={track.graceType ?? 'חלקי'}
                        onChange={e => updateTrack(idx, 'graceType', e.target.value as GraceType)}
                        className="w-full py-2.5 px-3 text-[14px] outline-none"
                        style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, background: 'var(--color-card)', color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}
                      >
                        <option value="חלקי">חלקי (ריבית בלבד)</option>
                        <option value="מלא">מלא (קרן + ריבית נדחים)</option>
                      </select>
                    </div>
                  )}
                </div>

                {hasGrace && gracePayments && (
                  <div className="mb-4 text-[12px] px-3 py-2 rounded-lg" style={{ background: 'var(--color-accent-bg)', color: '#b45309', border: '1px solid #fde68a' }}>
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
                  <span className="text-[13px]" style={{ color: 'var(--color-text-sub)' }}>תשלום חודשי</span>
                  <span className="font-black tabular-nums" style={{ fontSize: 18, color: col, fontFamily: 'var(--font-heebo)' }}>
                    {formatCurrency(Math.round(monthly))}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Recommendations */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[14px] font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Sparkles size={15} style={{ color: 'var(--color-accent)' }} />
                תמהילים מומלצים
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>תקופה</span>
                <select
                  value={recommendationMonths}
                  onChange={e => setRecommendationMonths(Number(e.target.value))}
                  className="py-1.5 px-2 text-[13px] outline-none"
                  style={{
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 8,
                    background: 'var(--color-card)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heebo)',
                  }}
                >
                  {[
                    { months: 240, label: '20 שנה' },
                    { months: 300, label: '25 שנה' },
                    { months: 360, label: '30 שנה' },
                  ].map(o => <option key={o.months} value={o.months}>{o.label}</option>)}
                </select>
              </div>
            </div>
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
                      border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'var(--color-success-bg)' : 'var(--color-bg)',
                    }}
                  >
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{rec.name}</p>
                    <p className="text-[13px] font-black mt-1" style={{ color: 'var(--color-primary)' }}>{formatCurrency(Math.round(monthly))}/חודש</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{rec.tracks.length} מסלולים</p>
                  </button>
                )
              })}
            </div>
            {(!liveRates || liveRates.prime == null) && (
              <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
                ריביות להמחשה בלבד — לא נטענו ריביות מערכת עדכניות לכל המסלולים (כולל פריים).
              </p>
            )}
          </div>

          {/* Amortization chart */}
          <div style={{ ...cardStyle, padding: '22px 24px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--color-text)' }}>גרף החזרים לאורך זמן</h3>
              <button
                onClick={() => setShowAmortization(!showAmortization)}
                className="text-[13px] font-medium underline transition-colors"
                style={{ color: 'var(--color-primary)' }}
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
              <div className="flex items-center justify-center h-16 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                לחץ "הצג לוח סילוקין" כדי לראות את הגרף
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={mismatchConfirm}
        title="סכום המסלולים אינו תואם"
        message={`סכום המסלולים שונה מסכום ההלוואה ב-${formatCurrency(Math.abs(tracksTotal - loanAmount))}. לשמור בכל זאת?`}
        confirmText="שמור בכל זאת"
        onConfirm={() => { setMismatchConfirm(false); void persistMix() }}
        onCancel={() => setMismatchConfirm(false)}
      />
    </div>
  )
}
