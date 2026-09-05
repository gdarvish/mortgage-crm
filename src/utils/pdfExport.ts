import { formatCurrency } from '@/lib/utils'
import type { ComplianceUnit } from '@/utils/mortgageCalculations'

function esc(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface MortgagePdfTrack {
  type: string
  amount: number
  interestRate: number
  periodMonths: number
  monthlyPayment: number
}

export interface MortgagePdfComplianceCheck {
  name: string
  value: number
  limit: number
  isValid: boolean
  /** Defaults to '%' for callers that predate per-check units. */
  unit?: ComplianceUnit
}

/** Renders a value with its own unit — "300 חודשים", not "300%". */
function withUnit(value: number, unit: ComplianceUnit = '%'): string {
  switch (unit) {
    case 'months': return `${value} חו'`
    case 'years': return `${value}`
    default: return `${value}%`
  }
}

export interface MortgagePdfData {
  customerName?: string
  propertyPrice: number
  ownCapital: number
  loanAmount: number
  ltv: number
  monthlyIncome: number
  tracks: MortgagePdfTrack[]
  totalMonthlyPayment: number
  totalCost: number
  compliance: MortgagePdfComplianceCheck[]
}

const GREEN = '#059669'
const INK = '#1c1917'
const MUTED = '#a8a29e'
const LINE = '#e7e5e4'

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 10px;color:${MUTED};font-size:13px;border-bottom:1px solid #f5f4f2;">${esc(label)}</td>
    <td style="padding:7px 10px;color:${INK};font-size:13px;font-weight:700;border-bottom:1px solid #f5f4f2;text-align:left;">${esc(value)}</td>
  </tr>`
}

function buildHtml(data: MortgagePdfData): string {
  const date = new Date().toLocaleDateString('he-IL')
  const th = `padding:8px 10px;font-size:12px;font-weight:700;color:#ffffff;background:${GREEN};text-align:right;`
  const td = `padding:8px 10px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};text-align:right;`

  const trackRows = data.tracks
    .map(
      (t) => `<tr>
        <td style="${td}">${esc(t.type)}</td>
        <td style="${td}">${formatCurrency(t.amount)}</td>
        <td style="${td}" dir="ltr">${t.interestRate.toFixed(2)}%</td>
        <td style="${td}">${t.periodMonths} חו'</td>
        <td style="${td}font-weight:700;">${formatCurrency(t.monthlyPayment)}</td>
      </tr>`
    )
    .join('')

  const complianceRows = data.compliance
    .map(
      (c) => `<tr>
        <td style="${td}">${esc(c.name)}</td>
        <td style="${td}" dir="ltr">${withUnit(c.value, c.unit)}</td>
        <td style="${td}" dir="ltr">${withUnit(c.limit, c.unit)}</td>
        <td style="${td}font-weight:700;color:${c.isValid ? GREEN : '#dc2626'};">${c.isValid ? '✓ תקין' : '✗ חריגה'}</td>
      </tr>`
    )
    .join('')

  return `<div dir="rtl" style="font-family:'Heebo','Arial',sans-serif;background:#ffffff;color:${INK};padding:40px;width:794px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${GREEN};padding-bottom:16px;margin-bottom:22px;">
      <div>
        <div style="font-size:24px;font-weight:800;color:${GREEN};">הצעת משכנתא</div>
        <div style="font-size:12px;color:${MUTED};margin-top:4px;">MortgageCRM — מערכת ניהול יועץ משכנתאות</div>
      </div>
      <div style="font-size:13px;color:#57534e;text-align:left;">
        ${data.customerName ? `<div style="font-weight:700;">${esc(data.customerName)}</div>` : ''}
        <div>תאריך: ${date}</div>
      </div>
    </div>

    <div style="font-size:15px;font-weight:700;margin-bottom:8px;">נתוני הנכס</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      ${row('מחיר הנכס', formatCurrency(data.propertyPrice))}
      ${row('הון עצמי', formatCurrency(data.ownCapital))}
      ${row('סכום הלוואה', formatCurrency(data.loanAmount))}
      ${row('אחוז מימון (LTV)', `${data.ltv}%`)}
      ${row('הכנסה חודשית נטו', formatCurrency(data.monthlyIncome))}
    </table>

    <div style="font-size:15px;font-weight:700;margin-bottom:8px;">תמהיל מסלולים</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      <thead><tr>
        <th style="${th}">מסלול</th>
        <th style="${th}">סכום</th>
        <th style="${th}">ריבית</th>
        <th style="${th}">תקופה</th>
        <th style="${th}">החזר חודשי</th>
      </tr></thead>
      <tbody>${trackRows}</tbody>
    </table>

    <div style="display:flex;gap:12px;margin-bottom:22px;">
      <div style="flex:1;background:#d1fae5;border-radius:12px;padding:14px 16px;">
        <div style="font-size:12px;color:#065f46;">תשלום חודשי כולל</div>
        <div style="font-size:20px;font-weight:800;color:${GREEN};margin-top:2px;">${formatCurrency(data.totalMonthlyPayment)}</div>
      </div>
      <div style="flex:1;background:#f5f4f2;border-radius:12px;padding:14px 16px;">
        <div style="font-size:12px;color:${MUTED};">עלות כוללת (קרן + ריבית)</div>
        <div style="font-size:20px;font-weight:800;color:${INK};margin-top:2px;">${formatCurrency(data.totalCost)}</div>
      </div>
    </div>

    <div style="font-size:15px;font-weight:700;margin-bottom:8px;">בדיקת רגולציה (בנק ישראל)</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      <thead><tr>
        <th style="${th}">בדיקה</th>
        <th style="${th}">ערך</th>
        <th style="${th}">מגבלה</th>
        <th style="${th}">תוצאה</th>
      </tr></thead>
      <tbody>${complianceRows}</tbody>
    </table>

    <div style="font-size:11px;color:${MUTED};border-top:1px solid ${LINE};padding-top:12px;line-height:1.6;">
      הצעה זו הינה אומדן ראשוני בלבד, נכון לתאריך ההפקה, ואינה מהווה התחייבות או אישור עקרוני מצד גוף מממן.
      התנאים הסופיים כפופים לאישור הבנק ולבדיקת זכאות.
    </div>
  </div>`
}

