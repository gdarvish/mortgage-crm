import { useState } from 'react'
import { PieChart as PieChartIcon, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeContext'

interface Expense {
  category: string
  amount: number
}

interface DonutDatum { v: number; c: string; l: string }

function SVGDonut({ data, size = 170 }: { data: DonutDatum[]; size?: number }) {
  const total = data.reduce((s, d) => s + (d.v || 0), 0) || 1
  const cx = size / 2, cy = size / 2, r = size * 0.4, ri = size * 0.24
  const segs: (DonutDatum & { a0: number; a1: number })[] = []
  data.reduce((startAngle, d) => {
    const sw = ((d.v || 0) / total) * Math.PI * 2
    segs.push({ ...d, a0: startAngle, a1: startAngle + sw })
    return startAngle + sw
  }, -Math.PI / 2)
  const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0)
    const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1)
    const lg = a1 - a0 > Math.PI ? 1 : 0
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: 'block' }}>
      {segs.map((s, i) => {
        const outer = arcPath(cx, cy, r, s.a0, s.a1)
        const inner = arcPath(cx, cy, ri, s.a1, s.a0)
        const ix = (cx + ri * Math.cos(s.a1)).toFixed(2), iy = (cy + ri * Math.sin(s.a1)).toFixed(2)
        return <path key={i} d={`${outer} L${ix},${iy} ${inner} Z`} fill={s.c || '#059669'} stroke="#fff" strokeWidth={1} />
      })}
    </svg>
  )
}

