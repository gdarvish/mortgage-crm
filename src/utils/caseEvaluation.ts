import {
  checkCompliance,
  effectiveMonthlyPayment,
  effectivePropertyValue,
  trackTotalCost,
  additionalEquityRequired,
  type ComplianceResult,
  type DtiLimits,
  type TrackInput,
} from '@/utils/mortgageCalculations'
import { FALLBACK_REGULATORY_PARAMS, type RegulatoryParams } from '@/utils/regulatoryParams'
import type { PropertyType } from '@/types/database'

/**
 * Everything about a case that a mix is judged against — income, obligations,
 * the property, the borrowers, the rules in force. Assembled once, from the
 * case snapshot, so no screen has to gather it for itself.
 */
export interface MixContext {
  purchasePrice: number
  propertyType: PropertyType
  /** From a received appraisal, when there is one. */
  appraisedValue?: number | null
  householdIncome: number
  monthlyObligations: number
  borrowerBirthDates?: (string | null | undefined)[]
  /** An advisor's own thresholds, when stricter than the regulator's. */
  dtiLimits?: DtiLimits
  params?: RegulatoryParams
}

/** The numbers a mix produces in a given case. */
export interface MixEvaluation {
  loanAmount: number
  propertyValue: number
  ltv: number
  dti: number
  monthlyPayment: number
  totalCost: number
  compliance: ComplianceResult
  additionalEquityRequired: number
}

/**
 * Judges a mix against a case.
 *
 * The single implementation of how a mix is scored: the case snapshot uses it
 * for the saved mix, and the calculator uses it for the draft being edited.
 * Two screens can therefore disagree about a mix only if they were handed
 * different mixes — never because they compute it differently.
 */
export function evaluateMix(tracks: TrackInput[], context: MixContext): MixEvaluation {
  const params = context.params ?? FALLBACK_REGULATORY_PARAMS
  const loanAmount = tracks.reduce((sum, t) => sum + t.amount, 0)
  const monthlyPayment = tracks.reduce((sum, t) => sum + effectiveMonthlyPayment(t), 0)
  const totalCost = tracks.reduce((sum, t) => sum + trackTotalCost(t), 0)

  const propertyValue = effectivePropertyValue(context.purchasePrice, context.appraisedValue)
  const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0
  const dti = context.householdIncome > 0
    ? ((monthlyPayment + context.monthlyObligations) / context.householdIncome) * 100
    : 0

  const compliance = checkCompliance(
    tracks,
    context.purchasePrice,
    context.propertyType,
    context.householdIncome,
    context.monthlyObligations,
    context.appraisedValue ?? null,
    context.borrowerBirthDates,
    context.dtiLimits,
    params,
  )

  const lowAppraisal = context.appraisedValue && context.appraisedValue < context.purchasePrice

  return {
    loanAmount,
    propertyValue,
    ltv: Math.round(ltv * 10) / 10,
    dti: Math.round(dti * 10) / 10,
    monthlyPayment: Math.round(monthlyPayment),
    totalCost: Math.round(totalCost),
    compliance,
    additionalEquityRequired: lowAppraisal
      ? additionalEquityRequired(
          loanAmount, context.purchasePrice, context.appraisedValue!, context.propertyType, params,
        )
      : 0,
  }
}
