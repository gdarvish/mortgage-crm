import { useState, useMemo, useRef, useEffect } from 'react'
import { RefreshCw, Plus, Trash2, TrendingDown, Upload, Loader2, CheckCircle, X } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { calculateMonthlyPayment, calculateRefinanceSavings, estimatePrepaymentFee, type TrackInput } from '@/utils/mortgageCalculations'
import { customerService } from '@/services/customerService'
import { regulatoryService } from '@/services/regulatoryService'
import { FALLBACK_REGULATORY_PARAMS, type RegulatoryParams } from '@/utils/regulatoryParams'
import { documentService } from '@/services/documentService'
import { toast } from '@/components/ui'
import type { LoanTrackType, Customer } from '@/types/database'

const trackTypes: { value: LoanTrackType; label: string }[] = [
  { value: 'פריים',           label: 'פריים' },
  { value: 'קל"צ',            label: 'קבועה לא צמודה' },
  { value: 'קל"ב',            label: 'קבועה צמודה' },
  { value: 'משתנה_צמודה',     label: 'משתנה צמודה' },
  { value: 'משתנה_לא_צמודה', label: 'משתנה לא צמודה' },
  { value: 'זכאות',           label: 'זכאות' },
]

const cardStyle = {
  background: 'var(--color-card)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border)',
  padding: '20px 22px',
}