async function renderHtmlToPdf(html: string, filename: string): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro'),
  ])

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = '794px'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210
    const pageH = 297
    const imgH = (canvas.height / canvas.width) * pageW
    const imgData = canvas.toDataURL('image/png')

    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH)
    } else {
      // The full-height image is placed on each page shifted up by one page.
      let position = 0
      let remaining = imgH
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH)
        remaining -= pageH
        if (remaining > 0) {
          pdf.addPage()
          position -= pageH
        }
      }
    }
    pdf.save(filename)
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportMortgagePdf(data: MortgagePdfData): Promise<void> {
  await renderHtmlToPdf(buildHtml(data), `mortgage-proposal-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Bank comparison PDF ──────────────────────────────────────────────────────

export interface BankComparisonOffer {
  bankName: string
  round: number
  tracks: { type: string; amount: number; interestRate: number; periodMonths: number }[]
  monthly: number
  total: number
}

export interface BankComparisonPdfData {
  customerName?: string
  offers: BankComparisonOffer[]
}

function buildComparisonHtml(data: BankComparisonPdfData): string {
  const date = new Date().toLocaleDateString('he-IL')
  const th = `padding:8px 10px;font-size:12px;font-weight:700;color:#ffffff;background:${GREEN};text-align:center;`
  const td = `padding:8px 10px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};text-align:center;`
  const labelTd = `padding:8px 10px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};text-align:right;font-weight:700;`

  const offers = data.offers
  const trackTypes = Array.from(new Set(offers.flatMap(o => o.tracks.map(t => t.type))))

  const bestMonthly = Math.min(...offers.map(o => o.monthly))
  const bestTotal = Math.min(...offers.map(o => o.total))

  const headerCells = offers
    .map(o => `<th style="${th}">${esc(o.bankName)}<div style="font-size:10px;font-weight:400;opacity:0.85;">סבב ${o.round}</div></th>`)
    .join('')

  const rateRows = trackTypes
    .map(type => {
      const cells = offers
        .map(o => {
          const t = o.tracks.find(tr => tr.type === type)
          return `<td style="${td}" dir="ltr">${t ? `${t.interestRate.toFixed(2)}%` : '—'}</td>`
        })
        .join('')
      return `<tr><td style="${labelTd}">${esc(type)}</td>${cells}</tr>`
    })
    .join('')

  const monthlyCells = offers
    .map(o => `<td style="${td}font-weight:700;${o.monthly === bestMonthly ? `background:#d1fae5;color:${GREEN};` : ''}">${formatCurrency(o.monthly)}</td>`)
    .join('')
  const totalCells = offers
    .map(o => `<td style="${td}font-weight:700;${o.total === bestTotal ? `background:#d1fae5;color:${GREEN};` : ''}">${formatCurrency(o.total)}</td>`)
    .join('')

  return `<div dir="rtl" style="font-family:'Heebo','Arial',sans-serif;background:#ffffff;color:${INK};padding:40px;width:794px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${GREEN};padding-bottom:16px;margin-bottom:22px;">
      <div>
        <div style="font-size:24px;font-weight:800;color:${GREEN};">השוואת הצעות בנקים</div>
        <div style="font-size:12px;color:${MUTED};margin-top:4px;">MortgageCRM — מערכת ניהול יועץ משכנתאות</div>
      </div>
      <div style="font-size:13px;color:#57534e;text-align:left;">
        ${data.customerName ? `<div style="font-weight:700;">${esc(data.customerName)}</div>` : ''}
        <div>תאריך: ${date}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      <thead><tr>
        <th style="${th}text-align:right;">מסלול / ריבית</th>
        ${headerCells}
      </tr></thead>
      <tbody>
        ${rateRows}
        <tr><td style="${labelTd}background:#f5f4f2;">החזר חודשי כולל</td>${monthlyCells}</tr>
        <tr><td style="${labelTd}background:#f5f4f2;">עלות כוללת</td>${totalCells}</tr>
      </tbody>
    </table>

    <div style="font-size:11px;color:${MUTED};border-top:1px solid ${LINE};padding-top:12px;line-height:1.6;">
      השוואה זו מבוססת על ההצעות שהתקבלו נכון לתאריך ההפקה. הערכים הטובים ביותר מודגשים.
      התנאים הסופיים כפופים לאישור הבנק ולבדיקת זכאות.
    </div>
  </div>`
}

export async function exportBankComparisonPdf(data: BankComparisonPdfData): Promise<void> {
  await renderHtmlToPdf(buildComparisonHtml(data), `bank-comparison-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Mix version comparison PDF ───────────────────────────────────────────────

/** Advisor branding, from advisor_settings. */
export interface PdfBranding {
  name?: string | null
  title?: string | null
  licenseNumber?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  footerText?: string | null
}

export interface VersionComparisonRow {
  version: number
  label: string | null
  source: string
  monthlyPayment: number
  totalCost: number
  loanAmount: number
  dti: number
  ltv: number
  compliant: boolean
}

export interface VersionComparisonPdfData {
  customerName?: string
  versions: VersionComparisonRow[]
  branding?: PdfBranding
}

function buildVersionComparisonHtml(data: VersionComparisonPdfData): string {
  const date = new Date().toLocaleDateString('he-IL')
  const brand = data.branding ?? {}
  const accent = brand.primaryColor || GREEN

  const th = `padding:8px 10px;font-size:12px;font-weight:700;color:#ffffff;background:${accent};text-align:center;`
  const td = `padding:8px 10px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};text-align:center;`
  const labelTd = `padding:8px 10px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};text-align:right;font-weight:700;`

  const versions = data.versions
  const bestMonthly = Math.min(...versions.map(v => v.monthlyPayment))
  const bestTotal = Math.min(...versions.map(v => v.totalCost))

  const headerCells = versions
    .map(v => `<th style="${th}">v${v.version}${v.label ? `<div style="font-size:10px;font-weight:400;opacity:0.9;">${esc(v.label)}</div>` : ''}<div style="font-size:10px;font-weight:400;opacity:0.75;">${esc(v.source)}</div></th>`)
    .join('')

  /** One row, marking the best cell when the row has a direction. */
  const row = (
    label: string,
    format: (v: VersionComparisonRow) => string,
    best?: (v: VersionComparisonRow) => boolean,
  ) => {
    const cells = versions
      .map(v => `<td style="${td}${best?.(v) ? `background:#d1fae5;color:${accent};font-weight:700;` : ''}">${format(v)}</td>`)
      .join('')
    return `<tr><td style="${labelTd}">${esc(label)}</td>${cells}</tr>`
  }

  // The saving the negotiation actually produced, first version to best.
  const firstTotal = versions[0]?.totalCost ?? 0
  const savedTotal = firstTotal - bestTotal
  const firstMonthly = versions[0]?.monthlyPayment ?? 0
  const savedMonthly = firstMonthly - bestMonthly

  return `<div dir="rtl" style="font-family:'Heebo','Arial',sans-serif;background:#ffffff;color:${INK};padding:40px;width:794px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:16px;margin-bottom:22px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" style="max-height:48px;max-width:140px;object-fit:contain;" />` : ''}
        <div>
          <div style="font-size:24px;font-weight:800;color:${accent};">מסלול המשא ומתן</div>
          <div style="font-size:12px;color:${MUTED};margin-top:4px;">
            ${brand.name ? esc(brand.name) : 'MortgageCRM'}${brand.title ? ` — ${esc(brand.title)}` : ''}
          </div>
        </div>
      </div>
      <div style="font-size:13px;color:#57534e;text-align:left;">
        ${data.customerName ? `<div style="font-weight:700;">${esc(data.customerName)}</div>` : ''}
        <div>תאריך: ${date}</div>
        ${brand.phone ? `<div>${esc(brand.phone)}</div>` : ''}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <thead><tr>
        <th style="${th}text-align:right;">מדד</th>
        ${headerCells}
      </tr></thead>
      <tbody>
        ${row('החזר חודשי', v => formatCurrency(v.monthlyPayment), v => v.monthlyPayment === bestMonthly)}
        ${row('עלות כוללת', v => formatCurrency(v.totalCost), v => v.totalCost === bestTotal)}
        ${row('סכום הלוואה', v => formatCurrency(v.loanAmount))}
        ${row('יחס החזר (DTI)', v => (v.dti > 0 ? `${v.dti}%` : '—'))}
        ${row('LTV', v => (v.ltv > 0 ? `${v.ltv}%` : '—'))}
        ${row('Compliance', v => (v.compliant ? '✓ תקין' : '⚠ חריגה'))}
      </tbody>
    </table>

    ${versions.length > 1 && (savedTotal > 0 || savedMonthly > 0) ? `
    <div style="background:#d1fae5;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;color:${accent};margin-bottom:4px;">מה הושג במשא ומתן</div>
      <div style="font-size:13px;color:${INK};">
        ${savedMonthly > 0 ? `חיסכון של ${formatCurrency(savedMonthly)} בהחזר החודשי` : ''}
        ${savedMonthly > 0 && savedTotal > 0 ? ' · ' : ''}
        ${savedTotal > 0 ? `${formatCurrency(savedTotal)} בעלות הכוללת` : ''}
      </div>
    </div>` : ''}

    <div style="font-size:11px;color:${MUTED};border-top:1px solid ${LINE};padding-top:12px;line-height:1.6;">
      כל גרסה משקפת את הנתונים כפי שהיו בעת שמירתה. הערכים הטובים ביותר מודגשים.
      התנאים הסופיים כפופים לאישור הבנק ולבדיקת זכאות.
      ${brand.licenseNumber ? `<br/>רישיון יועץ: ${esc(brand.licenseNumber)}` : ''}
      ${brand.footerText ? `<br/>${esc(brand.footerText)}` : ''}
    </div>
  </div>`
}

export async function exportVersionComparisonPdf(data: VersionComparisonPdfData): Promise<void> {
  await renderHtmlToPdf(
    buildVersionComparisonHtml(data),
    `mix-versions-${new Date().toISOString().slice(0, 10)}.pdf`,
  )
}

// ── Family economics PDF ─────────────────────────────────────────────────────

export interface FamilyEconomicsPdfData {
  customerName?: string
  income1: number
  income2: number
  mortgagePayment: number
  expenses: { label: string; amount: number }[]
  totalIncome: number
  totalExpenses: number
  totalWithMortgage: number
  remaining: number
  dti: number
  message: string
}

function buildFamilyEconomicsHtml(data: FamilyEconomicsPdfData): string {
  const date = new Date().toLocaleDateString('he-IL')
  const th = `padding:8px 10px;font-size:12px;font-weight:700;color:#ffffff;background:${GREEN};text-align:right;`
  const td = `padding:8px 10px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};text-align:right;`
  const amountTd = `${td}text-align:left;font-weight:700;`

  const expenseRows = data.expenses
    .map(e => `<tr><td style="${td}">${esc(e.label)}</td><td style="${amountTd}">${formatCurrency(e.amount)}</td></tr>`)
    .join('')

  const summaryRow = (label: string, value: string, strong = false) =>
    `<tr><td style="${td}${strong ? 'font-weight:700;' : ''}">${esc(label)}</td><td style="${amountTd}">${value}</td></tr>`

  return `<div dir="rtl" style="font-family:'Heebo','Arial',sans-serif;background:#ffffff;color:${INK};padding:40px;width:794px;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${GREEN};padding-bottom:16px;margin-bottom:22px;">
      <div>
        <div style="font-size:24px;font-weight:800;color:${GREEN};">כלכלת המשפחה</div>
        <div style="font-size:12px;color:${MUTED};margin-top:4px;">ניתוח הכנסות, הוצאות ויכולת עמידה במשכנתא</div>
      </div>
      <div style="font-size:13px;color:#57534e;text-align:left;">
        ${data.customerName ? `<div style="font-weight:700;">${esc(data.customerName)}</div>` : ''}
        <div>תאריך: ${date}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      <thead><tr><th style="${th}">הכנסות</th><th style="${th}text-align:left;">סכום</th></tr></thead>
      <tbody>
        ${summaryRow('הכנסה לווה 1', formatCurrency(data.income1))}
        ${summaryRow('הכנסה לווה 2', formatCurrency(data.income2))}
        ${summaryRow('סה"כ הכנסות', formatCurrency(data.totalIncome), true)}
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      <thead><tr><th style="${th}">הוצאות חודשיות</th><th style="${th}text-align:left;">סכום</th></tr></thead>
      <tbody>
        ${expenseRows}
        ${summaryRow('החזר משכנתא', formatCurrency(data.mortgagePayment))}
        ${summaryRow('סה"כ הוצאות כולל משכנתא', formatCurrency(data.totalWithMortgage), true)}
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <tbody>
        ${summaryRow('נשאר פנוי בחודש', formatCurrency(data.remaining), true)}
        ${summaryRow('שיעור ההחזר מההכנסה', `${data.dti.toFixed(1)}%`, true)}
      </tbody>
    </table>

    <div style="font-size:14px;font-weight:700;color:${GREEN};margin-bottom:18px;">${esc(data.message)}</div>

    <div style="font-size:11px;color:${MUTED};border-top:1px solid ${LINE};padding-top:12px;line-height:1.6;">
      הנתונים מבוססים על הצהרת הלקוח נכון לתאריך ההפקה ואינם מהווים אישור אשראי.
      שיעור ההחזר בפועל ייקבע על ידי הבנק בהתאם לבדיקת הזכאות.
    </div>
  </div>`
}

export async function exportFamilyEconomicsPdf(data: FamilyEconomicsPdfData): Promise<void> {
  await renderHtmlToPdf(
    buildFamilyEconomicsHtml(data),
    `family-economics-${new Date().toISOString().slice(0, 10)}.pdf`,
  )
}
