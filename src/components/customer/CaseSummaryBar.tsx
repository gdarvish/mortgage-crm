import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { CaseSnapshot } from '@/hooks/queries/useCaseSnapshot'

/**
 * The four or five numbers an advisor needs in the first second of opening a
 * case — stage, LTV, DTI, document progress, approval expiry — which were
 * otherwise spread across four separate tabs.
 *
 * Every value comes from the case snapshot, so the bar cannot disagree with
 * the tab beneath it.
 */

interface Chip {
  label: string
  value: string
  tone: 'neutral' | 'good' | 'warn' | 'bad'
  title?: string
}

const TONES: Record<Chip['tone'], { bg: string; fg: string }> = {
  neutral: { bg: '#f5f4f2', fg: '#57534e' },
  good: { bg: '#d1fae5', fg: '#065f46' },
  warn: { bg: '#fef3c7', fg: '#b45309' },
  bad: { bg: '#fee2e2', fg: '#b91c1c' },
}

/** A check's tone: green when clean, amber for a warning, red for a breach. */
function toneForCheck(snapshot: CaseSnapshot, name: string): Chip['tone'] {
  const check = snapshot.compliance.checks.find(c => c.name.includes(name))
  if (!check) return 'neutral'
  if (check.isValid) return 'good'
  return check.severity === 'warning' ? 'warn' : 'bad'
}

export function CaseSummaryBar({ snapshot }: { snapshot: CaseSnapshot }) {
  const { customer, mortgage, approvalDaysLeft } = snapshot

  const chips: Chip[] = [
    { label: 'סטטוס', value: customer.status, tone: 'neutral' },
  ]

  // LTV and DTI only mean something once there is a mix to measure.
  if (mortgage && snapshot.loanAmount > 0) {
    chips.push({
      label: 'LTV',
      value: snapshot.propertyValue > 0 ? `${snapshot.ltv}%` : '—',
      tone: toneForCheck(snapshot, 'LTV'),
      title: snapshot.appraisal
        ? `לפי שווי מחייב של ${snapshot.propertyValue.toLocaleString('he-IL')} ₪ (שמאות)`
        : undefined,
    })
    chips.push({
      label: 'DTI',
      value: snapshot.householdIncome > 0 ? `${snapshot.dti}%` : '—',
      tone: toneForCheck(snapshot, 'החזר'),
      title: `החזר ${snapshot.monthlyPayment.toLocaleString('he-IL')} ₪ + התחייבויות ${snapshot.monthlyObligations.toLocaleString('he-IL')} ₪`,
    })
    chips.push({
      label: 'החזר חודשי',
      value: `${snapshot.monthlyPayment.toLocaleString('he-IL')} ₪`,
      tone: 'neutral',
    })
  }

  chips.push({
    label: 'מסמכים',
    value: `${snapshot.uploadedDocumentCount}/${snapshot.requiredDocumentCount}`,
    tone: snapshot.missingDocuments.length === 0 ? 'good' : 'warn',
    title: snapshot.missingDocuments.length > 0
      ? `חסרים: ${snapshot.missingDocuments.slice(0, 6).join(', ')}${snapshot.missingDocuments.length > 6 ? '…' : ''}`
      : 'כל המסמכים הנדרשים הוגשו',
  })

  if (approvalDaysLeft !== null) {
    chips.push({
      label: 'אישור עקרוני',
      value: approvalDaysLeft <= 0 ? 'פג תוקף' : `${approvalDaysLeft} ימים`,
      tone: approvalDaysLeft <= 0 ? 'bad' : approvalDaysLeft <= 14 ? 'warn' : 'good',
    })
  }

  if (snapshot.additionalEquityRequired > 0) {
    chips.push({
      label: 'הון עצמי נוסף',
      value: `${snapshot.additionalEquityRequired.toLocaleString('he-IL')} ₪`,
      tone: 'warn',
      title: 'השמאות נמוכה ממחיר הרכישה',
    })
  }

  const compliant = snapshot.compliance.isValid

  return (
    <div
      className="sticky top-0 z-20 -mx-1 px-1 py-2 backdrop-blur"
      style={{ background: 'rgba(250,249,247,0.92)' }}
    >
      <div
        className="flex items-center gap-2 flex-wrap rounded-xl border px-3 py-2"
        style={{ borderColor: '#e7e5e4', background: '#ffffff' }}
      >
        <span
          className="inline-flex items-center gap-1.5 text-[12px] font-bold px-2 py-1 rounded-lg shrink-0"
          style={
            mortgage
              ? compliant
                ? { background: '#d1fae5', color: '#065f46' }
                : { background: '#fee2e2', color: '#b91c1c' }
              : { background: '#f5f4f2', color: '#a8a29e' }
          }
          title={mortgage ? undefined : 'אין תמהיל בתיק'}
        >
          {mortgage
            ? compliant
              ? <><CheckCircle size={13} /> תקין</>
              : <><AlertTriangle size={13} /> חריגה</>
            : 'ללא תמהיל'}
        </span>

        {chips.map(chip => {
          const tone = TONES[chip.tone]
          return (
            <span
              key={chip.label}
              title={chip.title}
              className="inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-lg"
              style={{ background: tone.bg, color: tone.fg }}
            >
              <span style={{ opacity: 0.75 }}>{chip.label}</span>
              <span className="font-bold tabular-nums">{chip.value}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