const inputCls = 'w-full px-2 py-1.5 text-[13px] outline-none'
const inputSt = { border: '1.5px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', background: 'var(--color-card)' }

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

  // Prepayment (capitalization) fee estimator
  const [feeTrackType, setFeeTrackType] = useState<LoanTrackType>('קל"צ')
  const [feeBalance, setFeeBalance] = useState(500000)
  const [feeContractRate, setFeeContractRate] = useState(5.0)
  const [feeAvgRate, setFeeAvgRate] = useState(3.5)
  const [feeRemainingMonths, setFeeRemainingMonths] = useState(120)
  const [feeYearsSinceStart, setFeeYearsSinceStart] = useState(4)
  const [feeEarlyNotice, setFeeEarlyNotice] = useState(false)
  const [feeAtExitStation, setFeeAtExitStation] = useState(false)
  // The seniority and early-notice discounts are regulatory, not code.
  const [regParams, setRegParams] = useState<RegulatoryParams>(FALLBACK_REGULATORY_PARAMS)

  useEffect(() => { regulatoryService.getInForceAt().then(setRegParams) }, [])

  // פריים never carries a capitalization fee, and a variable track repaid at an
  // exit station is exempt — both are decided inside estimatePrepaymentFee.
  const feeExempt = feeTrackType === 'פריים' || feeAtExitStation

  const prepaymentFee = useMemo(() => estimatePrepaymentFee({
    trackType: feeTrackType,
    balance: feeBalance,
    contractRate: feeContractRate,
    avgRate: feeAvgRate,
    remainingMonths: feeRemainingMonths,
    yearsSinceStart: feeYearsSinceStart,
    earlyNoticeGiven: feeEarlyNotice,
    atExitStation: feeAtExitStation,
  }, regParams), [feeTrackType, feeBalance, feeContractRate, feeAvgRate, feeRemainingMonths,
       feeYearsSinceStart, feeEarlyNotice, feeAtExitStation, regParams])

  // Balance report upload state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadCustomers, setUploadCustomers] = useState<Customer[]>([])
  const [selectedUploadCustomer, setSelectedUploadCustomer] = useState('')
  const [uploadingReport, setUploadingReport] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const reportFileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const openUploadModal = async () => {
    setShowUploadModal(true)
    setUploadSuccess('')
    setSelectedUploadCustomer('')
    setPendingFile(null)
    if (uploadCustomers.length === 0) {
      setLoadingCustomers(true)
      const { data } = await customerService.getAll()
      if (data) setUploadCustomers(data)
      setLoadingCustomers(false)
    }
  }

  const handleReportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPendingFile(file)
  }

  const handleUploadReport = async () => {
    if (!pendingFile || !selectedUploadCustomer) return
    setUploadingReport(true)
    const { error } = await documentService.upload(selectedUploadCustomer, pendingFile, 'דוח יתרות', 'נכס')
    setUploadingReport(false)
    if (error) {
      toast.error('שגיאה בהעלאה', error.message)
    } else {
      const cust = uploadCustomers.find(c => c.id === selectedUploadCustomer)
      setUploadSuccess(`הדוח הועלה בהצלחה לתיק ${cust?.first_name ?? ''} ${cust?.last_name ?? ''}`)
      setPendingFile(null)
    }
  }

  const savings = useMemo(() =>
    calculateRefinanceSavings(existingTracks, newTracks, earlyRepaymentFee),
    [existingTracks, newTracks, earlyRepaymentFee]
  )

  const cumulativeSavings = useMemo(() => {
    const data = []
    let cumulative = -earlyRepaymentFee
    for (let month = 1; month <= 240; month++) {
      cumulative += savings.monthlySaving
      if (month % 6 === 0) data.push({ month, saving: Math.round(cumulative) })
    }
    return data
  }, [savings, earlyRepaymentFee])

  const updateTrack = (tracks: TrackInput[], setTracks: (t: TrackInput[]) => void, idx: number, field: keyof TrackInput, value: number | string) => {
    setTracks(tracks.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const renderTrackEditor = (tracks: TrackInput[], setTracks: (t: TrackInput[]) => void, title: string) => (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold" style={{ color: 'var(--color-text)' }}>{title}</h2>
        <button
          onClick={() => setTracks([...tracks, { type: 'קל"צ', amount: 0, interestRate: 4.0, periodMonths: 240 }])}
          className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 text-white transition-all hover:opacity-90"
          style={{ borderRadius: 10, background: 'var(--color-primary)' }}
        >
          <Plus size={13} /> הוסף
        </button>
      </div>
      <div className="space-y-2">
        {tracks.map((track, idx) => (
          <div key={idx} className="grid gap-2 items-end p-3 rounded-xl" style={{ background: 'var(--color-bg)', gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto' }}>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>סוג</label>
              <select value={track.type} onChange={e => updateTrack(tracks, setTracks, idx, 'type', e.target.value)} className={inputCls} style={inputSt}>
                {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>יתרה</label>
              <input type="number" value={track.amount} onChange={e => updateTrack(tracks, setTracks, idx, 'amount', +e.target.value)} className={inputCls} style={inputSt} dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>ריבית %</label>
              <input type="number" step="0.1" value={track.interestRate} onChange={e => updateTrack(tracks, setTracks, idx, 'interestRate', +e.target.value)} className={inputCls} style={inputSt} dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>חודשים</label>
              <input type="number" value={track.periodMonths} onChange={e => updateTrack(tracks, setTracks, idx, 'periodMonths', +e.target.value)} className={inputCls} style={inputSt} dir="ltr" />
            </div>
            <div className="flex items-center gap-1.5 pb-0.5">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(calculateMonthlyPayment(track.amount, track.interestRate, track.periodMonths))}</span>
              <button onClick={() => setTracks(tracks.filter((_, i) => i !== idx))} style={{ color: 'var(--color-danger)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[13px] font-bold" style={{ color: 'var(--color-primary)' }}>
        סה"כ: {formatCurrency(tracks.reduce((s, t) => s + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0))}/חודש
      </div>
    </div>
  )

  return (
    <div className="crm-page animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: 'var(--color-text)', fontFamily: 'var(--font-heebo)' }}>
            <RefreshCw size={22} style={{ color: 'var(--color-primary)' }} />
            מחשבון מחזור משכנתא
          </h1>
        </div>
        <button
          onClick={openUploadModal}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold transition-all hover:opacity-90 shrink-0"
          style={{ borderRadius: 12, background: 'var(--color-border-light)', color: 'var(--color-text-sub)', border: '1.5px solid var(--color-border)' }}
        >
          <Upload size={14} />
          העלה PDF דוח יתרות
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {renderTrackEditor(existingTracks, setExistingTracks, 'תמהיל קיים')}
        {renderTrackEditor(newTracks, setNewTracks, 'תמהיל מוצע')}
      </div>

      <div style={{ ...cardStyle }}>
        <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>עמלת פירעון מוקדם</label>
        <input
          type="number"
          value={earlyRepaymentFee}
          onChange={e => setEarlyRepaymentFee(+e.target.value)}
          className="px-3 py-2 outline-none text-[14px]"
          style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, width: 180, color: 'var(--color-text)' }}
          dir="ltr"
        />
      </div>

      {/* Prepayment fee estimator */}
      <div style={cardStyle}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>הערכת עמלת פירעון מוקדם (עמלת היוון)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>סוג מסלול</label>
            <select value={feeTrackType} onChange={e => setFeeTrackType(e.target.value as LoanTrackType)} className={inputCls} style={inputSt}>
              {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>יתרת המסלול</label>
            <input type="number" value={feeBalance} onChange={e => setFeeBalance(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>ריבית החוזה %</label>
            <input type="number" step="0.1" value={feeContractRate} onChange={e => setFeeContractRate(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }} title="לפי פרסום בנק ישראל לתקופה הממוצעת הנותרת">הריבית הממוצעת (בנק ישראל) %</label>
            <input type="number" step="0.1" value={feeAvgRate} onChange={e => setFeeAvgRate(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>חודשים שנותרו</label>
            <input type="number" value={feeRemainingMonths} onChange={e => setFeeRemainingMonths(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>ותק המסלול (שנים)</label>
            <input type="number" value={feeYearsSinceStart} onChange={e => setFeeYearsSinceStart(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] pb-1.5" style={{ color: 'var(--color-text-sub)' }}>
              <input
                type="checkbox"
                checked={feeEarlyNotice}
                onChange={e => setFeeEarlyNotice(e.target.checked)}
                disabled={feeTrackType === 'פריים'}
              />
              ניתנה הודעה מוקדמת
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] pb-1.5" style={{ color: 'var(--color-text-sub)' }}>
              <input
                type="checkbox"
                checked={feeAtExitStation}
                onChange={e => setFeeAtExitStation(e.target.checked)}
                disabled={feeTrackType === 'פריים'}
              />
              פירעון בתחנת יציאה
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 flex-wrap">
          {!feeExempt ? (
            <>
              <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--color-border-light)' }}>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>עמלת היוון</p>
                <p className="text-[16px] font-black tabular-nums" style={{ color: 'var(--color-text-sub)' }}>{formatCurrency(prepaymentFee.capitalizationFee)}</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--color-success-bg)' }}>
                <p className="text-[11px]" style={{ color: '#065f46' }}>הנחות{feeEarlyNotice ? ' (ותק + הודעה מוקדמת)' : ' (ותק)'}</p>
                <p className="text-[16px] font-black tabular-nums" style={{ color: 'var(--color-primary)' }}>−{formatCurrency(prepaymentFee.discount)}</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--color-primary)' }}>
                <p className="text-[11px]" style={{ color: 'var(--color-success-bg)' }}>עמלה משוערת</p>
                <p className="text-[18px] font-black tabular-nums text-white">{formatCurrency(prepaymentFee.finalFee)}</p>
              </div>
              <button
                onClick={() => setEarlyRepaymentFee(prepaymentFee.finalFee)}
                className="px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-90"
                style={{ borderRadius: 12, background: '#057857' }}
              >
                החל על עמלת הפירעון
              </button>
            </>
          ) : (
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--color-success-bg)' }}>
              <p className="text-[16px] font-black" style={{ color: 'var(--color-primary)' }}>
                {feeTrackType === 'פריים'
                  ? '0 ₪ — מסלול פריים אינו נושא עמלת היוון'
                  : '0 ₪ — פירעון בתחנת יציאה פטור מעמלת היוון'}
              </p>
            </div>
          )}
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
          הערכה בלבד — העמלה הסופית נקבעת ע"י הבנק ביום הפירעון.
        </p>
      </div>

      {/* Comparison */}
      <div style={cardStyle}>
        <h2 className="text-[15px] font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <TrendingDown size={16} style={{ color: 'var(--color-primary)' }} />
          השוואה
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'החזר נוכחי',  value: formatCurrency(savings.existingMonthly), color: 'var(--color-text-sub)', bg: 'var(--color-border-light)' },
            { label: 'החזר חדש',    value: formatCurrency(savings.newMonthly),      color: 'var(--color-primary)', bg: 'var(--color-success-bg)' },
            { label: 'חיסכון חודשי', value: formatCurrency(savings.monthlySaving),  color: 'var(--color-primary)', bg: 'var(--color-success-bg)' },
            { label: 'חיסכון כולל', value: formatCurrency(savings.totalSaving),    color: 'var(--color-primary)', bg: 'var(--color-success-bg)' },
          ].map(c => (
            <div key={c.label} className="text-center p-4 rounded-xl" style={{ background: c.bg }}>
              <p className="text-[12px] mb-1" style={{ color: 'var(--color-text-muted)' }}>{c.label}</p>
              <p className="text-[18px] font-black tabular-nums" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 flex-wrap text-[13px]" style={{ color: 'var(--color-text-sub)' }}>
          <span>עמלת פירעון: {formatCurrency(earlyRepaymentFee)}</span>
          <span>Break-Even: {savings.breakEvenMonths === Infinity ? 'לא רלוונטי' : `${savings.breakEvenMonths} חודשים`}</span>
          <span
            className="font-bold px-3 py-1 rounded-full"
            style={savings.isWorthIt
              ? { background: '#d1fae5', color: '#065f46' }
              : { background: '#fee2e2', color: '#dc2626' }}
          >
            {savings.savingType === 'monthly'
              ? `✅ כדאי — חיסכון של ${formatCurrency(savings.monthlySaving)} בחודש, החזר ההשקעה תוך ${savings.breakEvenMonths} חודשים`
              : savings.savingType === 'term'
                ? `✅ כדאי — ההחזר החודשי עולה ב-${formatCurrency(Math.abs(savings.monthlySaving))} אך העלות הכוללת קטנה ב-${formatCurrency(savings.totalSaving)} (קיצור תקופה)`
                : '❌ לא כדאי כרגע'}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={cardStyle}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text)' }}>חיסכון מצטבר</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={cumulativeSavings}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f4f2" />
            <XAxis dataKey="month" label={{ value: 'חודש', position: 'bottom' }} tick={{ fontSize: 11, fill: '#a8a29e' }} />
            <YAxis tickFormatter={v => `₪${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: '#a8a29e' }} />
            <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 10, border: '1px solid #e7e5e4', fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="saving" stroke="#059669" strokeWidth={2} name="חיסכון מצטבר" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(28,25,23,0.5)' }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="w-full max-w-md animate-fade-in"
            style={{ background: 'var(--color-card)', borderRadius: 20, border: '1px solid var(--color-border)', padding: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-bold" style={{ color: 'var(--color-text)' }}>העלאת דוח יתרות</h2>
              <button onClick={() => setShowUploadModal(false)} style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>

            {uploadSuccess ? (
              <div className="text-center py-6">
                <CheckCircle size={40} style={{ color: 'var(--color-primary)', margin: '0 auto 12px' }} />
                <p className="text-[14px] font-semibold" style={{ color: 'var(--color-primary)' }}>{uploadSuccess}</p>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="mt-4 px-6 py-2 text-[13px] font-semibold text-white"
                  style={{ borderRadius: 12, background: 'var(--color-primary)' }}
                >סגור</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>לקוח</label>
                  {loadingCustomers ? (
                    <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--color-text-muted)' }}><Loader2 size={14} className="animate-spin" /> טוען...</div>
                  ) : (
                    <select
                      value={selectedUploadCustomer}
                      onChange={e => setSelectedUploadCustomer(e.target.value)}
                      className="w-full px-3 py-2 outline-none text-[13px]"
                      style={{ border: '1.5px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)' }}
                    >
                      <option value="">בחר לקוח...</option>
                      {uploadCustomers.map(c => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>קובץ PDF</label>
                  <input ref={reportFileRef} type="file" accept=".pdf,image/*" hidden onChange={handleReportFile} />
                  <div
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-[var(--color-primary)]"
                    style={{ borderColor: pendingFile ? 'var(--color-primary)' : 'var(--color-border)', background: pendingFile ? 'var(--color-success-bg)20' : 'var(--color-bg)' }}
                    onClick={() => reportFileRef.current?.click()}
                  >
                    {pendingFile ? (
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--color-primary)' }}>{pendingFile.name}</p>
                    ) : (
                      <>
                        <Upload size={24} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
                        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>לחץ לבחירת קובץ PDF</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleUploadReport}
                    disabled={uploadingReport || !pendingFile || !selectedUploadCustomer}
                    className="flex-1 py-2.5 text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ borderRadius: 12, background: 'var(--color-primary)' }}
                  >
                    {uploadingReport ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    העלה לתיק לקוח
                  </button>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80"
                    style={{ borderRadius: 12, background: 'var(--color-border-light)', color: 'var(--color-text-sub)' }}
                  >ביטול</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
