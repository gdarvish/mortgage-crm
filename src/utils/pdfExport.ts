import { formatCurrency } from '@/lib/utils'

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
    <td style="padding:7px 10px;color:${MUTED};font-size:13px;border-bottom:1px solid #f5f4f2;">${label}</td>
    <td style="padding:7px 10px;color:${INK};font-size:13px;font-weight:700;border-bottom:1px solid #f5f4f2;text-align:left;">${value}</td>
  </tr>`
}

function buildHtml(data: MortgagePdfData): string {
  const date = new Date().toLocaleDateString('he-IL')
  const th = `padding:8px 10px;font-size:12px;font-weight:700;color:#ffffff;background:${GREEN};text-align:right;`
  const td = `padding:8px 10px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};text-align:right;`

  const trackRows = data.tracks
    .map(
      (t) => `<tr>
        <td style="${td}">${t.type}</td>
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
        <td style="${td}">${c.name}</td>
        <td style="${td}" dir="ltr">${c.value}%</td>
        <td style="${td}" dir="ltr">${c.limit}%</td>
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
        ${data.customerName ? `<div style="font-weight:700;">${data.customerName}</div>` : ''}
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

export async function exportMortgagePdf(data: MortgagePdfData): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro'),
  ])

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = '794px'
  container.innerHTML = buildHtml(data)
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
    pdf.save(`mortgage-proposal-${new Date().toISOString().slice(0, 10)}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
