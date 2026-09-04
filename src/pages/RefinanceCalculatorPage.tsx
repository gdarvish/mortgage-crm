import { useState, useMemo, useRef } from 'react'
import { RefreshCw, Plus, Trash2, TrendingDown, Upload, Loader2, CheckCircle, X } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { calculateMonthlyPayment, calculateRefinanceSavings, estimatePrepaymentFee, type TrackInput } from '@/utils/mortgageCalculations'
import { customerService } from '@/services/customerService'
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
  background: '#ffffff',
  borderRadius: 20,
  boxShadow: '0 1px 4px rgba(28,25,23,0.06), 0 6px 20px rgba(28,25,23,0.07)',
  border: '1px solid #e7e5e4',
  padding: '20px 22px',
}

const inputCls = 'w-full px-2 py-1.5 text-[13px] outline-none'
const inputSt = { border: '1.5px solid #e7e5e4', borderRadius: 8, color: '#1c1917', background: '#fff' }

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
  }), [feeTrackType, feeBalance, feeContractRate, feeAvgRate, feeRemainingMonths,
       feeYearsSinceStart, feeEarlyNotice, feeAtExitStation])

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
        <h2 className="text-[15px] font-bold" style={{ color: '#1c1917' }}>{title}</h2>
        <button
          onClick={() => setTracks([...tracks, { type: 'קל"צ', amount: 0, interestRate: 4.0, periodMonths: 240 }])}
          className="flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 text-white transition-all hover:opacity-90"
          style={{ borderRadius: 10, background: '#059669' }}
        >
          <Plus size={13} /> הוסף
        </button>
      </div>
      <div className="space-y-2">
        {tracks.map((track, idx) => (
          <div key={idx} className="grid gap-2 items-end p-3 rounded-xl" style={{ background: '#faf9f7', gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto' }}>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>סוג</label>
              <select value={track.type} onChange={e => updateTrack(tracks, setTracks, idx, 'type', e.target.value)} className={inputCls} style={inputSt}>
                {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>יתרה</label>
              <input type="number" value={track.amount} onChange={e => updateTrack(tracks, setTracks, idx, 'amount', +e.target.value)} className={inputCls} style={inputSt} dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>ריבית %</label>
              <input type="number" step="0.1" value={track.interestRate} onChange={e => updateTrack(tracks, setTracks, idx, 'interestRate', +e.target.value)} className={inputCls} style={inputSt} dir="ltr" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>חודשים</label>
              <input type="number" value={track.periodMonths} onChange={e => updateTrack(tracks, setTracks, idx, 'periodMonths', +e.target.value)} className={inputCls} style={inputSt} dir="ltr" />
            </div>
            <div className="flex items-center gap-1.5 pb-0.5">
              <span className="text-[12px] font-semibold" style={{ color: '#059669' }}>{formatCurrency(calculateMonthlyPayment(track.amount, track.interestRate, track.periodMonths))}</span>
              <button onClick={() => setTracks(tracks.filter((_, i) => i !== idx))} style={{ color: '#dc2626' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[13px] font-bold" style={{ color: '#059669' }}>
        סה"כ: {formatCurrency(tracks.reduce((s, t) => s + calculateMonthlyPayment(t.amount, t.interestRate, t.periodMonths), 0))}/חודש
      </div>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-5 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black flex items-center gap-2" style={{ fontSize: 24, color: '#1c1917', fontFamily: 'var(--font-heebo)' }}>
            <RefreshCw size={22} style={{ color: '#059669' }} />
            מחשבון מחזור משכנתא
          </h1>
        </div>
        <button
          onClick={openUploadModal}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold transition-all hover:opacity-90 shrink-0"
          style={{ borderRadius: 12, background: '#f5f4f2', color: '#57534e', border: '1.5px solid #e7e5e4' }}
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
        <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>עמלת פירעון מוקדם</label>
        <input
          type="number"
          value={earlyRepaymentFee}
          onChange={e => setEarlyRepaymentFee(+e.target.value)}
          className="px-3 py-2 outline-none text-[14px]"
          style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, width: 180, color: '#1c1917' }}
          dir="ltr"
        />
      </div>

      {/* Prepayment fee estimator */}
      <div style={cardStyle}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>הערכת עמלת פירעון מוקדם (עמלת היוון)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>סוג מסלול</label>
            <select value={feeTrackType} onChange={e => setFeeTrackType(e.target.value as LoanTrackType)} className={inputCls} style={inputSt}>
              {trackTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>יתרת המסלול</label>
            <input type="number" value={feeBalance} onChange={e => setFeeBalance(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>ריבית החוזה %</label>
            <input type="number" step="0.1" value={feeContractRate} onChange={e => setFeeContractRate(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }} title="לפי פרסום בנק ישראל לתקופה הממוצעת הנותרת">הריבית הממוצעת (בנק ישראל) %</label>
            <input type="number" step="0.1" value={feeAvgRate} onChange={e => setFeeAvgRate(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>חודשים שנותרו</label>
            <input type="number" value={feeRemainingMonths} onChange={e => setFeeRemainingMonths(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#a8a29e' }}>ותק המסלול (שנים)</label>
            <input type="number" value={feeYearsSinceStart} onChange={e => setFeeYearsSinceStart(+e.target.value)} className={inputCls} style={inputSt} dir="ltr" disabled={feeExempt} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] pb-1.5" style={{ color: '#57534e' }}>
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
            <label className="flex items-center gap-2 text-[13px] pb-1.5" style={{ color: '#57534e' }}>
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
              <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#f5f4f2' }}>
                <p className="text-[11px]" style={{ color: '#a8a29e' }}>עמלת היוון</p>
                <p className="text-[16px] font-black tabular-nums" style={{ color: '#57534e' }}>{formatCurrency(prepaymentFee.capitalizationFee)}</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#d1fae5' }}>
                <p className="text-[11px]" style={{ color: '#065f46' }}>הנחות{feeEarlyNotice ? ' (ותק + הודעה מוקדמת)' : ' (ותק)'}</p>
                <p className="text-[16px] font-black tabular-nums" style={{ color: '#059669' }}>−{formatCurrency(prepaymentFee.discount)}</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#059669' }}>
                <p className="text-[11px]" style={{ color: '#d1fae5' }}>עמלה משוערת</p>
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
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: '#d1fae5' }}>
              <p className="text-[16px] font-black" style={{ color: '#059669' }}>
                {feeTrackType === 'פריים'
                  ? '0 ₪ — מסלול פריים אינו נושא עמלת היוון'
                  : '0 ₪ — פירעון בתחנת יציאה פטור מעמלת היוון'}
              </p>
            </div>
          )}
        </div>
        <p className="text-[11px] mt-3" style={{ color: '#a8a29e' }}>
          הערכה בלבד — העמלה הסופית נקבעת ע"י הבנק ביום הפירעון.
        </p>
      </div>

      {/* Comparison */}
      <div style={cardStyle}>
        <h2 className="text-[15px] font-bold mb-4 flex items-center gap-2" style={{ color: '#1c1917' }}>
          <TrendingDown size={16} style={{ color: '#059669' }} />
          השוואה
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'החזר נוכחי',  value: formatCurrency(savings.existingMonthly), color: '#57534e', bg: '#f5f4f2' },
            { label: 'החזר חדש',    value: formatCurrency(savings.newMonthly),      color: '#059669', bg: '#d1fae5' },
            { label: 'חיסכון חודשי', value: formatCurrency(savings.monthlySaving),  color: '#059669', bg: '#d1fae5' },
            { label: 'חיסכון כולל', value: formatCurrency(savings.totalSaving),    color: '#059669', bg: '#d1fae5' },
          ].map(c => (
            <div key={c.label} className="text-center p-4 rounded-xl" style={{ background: c.bg }}>
              <p className="text-[12px] mb-1" style={{ color: '#a8a29e' }}>{c.label}</p>
              <p className="text-[18px] font-black tabular-nums" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 flex-wrap text-[13px]" style={{ color: '#57534e' }}>
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
        <h2 className="text-[15px] font-bold mb-4" style={{ color: '#1c1917' }}>חיסכון מצטבר</h2>
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
            style={{ background: '#fff', borderRadius: 20, border: '1px solid #e7e5e4', padding: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-bold" style={{ color: '#1c1917' }}>העלאת דוח יתרות</h2>
              <button onClick={() => setShowUploadModal(false)} style={{ color: '#a8a29e' }}><X size={18} /></button>
            </div>

            {uploadSuccess ? (
              <div className="text-center py-6">
                <CheckCircle size={40} style={{ color: '#059669', margin: '0 auto 12px' }} />
                <p className="text-[14px] font-semibold" style={{ color: '#059669' }}>{uploadSuccess}</p>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="mt-4 px-6 py-2 text-[13px] font-semibold text-white"
                  style={{ borderRadius: 12, background: '#059669' }}
                >סגור</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>לקוח</label>
                  {loadingCustomers ? (
                    <div className="flex items-center gap-2 text-[13px]" style={{ color: '#a8a29e' }}><Loader2 size={14} className="animate-spin" /> טוען...</div>
                  ) : (
                    <select
                      value={selectedUploadCustomer}
                      onChange={e => setSelectedUploadCustomer(e.target.value)}
                      className="w-full px-3 py-2 outline-none text-[13px]"
                      style={{ border: '1.5px solid #e7e5e4', borderRadius: 10, color: '#1c1917' }}
                    >
                      <option value="">בחר לקוח...</option>
                      {uploadCustomers.map(c => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#a8a29e' }}>קובץ PDF</label>
                  <input ref={reportFileRef} type="file" accept=".pdf,image/*" hidden onChange={handleReportFile} />
                  <div
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-[#059669]"
                    style={{ borderColor: pendingFile ? '#059669' : '#e7e5e4', background: pendingFile ? '#d1fae520' : '#faf9f7' }}
                    onClick={() => reportFileRef.current?.click()}
                  >
                    {pendingFile ? (
                      <p className="text-[13px] font-semibold" style={{ color: '#059669' }}>{pendingFile.name}</p>
                    ) : (
                      <>
                        <Upload size={24} style={{ color: '#a8a29e', margin: '0 auto 8px' }} />
                        <p className="text-[13px]" style={{ color: '#a8a29e' }}>לחץ לבחירת קובץ PDF</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleUploadReport}
                    disabled={uploadingReport || !pendingFile || !selectedUploadCustomer}
                    className="flex-1 py-2.5 text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ borderRadius: 12, background: '#059669' }}
                  >
                    {uploadingReport ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    העלה לתיק לקוח
                  </button>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 py-2.5 text-[13px] font-semibold transition-all hover:opacity-80"
                    style={{ borderRadius: 12, background: '#f5f4f2', color: '#57534e' }}
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