export default function FamilyEconomicsPage() {
  const t = useTheme()
  // A5-11: use theme tokens instead of hardcoded hex for expense bar colors
  const EXPENSE_COLORS = [t.textMuted, t.warning, t.accent, t.danger, t.primary, '#f97316', t.success]
  const [income1, setIncome1] = useState(15000)
  const [income2, setIncome2] = useState(12000)
  const [mortgagePayment, setMortgagePayment] = useState(5500)
  const [expenses, setExpenses] = useState<Expense[]>([
    { category: 'דיור (ארנונה, ועד בית)', amount: 1500 },
    { category: 'מזון', amount: 3500 },
    { category: 'רכב', amount: 2500 },
    { category: 'חינוך', amount: 3000 },
    { category: 'בילויים', amount: 1500 },
    { category: 'חסכונות', amount: 2000 },
    { category: 'אחר', amount: 1000 },
  ])

  const updateExpense = (idx: number, amount: number) => {
    setExpenses(expenses.map((e, i) => i === idx ? { ...e, amount } : e))
  }

  const totalIncome = income1 + income2
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalWithMortgage = totalExpenses + mortgagePayment
  const remaining = totalIncome - totalWithMortgage
  const dti = totalIncome > 0 ? (mortgagePayment / totalIncome) * 100 : 0
  const expPct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0

  const status = remaining >= 5000
    ? { label: 'מצב כלכלי מצוין — יש מרווח נוח', color: t.success, bg: t.successBg }
    : remaining >= 3000
      ? { label: 'מצב תקין — מומלץ לשמור על מרווח', color: t.warning, bg: t.warningBg }
      : remaining >= 0
        ? { label: 'מצב צפוף — שקול להפחית החזר', color: t.warning, bg: t.warningBg }
        : { label: 'חריגה מההכנסה!', color: t.danger, bg: t.dangerBg }

  const donutData: DonutDatum[] = [
    ...expenses.map((e, i) => ({ v: e.amount, c: EXPENSE_COLORS[i % EXPENSE_COLORS.length], l: e.category })),
    { v: mortgagePayment, c: t.primary, l: 'משכנתא' },
  ]

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: `1.5px solid ${t.border}`,
    borderRadius: 9, fontSize: 13, color: t.text, background: t.inputBg,
    outline: 'none', fontFamily: 'Heebo,sans-serif',
  }
  const numSt: React.CSSProperties = { ...inputSt, width: 110, flexShrink: 0 }
  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 5,
  }

  const handlePrint = () => window.print()

  return (
    <div style={{ animation: 'fadeUp 0.38s cubic-bezier(0.25,1,0.5,1) backwards' }}>
      <div className="crm-page">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            <PieChartIcon size={22} style={{ color: t.primary }} />
            מחשבון כלכלת משפחה
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>ניתוח הכנסות, הוצאות ויכולת עמידה במשכנתא</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr]" style={{ gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: t.cardBg, borderRadius: 20, padding: '20px 24px',
              boxShadow: t.shadow, border: `1px solid ${t.border}`,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>הכנסות</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelSt}>הכנסה לווה 1</label>
                  <input type="number" value={income1} onChange={e => setIncome1(+e.target.value || 0)} style={inputSt} dir="ltr" />
                </div>
                <div>
                  <label style={labelSt}>הכנסה לווה 2</label>
                  <input type="number" value={income2} onChange={e => setIncome2(+e.target.value || 0)} style={inputSt} dir="ltr" />
                </div>
              </div>
              <div>
                <label style={labelSt}>החזר משכנתא מבוקש</label>
                <input type="number" value={mortgagePayment} onChange={e => setMortgagePayment(+e.target.value || 0)} style={inputSt} dir="ltr" />
              </div>
            </div>

            <div style={{
              background: t.cardBg, borderRadius: 20, padding: '20px 24px',
              boxShadow: t.shadow, border: `1px solid ${t.border}`,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>הוצאות חודשיות</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {expenses.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: EXPENSE_COLORS[i % EXPENSE_COLORS.length], flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, flex: 1, color: t.textSub }}>{e.category}</span>
                    <input
                      type="number" value={e.amount}
                      onChange={ev => updateExpense(i, +ev.target.value || 0)}
                      style={numSt} dir="ltr"
                    />
                    <span style={{ fontSize: 12, color: t.textMuted, width: 80, textAlign: 'left', flexShrink: 0 }}>
                      {formatCurrency(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: t.cardBg, borderRadius: 20, padding: '20px 24px',
              boxShadow: t.shadow, border: `1px solid ${t.border}`,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>סיכום</h3>
              {[
                { l: 'סה"כ הכנסות', v: formatCurrency(totalIncome), color: t.success },
                { l: 'סה"כ הוצאות', v: formatCurrency(totalExpenses), color: t.text },
                { l: 'החזר משכנתא', v: formatCurrency(mortgagePayment), color: t.primary },
                { l: 'סה"כ הוצאות + משכנתא', v: formatCurrency(totalWithMortgage), color: t.text, bold: true },
              ].map(rrow => (
                <div key={rrow.l} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                  borderBottom: `1px solid ${t.borderLight}`,
                }}>
                  <span style={{ fontSize: 13, color: t.textMuted }}>{rrow.l}</span>
                  <span style={{ fontSize: rrow.bold ? 14 : 13, fontWeight: rrow.bold ? 700 : 600, color: rrow.color }}>{rrow.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>נשאר</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: status.color }}>{formatCurrency(remaining)}</span>
              </div>

              {/* Visual bar */}
              <div style={{ height: 10, borderRadius: 5, background: t.border, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ display: 'flex', height: '100%' }}>
                  {/* A5-11: use theme token instead of hardcoded #a8a29e */}
                  <div style={{ width: `${Math.min(expPct, 100)}%`, background: t.textMuted, transition: 'width 0.5s' }} />
                  <div style={{ width: `${Math.min(dti, 100 - expPct)}%`, background: t.primary, transition: 'width 0.5s' }} />
                </div>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 11,
                color: t.textMuted, marginBottom: 14,
              }}>
                <span>הוצאות: {expPct.toFixed(0)}%</span>
                <span>משכנתא: {dti.toFixed(0)}%</span>
                <span>מרווח: {totalIncome > 0 ? ((remaining / totalIncome) * 100).toFixed(0) : '0'}%</span>
              </div>

              <div style={{
                padding: '11px 14px', borderRadius: 12, background: status.bg,
                color: status.color, fontSize: 13, fontWeight: 600,
              }}>
                {status.label}
              </div>
            </div>

            {/* Donut */}
            <div style={{
              background: t.cardBg, borderRadius: 20, padding: '20px 24px',
              boxShadow: t.shadow, border: `1px solid ${t.border}`,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>חלוקת הוצאות</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <SVGDonut data={donutData} size={150} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {donutData.slice(0, 6).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.c, flexShrink: 0 }} />
                      <span style={{
                        fontSize: 11, color: t.textMuted, flex: 1, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{d.l}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{formatCurrency(d.v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* A5-12: print:hidden hides the button from print layout */}
            <button
              onClick={handlePrint}
              className="crm-btn-primary print:hidden"
              style={{
                background: t.primary, color: '#fff', border: 'none', borderRadius: 14,
                padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Heebo,sans-serif', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, boxShadow: `0 4px 14px ${t.primary}45`,
              }}
            >
              <Download size={15} />
              הורד PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
