import { useState, useMemo, useRef } from 'react'
import { RefreshCw, Plus, Trash2, BarChart3, UploadCloud, Loader2, CheckCircle, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { calculateMonthlyPayment, calculateRefinanceSavings, type TrackInput } from '@/utils/mortgageCalculations'
import { customerService } from '@/services/customerService'
import { documentService } from '@/services/documentService'
import { toast } from '@/components/ui'
import type { LoanTrackType, Customer } from '@/types/database'
import { useTheme } from '@/theme/ThemeContext'

const trackTypes: { value: LoanTrackType; label: string }[] = [
  { value: 'פריים',           label: 'פריים' },
  { value: 'קל"צ',            label: 'קבועה לא צמודה' },
  { value: 'קל"ב',            label: 'קבועה צמודה' },
  { value: 'משתנה_צמודה',     label: 'משתנה צמודה' },
  { value: 'משתנה_לא_צמודה', label: 'משתנה לא צמודה' },
  { value: 'זכאות',           label: 'זכאות' },
]

const TRACK_COLORS_RF = ['#059669', '#2563eb', '#d97706', '#8b5cf6', '#0ea5e9', '#f97316']

// ─── SVG CHART HELPER ─────────────────────────────────────────────────────────
function SVGLineRaw({ data, color = '#059669', h = 200, refY, labelPrefix = '₪' }: {
  data: { l: string; v: number }[]
  color?: string
  h?: number
  refY?: number
  labelPrefix?: string
}) {
  if (!data || !data.length) return null
  const pad = { l: 56, r: 12, t: 12, b: 28 }, W = 500, H = h
  const vals = data.map(d => d.v)
  const min = Math.min(...vals, 0)
  const max = Math.max(...vals, 1)
  const px = (i: number) => pad.l + (i / Math.max(data.length - 1, 1)) * (W - pad.l - pad.r)
  const py = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b)
  const pts = data.map((d, i) => `${px(i).toFixed(1)},${py(d.v).toFixed(1)}`).join(' ')
  const zeroY = py(0).toFixed(1)
  const area = `${px(0).toFixed(1)},${zeroY} ` + pts + ` ${px(data.length - 1).toFixed(1)},${zeroY}`
  const gridVals = [min, max / 2, max]
  const fmt = (v: number) => v >= 1000 ? `${labelPrefix}${(v / 1000).toFixed(0)}K` : v <= -1000 ? `-${labelPrefix}${(-v / 1000).toFixed(0)}K` : `${labelPrefix}${Math.round(v)}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: h, display: 'block' }} preserveAspectRatio="none">
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={py(v).toFixed(1)} x2={W - pad.r} y2={py(v).toFixed(1)} stroke="#f0efed" strokeDasharray="4 3" />
          <text x={pad.l - 4} y={py(v) + 4} textAnchor="end" fontSize={9} fill="#a8a29e">{fmt(v)}</text>
        </g>
      ))}
      {refY !== undefined && <line x1={pad.l} y1={py(refY)} x2={W - pad.r} y2={py(refY)} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1.5} />}
      <polygon points={area} fill={color + '15'} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {data.filter((_, i) => i % Math.ceil(data.length / 8) === 0 || i === data.length - 1).map((d, i) => (
        <text key={i} x={px(data.indexOf(d))} y={H - 7} textAnchor="middle" fontSize={9} fill="#a8a29e">{d.l}</text>
      ))}
    </svg>
  )
}

export default function RefinanceCalculatorPage() {
  const t = useTheme()
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
    const data: { l: string; v: number }[] = []
    let cumulative = -earlyRepaymentFee
    for (let month = 1; month <= 240; month++) {
      cumulative += savings.monthlySaving
      if (month % 6 === 0) data.push({ l: `${month}`, v: Math.round(cumulative) })
    }
    return data
  }, [savings, earlyRepaymentFee])

  const updateTrack = (
    tracks: TrackInput[],
    setTracks: (t: TrackInput[]) => void,
    idx: number,
    field: keyof TrackInput,
    value: number | string,
  ) => {
    setTracks(tracks.map((tr, i) => i === idx ? { ...tr, [field]: value } : tr))
  }

  const card = {
    background: t.cardBg,
    borderRadius: 20,
    boxShadow: t.shadow,
    border: `1px solid ${t.border}`,
  }
  const rowSt = {
    padding: '7px 10px', border: `1.5px solid ${t.border}`, borderRadius: 8,
    fontSize: 12, color: t.text, background: t.inputBg, outline: 'none', fontFamily: 'Heebo,sans-serif',
  }

  const renderTrackEditor = (tracks: TrackInput[], setTracks: (t: TrackInput[]) => void, title: string, delay: number) => (
    <div style={{ ...card, padding: '20px 22px', animation: `fadeUp 0.4s ease ${delay}s backwards` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</h3>
        <button
          onClick={() => setTracks([...tracks, { type: 'קל"צ', amount: 0, interestRate: 4.0, periodMonths: 240 }])}
          className="crm-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer', background: t.primary, color: '#fff', fontFamily: 'Heebo,sans-serif' }}
        >
          <Plus size={12} strokeWidth={2.5} /> הוסף
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tracks.map((track, idx) => {
          const monthly = calculateMonthlyPayment(track.amount, track.interestRate, track.periodMonths)
          const col = TRACK_COLORS_RF[idx % TRACK_COLORS_RF.length]
          return (
            <div key={idx} style={{ background: t.bg, borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 8, gridTemplateColumns: '1.6fr 1fr 1fr 1fr auto', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>סוג</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                  <select value={track.type} onChange={e => updateTrack(tracks, setTracks, idx, 'type', e.target.value)} style={{ ...rowSt, flex: 1 }}>
                    {trackTypes.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>יתרה (₪)</label>
                <input type="number" value={track.amount} onChange={e => updateTrack(tracks, setTracks, idx, 'amount', +e.target.value || 0)} style={rowSt} dir="ltr" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>ריבית %</label>
                <input type="number" step="0.1" value={track.interestRate} onChange={e => updateTrack(tracks, setTracks, idx, 'interestRate', +e.target.value || 0)} style={rowSt} dir="ltr" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>חודשים</label>
                <input type="number" value={track.periodMonths} onChange={e => updateTrack(tracks, setTracks, idx, 'periodMonths', +e.target.value || 1)} style={rowSt} dir="ltr" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col, whiteSpace: 'nowrap' }}>{formatCurrency(Math.round(monthly))}</span>
                <button onClick={() => setTracks(tracks.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
        <div style={{ fontSize: 13, fontWeight: 700, color: t.primary, padding: '4px 0' }}>
          סה"כ: {formatCurrency(Math.round(tracks.reduce((s, tr) => s + calculateMonthlyPayment(tr.amount, tr.interestRate, tr.periodMonths), 0)))}/חודש
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12, animation: 'fadeUp 0.4s ease backwards' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <RefreshCw size={22} style={{ color: t.primary }} />
              מחשבון מחזור משכנתא
            </h1>
          </div>
          <button
            onClick={openUploadModal}
            className="crm-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 12, cursor: 'pointer', background: t.bg, color: t.textSub, border: `1.5px solid ${t.border}`, fontFamily: 'Heebo,sans-serif' }}
          >
            <UploadCloud size={14} />
            העלה PDF דוח יתרות
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
          {renderTrackEditor(existingTracks, setExistingTracks, 'תמהיל קיים', 0.05)}
          {renderTrackEditor(newTracks, setNewTracks, 'תמהיל מוצע', 0.1)}
        </div>

        {/* Fee */}
        <div style={{ ...card, padding: '18px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeUp 0.4s ease 0.15s backwards' }}>
          <label style={{ fontSize: 13, color: t.textMuted, whiteSpace: 'nowrap' }}>עמלת פירעון מוקדם:</label>
          <input
            type="number"
            value={earlyRepaymentFee}
            onChange={e => setEarlyRepaymentFee(+e.target.value || 0)}
            style={{ padding: '8px 12px', border: `1.5px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, background: t.inputBg, outline: 'none', fontFamily: 'Heebo,sans-serif', width: 160 }}
            dir="ltr"
          />
          <span style={{ fontSize: 13, color: t.textMuted }}>{formatCurrency(earlyRepaymentFee)}</span>
        </div>

        {/* Comparison */}
        <div style={{ ...card, padding: '20px 24px', marginBottom: 18, animation: 'fadeUp 0.4s ease 0.2s backwards' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} style={{ color: t.primary }} />
            השוואה
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'החזר נוכחי',   value: formatCurrency(savings.existingMonthly), color: t.textSub, bg: t.bg },
              { label: 'החזר חדש',     value: formatCurrency(savings.newMonthly),      color: t.success, bg: t.successBg },
              { label: 'חיסכון חודשי', value: formatCurrency(savings.monthlySaving),   color: t.success, bg: t.successBg },
              { label: 'חיסכון כולל',  value: formatCurrency(savings.totalSaving),     color: t.primary, bg: t.primary + '15' },
            ].map(c => (
              <div key={c.label} style={{ padding: '14px 16px', borderRadius: 14, background: c.bg, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{c.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13, color: t.textSub }}>
            <span>עמלת פירעון: {formatCurrency(earlyRepaymentFee)}</span>
            <span>Break-Even: {savings.breakEvenMonths === Infinity ? 'לא רלוונטי' : `${savings.breakEvenMonths} חודשים`}</span>
            <span style={{ padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, background: savings.isWorthIt ? t.successBg : t.dangerBg, color: savings.isWorthIt ? t.success : t.danger }}>
              {savings.isWorthIt ? '✅ כדאי לבצע מחזור' : '❌ לא כדאי כרגע'}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div style={{ ...card, padding: '20px 24px', animation: 'fadeUp 0.4s ease 0.25s backwards' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>חיסכון מצטבר</h3>
          <SVGLineRaw data={cumulativeSavings} color={t.primary} h={200} refY={0} />
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
            onClick={() => setShowUploadModal(false)}
          >
            <div
              style={{ background: t.cardBg, borderRadius: 20, border: `1px solid ${t.border}`, padding: 28, width: '100%', maxWidth: 440, boxShadow: t.shadowHover, animation: 'scaleIn 0.25s ease' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: t.text }}>העלאת דוח יתרות</h2>
                <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted }}><X size={18} /></button>
              </div>

              {uploadSuccess ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle size={40} style={{ color: t.success, margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: t.success }}>{uploadSuccess}</p>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="crm-btn-primary"
                    style={{ marginTop: 16, padding: '8px 24px', fontSize: 13, fontWeight: 600, color: '#fff', borderRadius: 12, border: 'none', cursor: 'pointer', background: t.primary, fontFamily: 'Heebo,sans-serif' }}
                  >סגור</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>לקוח</label>
                    {loadingCustomers ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textMuted }}><Loader2 size={14} className="animate-spin" /> טוען...</div>
                    ) : (
                      <select
                        value={selectedUploadCustomer}
                        onChange={e => setSelectedUploadCustomer(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, outline: 'none', border: `1.5px solid ${t.border}`, borderRadius: 10, color: t.text, background: t.inputBg, fontFamily: 'Heebo,sans-serif' }}
                      >
                        <option value="">בחר לקוח...</option>
                        {uploadCustomers.map(c => (
                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>קובץ PDF</label>
                    <input ref={reportFileRef} type="file" accept=".pdf,image/*" hidden onChange={handleReportFile} />
                    <div
                      style={{ border: `2px dashed ${pendingFile ? t.primary : t.border}`, borderRadius: 14, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: pendingFile ? t.successBg : t.bg }}
                      onClick={() => reportFileRef.current?.click()}
                    >
                      {pendingFile ? (
                        <p style={{ fontSize: 13, fontWeight: 600, color: t.primary }}>{pendingFile.name}</p>
                      ) : (
                        <>
                          <UploadCloud size={28} style={{ color: t.textMuted, margin: '0 auto 10px' }} />
                          <p style={{ fontSize: 13, color: t.textMuted }}>לחץ לבחירת קובץ PDF</p>
                          <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>PDF, JPG עד 10MB</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleUploadReport}
                      disabled={uploadingReport || !pendingFile || !selectedUploadCustomer}
                      className="crm-btn-primary"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, color: '#fff', borderRadius: 12, border: 'none', cursor: 'pointer', background: t.primary, fontFamily: 'Heebo,sans-serif', opacity: (uploadingReport || !pendingFile || !selectedUploadCustomer) ? 0.5 : 1 }}
                    >
                      {uploadingReport ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                      העלה לתיק לקוח
                    </button>
                    <button
                      onClick={() => setShowUploadModal(false)}
                      className="crm-btn"
                      style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, borderRadius: 12, border: `1px solid ${t.border}`, cursor: 'pointer', background: t.bg, color: t.textSub, fontFamily: 'Heebo,sans-serif' }}
                    >ביטול</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
