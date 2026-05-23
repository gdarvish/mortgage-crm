import { useState, useMemo } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'

interface Loan {
  type: string
  balance: number
  monthlyPayment: number
  interestRate: number
  remainingMonths: number
  earlyRepaymentFee: number
}

const loanTypes = ['רכב', 'אישי', 'כרטיס אשראי', 'קו אשראי', 'אחר']

const emptyLoan: Loan = { type: 'אישי', balance: 0, monthlyPayment: 0, interestRate: 0, remainingMonths: 0, earlyRepaymentFee: 0 }

// ─── SVG CHART HELPER ─────────────────────────────────────────────────────────
interface BarDatum { l: string; v1?: number; v2?: number; c1?: string; c2?: string; v?: number; c?: string }

function SVGBars({ data, h = 180 }: { data: BarDatum[]; h?: number }) {
  if (!data || !data.length) return null
  const pad = { l: 8, r: 8, t: 12, b: 28 }, W = 480, H = h
  const paired = data[0] && data[0].v2 !== undefined
  const allV = paired ? data.flatMap(d => [d.v1 || 0, d.v2 || 0]) : data.map(d => d.v || 0)
  const max = Math.max(...allV, 1)
  const slotW = (W - pad.l - pad.r) / data.length
  const bw = slotW * (paired ? 0.36 : 0.62)
  const bh = (v: number) => Math.max((v / max) * (H - pad.t - pad.b), 2)
  const by = (v: number) => H - pad.b - bh(v)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: h, display: 'block' }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const cx = pad.l + i * slotW + slotW / 2
        return paired ? (
          <g key={i}>
            <rect x={cx - bw - 1} y={by(d.v1 || 0)} width={bw} height={bh(d.v1 || 0)} fill={d.c1 || '#ef4444'} rx={3} />
            <rect x={cx + 1} y={by(d.v2 || 0)} width={bw} height={bh(d.v2 || 0)} fill={d.c2 || '#059669'} rx={3} />
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="#a8a29e">{d.l}</text>
          </g>
        ) : (
          <g key={i}>
            <rect x={cx - bw / 2} y={by(d.v || 0)} width={bw} height={bh(d.v || 0)} fill={d.c || '#059669'} rx={3} />
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="#a8a29e">{d.l}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ConsolidationCalculatorPage() {
  const t = useTheme()
  const [loans, setLoans] = useState<Loan[]>([
    { type: 'רכב', balance: 80000, monthlyPayment: 2200, interestRate: 6.5, remainingMonths: 48, earlyRepaymentFee: 1500 },
    { type: 'אישי', balance: 50000, monthlyPayment: 1800, interestRate: 8.0, remainingMonths: 36, earlyRepaymentFee: 800 },
    { type: 'כרטיס אשראי', balance: 25000, monthlyPayment: 1200, interestRate: 12.0, remainingMonths: 24, earlyRepaymentFee: 0 },
  ])
  const [consolidatedRate, setConsolidatedRate] = useState(4.5)
  const [consolidatedMonths, setConsolidatedMonths] = useState(120)

  const addLoan = () => setLoans([...loans, { ...emptyLoan }])
  const removeLoan = (idx: number) => setLoans(loans.filter((_, i) => i !== idx))
  const updateLoan = (idx: number, field: keyof Loan, value: number | string) => {
    setLoans(loans.map((l, i) => i === idx ? { ...l, [field]: typeof l[field] === 'number' ? +value : value } : l))
  }

  const analysis = useMemo(() => {
    const totalBalance = loans.reduce((s, l) => s + l.balance, 0)
    const totalMonthly = loans.reduce((s, l) => s + l.monthlyPayment, 0)
    const totalFees = loans.reduce((s, l) => s + l.earlyRepaymentFee, 0)
    const consolidatedBalance = totalBalance + totalFees

    const r = consolidatedRate / 100 / 12
    const newMonthly = r > 0
      ? (consolidatedBalance * r * Math.pow(1 + r, consolidatedMonths)) / (Math.pow(1 + r, consolidatedMonths) - 1)
      : consolidatedBalance / (consolidatedMonths || 1)

    const monthlySaving = totalMonthly - newMonthly
    const totalExistingCost = loans.reduce((s, l) => s + l.monthlyPayment * l.remainingMonths, 0)
    // A3-07: totalNewCost is payments only; fees are added separately when computing net saving
    const totalNewCost = newMonthly * consolidatedMonths
    const totalSaving = totalExistingCost - totalNewCost - totalFees
    // A3-04: guard against Infinity / NaN when saving is non-positive
    const breakEvenMonths = monthlySaving > 0 ? Math.ceil(totalFees / monthlySaving) : null

    return {
      totalBalance, totalMonthly, totalFees, consolidatedBalance,
      newMonthly: Math.round(newMonthly),
      monthlySaving: Math.round(monthlySaving),
      yearlySaving: Math.round(monthlySaving * 12),
      totalSaving: Math.round(totalSaving),
      breakEvenMonths,
    }
  }, [loans, consolidatedRate, consolidatedMonths])

  const chartData: BarDatum[] = loans.map(l => ({
    l: l.type,
    v1: l.monthlyPayment,
    v2: Math.round((l.balance / (analysis.totalBalance || 1)) * analysis.newMonthly),
    c1: '#ef4444',
    c2: '#059669',
  }))

  const card = {
    background: t.cardBg,
    borderRadius: 20,
    boxShadow: t.shadow,
    border: `1px solid ${t.border}`,
  }
  const thSt: React.CSSProperties = { padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: t.textMuted, borderBottom: `1px solid ${t.border}`, letterSpacing: '0.04em' }
  const tdSt: React.CSSProperties = { padding: '10px 14px', fontSize: 12 }
  const cellSt: React.CSSProperties = { padding: '5px 8px', border: `1.5px solid ${t.border}`, borderRadius: 7, fontSize: 12, color: t.text, background: t.inputBg, outline: 'none', fontFamily: 'Heebo,sans-serif', width: '100%' }

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ marginBottom: 28, animation: 'fadeUp 0.4s ease backwards' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={22} style={{ color: t.primary }} />
            מחשבון איחוד הלוואות
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>השווה וחשב איחוד הלוואות קיימות למשכנתא</p>
        </div>

        {/* Loans Table */}
        <div style={{ ...card, padding: '20px 22px', marginBottom: 18, animation: 'fadeUp 0.4s ease 0.05s backwards' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>הלוואות קיימות</h3>
            <button
              onClick={addLoan}
              className="crm-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer', background: t.primary, color: '#fff', fontFamily: 'Heebo,sans-serif' }}
            >
              <Plus size={12} strokeWidth={2.5} /> הוסף הלוואה
            </button>
          </div>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.bg }}>
                  {['סוג', 'יתרה', 'החזר חודשי', 'ריבית %', 'חודשים', 'עמלת פירעון', ''].map((h, i) => (
                    <th key={i} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loans.map((loan, idx) => (
                  <tr key={idx} style={{ borderTop: `1px solid ${t.borderLight}` }}>
                    <td style={tdSt}><select value={loan.type} onChange={e => updateLoan(idx, 'type', e.target.value)} style={cellSt}>{loanTypes.map(lt => <option key={lt}>{lt}</option>)}</select></td>
                    <td style={tdSt}><input type="number" value={loan.balance} onChange={e => updateLoan(idx, 'balance', e.target.value)} style={cellSt} dir="ltr" /></td>
                    <td style={tdSt}><input type="number" value={loan.monthlyPayment} onChange={e => updateLoan(idx, 'monthlyPayment', e.target.value)} style={cellSt} dir="ltr" /></td>
                    <td style={tdSt}><input type="number" step="0.1" value={loan.interestRate} onChange={e => updateLoan(idx, 'interestRate', e.target.value)} style={cellSt} dir="ltr" /></td>
                    <td style={tdSt}><input type="number" value={loan.remainingMonths} onChange={e => updateLoan(idx, 'remainingMonths', e.target.value)} style={cellSt} dir="ltr" /></td>
                    <td style={tdSt}><input type="number" value={loan.earlyRepaymentFee} onChange={e => updateLoan(idx, 'earlyRepaymentFee', e.target.value)} style={cellSt} dir="ltr" /></td>
                    <td style={tdSt}><button onClick={() => removeLoan(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger }}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Consolidation Parameters */}
        <div style={{ ...card, padding: '20px 22px', marginBottom: 18, animation: 'fadeUp 0.4s ease 0.1s backwards' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>פרמטרי איחוד</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>ריבית איחוד %</label>
              <input
                type="number" step="0.1" value={consolidatedRate}
                onChange={e => setConsolidatedRate(+e.target.value || 0)}
                style={{ padding: '10px 12px', border: `1.5px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, background: t.inputBg, outline: 'none', fontFamily: 'Heebo,sans-serif', width: 160 }}
                dir="ltr"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>תקופה (חודשים)</label>
              <input
                type="number" value={consolidatedMonths}
                onChange={e => setConsolidatedMonths(+e.target.value || 1)}
                style={{ padding: '10px 12px', border: `1.5px solid ${t.border}`, borderRadius: 9, fontSize: 14, color: t.text, background: t.inputBg, outline: 'none', fontFamily: 'Heebo,sans-serif', width: 160 }}
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]" style={{ gap: 18 }}>
          <div style={{ ...card, padding: '20px 22px', animation: 'fadeUp 0.4s ease 0.15s backwards' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>סיכום</h3>
            {[
              { l: 'סה"כ חוב',         v: formatCurrency(analysis.totalBalance),  green: false, bold: false },
              { l: 'החזר חודשי כיום',  v: formatCurrency(analysis.totalMonthly),  green: false, bold: false },
              { l: 'החזר חודשי חדש',   v: formatCurrency(analysis.newMonthly),    green: true,  bold: true },
              { l: 'חיסכון חודשי',     v: formatCurrency(analysis.monthlySaving), green: true,  bold: false },
              { l: 'חיסכון שנתי',      v: formatCurrency(analysis.yearlySaving),  green: true,  bold: false },
              { l: 'חיסכון כולל',      v: formatCurrency(analysis.totalSaving),   green: true,  bold: false },
              { l: 'עמלות פירעון',     v: formatCurrency(analysis.totalFees),     green: false, bold: false },
              { l: 'Break-Even',       v: analysis.breakEvenMonths === null ? 'N/A' : `${analysis.breakEvenMonths} חודשים`, green: false, bold: false },
            ].map(row => (
              <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${t.borderLight}` }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>{row.l}</span>
                <span style={{ fontSize: row.bold ? 15 : 13, fontWeight: row.bold ? 800 : 600, color: row.green ? t.success : t.text }}>{row.v}</span>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: '20px 22px', animation: 'fadeUp 0.4s ease 0.2s backwards' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16 }}>השוואת החזרים</h3>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              {[{ c: '#ef4444', l: 'נוכחי' }, { c: '#059669', l: 'איחוד' }].map(item => (
                <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textSub }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: item.c }} />
                  {item.l}
                </div>
              ))}
            </div>
            <SVGBars data={chartData} h={220} />
          </div>
        </div>
      </div>
    </div>
  )
}
