import { totalHouseholdIncome } from '@/utils/householdIncome'
import { totalMonthlyObligations } from '@/utils/dti'
import { getChecklist } from '@/utils/documentChecklist'
import { evaluateMix } from '@/utils/caseEvaluation'
import type { ComplianceResult, DtiLimits, TrackInput } from '@/utils/mortgageCalculations'
import type { RegulatoryParams } from '@/utils/regulatoryParams'
import type {
  Customer, Borrower, Obligation, Appraisal, Document, MortgageWithTracks,
} from '@/types/database'

/**
 * One computed view of a case, for every screen that shows a number about it.
 *
 * Before this, each screen derived its own: three sources for obligations
 * (the collection, the questionnaire field, a free-standing input), two for
 * property value (purchase price, appraisal), two for the monthly payment
 * (the stored loan_track figure and a live calculation). That is why the same
 * case could read differently depending on which tab you were looking at —
 * the defects were structural, not arithmetic.
 *
 * Everything derived lives here. No screen computes DTI or LTV for itself.
 */
export interface CaseSnapshot {
  customer: Customer
  borrowers: Borrower[]
  obligations: Obligation[]
  documents: Document[]
  /** The case's current mix — the most recently created one. */
  mortgage: MortgageWithTracks | null
  /** Every mix on the case, newest first. */
  mortgages: MortgageWithTracks[]
  /** The most recent appraisal that has actually come back. */
  appraisal: Appraisal | null
  /** The regulatory limits in force for this case, by its mix's date. */
  params: RegulatoryParams

  // ── Derived — the single source of truth ──
  /** Primary borrower plus co-borrowers; guarantors never add income. */
  householdIncome: number
  /** Obligations counted right now, under the 18-month rule. */
  monthlyObligations: number
  /** What the bank lends against: the lower of purchase price and appraisal. */
  propertyValue: number
  loanAmount: number
  ltv: number
  dti: number
  monthlyPayment: number
  totalCost: number
  compliance: ComplianceResult
  /** Extra equity demanded by an appraisal below the purchase price. */
  additionalEquityRequired: number
  /** Checklist items with no matching uploaded document. */
  missingDocuments: string[]
  requiredDocumentCount: number
  uploadedDocumentCount: number
  /** Days until the principle approval expires; null when there is none. */
  approvalDaysLeft: number | null
}

const DAY_MS = 86_400_000

/** The mix's tracks in calculator form, ignoring pre-existing loans. */
function toTrackInputs(mortgage: MortgageWithTracks | null): TrackInput[] {
  return (mortgage?.loan_tracks ?? [])
    .filter(t => !t.is_existing)
    .map(t => ({
      type: t.type,
      amount: t.amount ?? 0,
      interestRate: t.interest_rate ?? 0,
      periodMonths: t.period_months ?? 0,
    }))
}

/**
 * Checklist entries not yet satisfied by an uploaded document.
 *
 * Matching is by document type, which is what the upload form records, and
 * a document that is missing or expired does not count as satisfying it.
 */
function missingDocumentTypes(
  customer: Customer,
  borrowers: Borrower[],
  documents: Document[],
): { missing: string[]; required: number; uploaded: number } {
  const primaryEmployment: 'שכיר' | 'עצמאי' =
    customer.employment_type === 'עצמאי' ? 'עצמאי' : 'שכיר'
  const checklist = getChecklist([
    { name: `${customer.first_name} ${customer.last_name}`, employmentType: primaryEmployment },
    ...borrowers
      .filter(b => b.role === 'לווה שני')
      .map(b => ({
        name: `${b.first_name} ${b.last_name}`,
        employmentType: (b.employment_type === 'עצמאי' ? 'עצמאי' : 'שכיר') as 'שכיר' | 'עצמאי',
      })),
  ])

  const satisfied = new Set(
    documents.filter(d => d.status !== 'חסר' && d.status !== 'פג תוקף').map(d => d.type),
  )
  const missing = checklist.map(c => c.type).filter(type => !satisfied.has(type))
  return {
    missing,
    required: checklist.length,
    uploaded: checklist.length - missing.length,
  }
}

/** Builds the snapshot from already-loaded case data. Pure, so it is testable. */
export function buildCaseSnapshot(input: {
  customer: Customer
  borrowers: Borrower[]
  obligations: Obligation[]
  documents: Document[]
  appraisals: Appraisal[]
  mortgages: MortgageWithTracks[]
  params: RegulatoryParams
  dtiLimits?: DtiLimits
  obligationMonthsThreshold?: number
}): CaseSnapshot {
  const { customer, borrowers, obligations, documents, appraisals, mortgages, params } = input

  // The case's current mix is the most recently created one.
  const sortedMortgages = [...mortgages]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  const mortgage = sortedMortgages[0] ?? null

  const appraisal = appraisals
    .filter(a => a.status === 'התקבלה' && a.appraised_value)
    .sort((a, b) => (b.received_at ?? '').localeCompare(a.received_at ?? ''))[0] ?? null

  const tracks = toTrackInputs(mortgage)
  const householdIncome = totalHouseholdIncome(
    customer.monthly_income, customer.partner_income, borrowers,
  )
  const monthlyObligations = obligations.length > 0
    ? totalMonthlyObligations(obligations, input.obligationMonthsThreshold ?? params.dti_obligation_months)
    : (customer.existing_obligations ?? 0)

  const purchasePrice = mortgage?.property_price ?? customer.requested_amount ?? 0
  const propertyType = mortgage?.property_type ?? 'דירה_ראשונה'

  // The same evaluation the calculator runs on a draft mix.
  const evaluation = evaluateMix(tracks, {
    purchasePrice,
    propertyType,
    appraisedValue: appraisal?.appraised_value,
    householdIncome,
    monthlyObligations,
    borrowerBirthDates: borrowers.map(b => b.birth_date),
    dtiLimits: input.dtiLimits,
    params,
  })

  const docs = missingDocumentTypes(customer, borrowers, documents)

  const approvalExpiry = mortgage?.approval_expires_at
  const approvalDaysLeft = approvalExpiry && !Number.isNaN(new Date(approvalExpiry).getTime())
    ? Math.round((new Date(approvalExpiry).getTime() - Date.now()) / DAY_MS)
    : null

  return {
    customer,
    borrowers,
    obligations,
    documents,
    mortgage,
    mortgages: sortedMortgages,
    appraisal,
    params,
    householdIncome,
    monthlyObligations,
    propertyValue: evaluation.propertyValue,
    // A mix with no tracks still has the loan amount recorded on the mortgage.
    loanAmount: evaluation.loanAmount || (mortgage?.loan_amount ?? 0),
    ltv: evaluation.ltv,
    dti: evaluation.dti,
    monthlyPayment: evaluation.monthlyPayment,
    totalCost: evaluation.totalCost,
    compliance: evaluation.compliance,
    additionalEquityRequired: evaluation.additionalEquityRequired,
    missingDocuments: docs.missing,
    requiredDocumentCount: docs.required,
    uploadedDocumentCount: docs.uploaded,
    approvalDaysLeft,
  }
}
