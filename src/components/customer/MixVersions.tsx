import { useMemo, useState } from 'react'
import { GitBranch, Download, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui'
import { evaluateMix } from '@/utils/caseEvaluation'
import { settingsService } from '@/services/settingsService'
import type { CaseSnapshot } from '@/utils/caseSnapshot'
import type { MortgageWithTracks } from '@/types/database'
import type { TrackInput } from '@/utils/mortgageCalculations'
import type { MixEvaluation } from '@/utils/caseEvaluation'

/**
 * The negotiation, as a table.
 *
 * A mortgage advisor's work is a sequence: what was asked for, what the bank
 * came back with, what was agreed. The data modelled that only implicitly, so
 * the client had to take the advisor's word for the improvement. Here the
 * rounds sit side by side with the deltas marked, which is the case for the
 * advisor's fee stated in the client's own numbers.
 */

interface Props {
  snapshot: CaseSnapshot
  customerName: string
  onOpenVersion: (mortgageId: string) => void
}

interface Row {
  label: string
  /** Formats a version's value for display. */
  value: (v: VersionColumn) => string
  /** Which direction is an improvement, for highlighting the best column. */
  better?: 'lower' | 'higher'
  raw?: (v: VersionColumn) => number
}

interface VersionColumn {
  mortgage: MortgageWithTracks
  evaluation: MixEvaluation
  /** True when the numbers come from the frozen snapshot rather than a re-run. */
  fromSnapshot: boolean
}

const SOURCE_LABELS: Record<string, string> = {
  advisor: 'יועץ',
  bank_offer: 'הצעת בנק',
  signed: 'נחתם',
}

/** A version's tracks in calculator form. */
function toTracks(mortgage: MortgageWithTracks): TrackInput[] {
  return (mortgage.loan_tracks ?? [])
    .filter(t => !t.is_existing)
    .map(t => ({
      type: t.type,
      amount: t.amount ?? 0,
      interestRate: t.interest_rate ?? 0,
      periodMonths: t.period_months ?? 0,
    }))
}

export function MixVersions({ snapshot, customerName, onOpenVersion }: Props) {
  const [exporting, setExporting] = useState(false)

  // Oldest first: the table reads left to right as the negotiation progressed.
  const columns = useMemo<VersionColumn[]>(() => {
    return [...snapshot.mortgages]
      .sort((a, b) => (a.version ?? 1) - (b.version ?? 1)
        || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .map(mortgage => {
        const tracks = toTracks(mortgage)
        // A version's frozen snapshot is what was on the table at the time; a
        // re-run is only a fallback for versions saved before this existed.
        if (mortgage.snapshot && tracks.length > 0) {
          return {
            mortgage,
            fromSnapshot: true,
            evaluation: {
              loanAmount: tracks.reduce((s, t) => s + t.amount, 0),
              propertyValue: mortgage.property_price ?? 0,
              ltv: mortgage.snapshot.ltv,
              dti: mortgage.snapshot.dti,
              monthlyPayment: mortgage.snapshot.monthly_payment,
              totalCost: mortgage.snapshot.total_cost,
              compliance: (mortgage.snapshot.compliance as unknown as MixEvaluation['compliance'])
                ?? { isValid: true, checks: [] },
              additionalEquityRequired: 0,
            },
          }
        }
        return {
          mortgage,
          fromSnapshot: false,
          evaluation: evaluateMix(tracks, {
            purchasePrice: mortgage.property_price ?? 0,
            propertyType: mortgage.property_type ?? 'דירה_ראשונה',
            appraisedValue: snapshot.appraisal?.appraised_value,
            householdIncome: snapshot.householdIncome,
            monthlyObligations: snapshot.monthlyObligations,
            borrowerBirthDates: snapshot.borrowers.map(b => b.birth_date),
            params: snapshot.params,
          }),
        }
      })
  }, [snapshot])

  const rows: Row[] = [
    {
      label: 'החזר חודשי',
      value: v => formatCurrency(v.evaluation.monthlyPayment),
      raw: v => v.evaluation.monthlyPayment,
      better: 'lower',
    },
    {
      label: 'עלות כוללת',
      value: v => formatCurrency(v.evaluation.totalCost),
      raw: v => v.evaluation.totalCost,
      better: 'lower',
    },
    {
      label: 'סכום הלוואה',
      value: v => formatCurrency(v.evaluation.loanAmount),
    },
    {
      label: 'DTI',
      value: v => v.evaluation.dti > 0 ? `${v.evaluation.dti}%` : '—',
      raw: v => v.evaluation.dti || Infinity,
      better: 'lower',
    },
    {
      label: 'LTV',
      value: v => v.evaluation.ltv > 0 ? `${v.evaluation.ltv}%` : '—',
      raw: v => v.evaluation.ltv || Infinity,
      better: 'lower',
    },
    {
      label: 'Compliance',
      value: v => {
        const checks = v.evaluation.compliance.checks
        if (checks.length === 0) return '—'
        const breach = checks.find(c => !c.isValid && c.severity === 'error')
        if (breach) return `⚠️ ${breach.name}`
        const warning = checks.find(c => !c.isValid)
        return warning ? `⚠️ ${warning.name}` : '✅'
      },
    },
  ]

  /** The column with the best value in a row, when the row has a direction. */
  const bestIndex = (row: Row): number | null => {
    if (!row.raw || !row.better || columns.length < 2) return null
    const values = columns.map(row.raw)
    const target = row.better === 'lower' ? Math.min(...values) : Math.max(...values)
    if (!Number.isFinite(target)) return null
    // Only mark a winner when the versions actually differ.
    if (values.every(v => v === target)) return null
    return values.indexOf(target)
  }

  /** Change against the first version, for every column after it. */
  const deltaFromFirst = (row: Row, index: number): string | null => {
    if (!row.raw || index === 0 || columns.length < 2) return null
    const base = row.raw(columns[0])
    const value = row.raw(columns[index])
    if (!Number.isFinite(base) || !Number.isFinite(value)) return null
    const diff = Math.round((value - base) * 10) / 10
    if (diff === 0) return null
    const formatted = row.label === 'DTI' || row.label === 'LTV'
      ? `${Math.abs(diff)}%`
      : formatCurrency(Math.abs(diff))
    return `${diff > 0 ? '+' : '−'}${formatted}`
  }

  const exportPdf = async () => {
    setExporting(true)
    try {
      const [{ exportVersionComparisonPdf }, { data: settings }] = await Promise.all([
        import('@/utils/pdfExport'),
        settingsService.get(),
      ])
      await exportVersionComparisonPdf({
        customerName,
        branding: settings
          ? {
              name: settings.name,
              title: settings.title,
              licenseNumber: settings.license_number,
              phone: settings.phone,
              email: settings.email,
              logoUrl: settings.logo_url,
              primaryColor: settings.primary_color,
              footerText: settings.footer_text,
            }
          : undefined,
        versions: columns.map(c => ({
          version: c.mortgage.version ?? 1,
          label: c.mortgage.version_label ?? null,
          source: SOURCE_LABELS[c.mortgage.source ?? 'advisor'] ?? '',
          monthlyPayment: c.evaluation.monthlyPayment,
          totalCost: c.evaluation.totalCost,
          loanAmount: c.evaluation.loanAmount,
          dti: c.evaluation.dti,
          ltv: c.evaluation.ltv,
          compliant: c.evaluation.compliance.checks.length === 0
            || c.evaluation.compliance.isValid,
        })),
      })
    } catch (e) {
      toast.error('שגיאה בייצוא ההשוואה', e instanceof Error ? e.message : undefined)
    } finally {
      setExporting(false)
    }
  }

  if (columns.length < 2) return null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <GitBranch size={16} className="text-[#059669]" />
          השוואת גרסאות תמהיל
        </h4>
        <button
          onClick={exportPdf}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 text-sm text-[#059669] hover:text-[#047857] transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          ייצוא PDF
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">מדד</th>
              {columns.map(c => (
                <th key={c.mortgage.id} className="text-right p-3 font-medium text-gray-900 whitespace-nowrap">
                  <button
                    onClick={() => onOpenVersion(c.mortgage.id)}
                    className="text-right hover:text-[#059669] transition-colors"
                  >
                    <span className="block">
                      v{c.mortgage.version ?? 1} {c.mortgage.version_label ?? ''}
                    </span>
                    <span className="block text-xs font-normal text-gray-400">
                      {SOURCE_LABELS[c.mortgage.source ?? 'advisor']} · {formatDate(c.mortgage.created_at)}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const best = bestIndex(row)
              return (
                <tr key={row.label} className="border-b border-gray-50">
                  <td className="p-3 text-gray-600 whitespace-nowrap">{row.label}</td>
                  {columns.map((c, i) => {
                    const delta = deltaFromFirst(row, i)
                    const isBest = best === i
                    return (
                      <td
                        key={c.mortgage.id}
                        className={`p-3 whitespace-nowrap ${isBest ? 'font-bold text-[#047857]' : 'text-gray-900'}`}
                      >
                        {row.value(c)}
                        {delta && (
                          <span
                            className="block text-xs font-normal"
                            style={{ color: delta.startsWith('+') ? '#b45309' : '#059669' }}
                          >
                            {delta}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {columns.some(c => !c.fromSnapshot) && (
        <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          גרסאות שנשמרו לפני הוספת ההיסטוריה מחושבות מחדש לפי נתוני התיק הנוכחיים.
        </p>
      )}
    </div>
  )
}
