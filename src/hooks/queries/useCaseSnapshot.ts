import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { customerService } from '@/services/customerService'
import { borrowerService } from '@/services/borrowerService'
import { obligationService } from '@/services/obligationService'
import { appraisalService } from '@/services/appraisalService'
import { documentService } from '@/services/documentService'
import { settingsService } from '@/services/settingsService'
import { regulatoryService } from '@/services/regulatoryService'
import { buildCaseSnapshot, type CaseSnapshot } from '@/utils/caseSnapshot'
import type { MortgageWithTracks } from '@/types/database'

export type { CaseSnapshot } from '@/utils/caseSnapshot'
export { buildCaseSnapshot } from '@/utils/caseSnapshot'

/** Query key, so any mutation can invalidate the whole case in one call. */
export const caseSnapshotKey = (customerId: string) => ['case-snapshot', customerId] as const

/**
 * Loads a case and derives its one computed view.
 *
 * The derivation itself is pure and lives in @/utils/caseSnapshot; this hook
 * only gathers the data it needs.
 */
export function useCaseSnapshot(customerId: string | undefined): UseQueryResult<CaseSnapshot> {
  return useQuery({
    queryKey: caseSnapshotKey(customerId ?? ''),
    enabled: Boolean(customerId),
    queryFn: async (): Promise<CaseSnapshot> => {
      const id = customerId!
      const [
        { data: customer }, { data: borrowers }, { data: obligations },
        { data: appraisals }, { data: documents }, { data: settings },
      ] = await Promise.all([
        customerService.getById(id),
        borrowerService.getByCustomer(id),
        obligationService.getByCustomer(id),
        appraisalService.getByCustomer(id),
        documentService.getByCustomer(id),
        settingsService.get(),
      ])
      if (!customer) throw new Error('התיק לא נמצא')

      const mortgages = (customer.mortgages ?? []) as MortgageWithTracks[]
      const current = [...mortgages]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0]

      // A case is judged by the rules in force when its mix was built.
      const params = await regulatoryService.getInForceAt(current?.created_at ?? new Date())

      const dtiLimits =
        typeof settings?.dti_warn_threshold === 'number' &&
        typeof settings?.dti_hard_threshold === 'number'
          ? { warn: settings.dti_warn_threshold, hard: settings.dti_hard_threshold }
          : undefined

      return buildCaseSnapshot({
        customer,
        borrowers: borrowers ?? [],
        obligations: obligations ?? [],
        documents: documents ?? [],
        appraisals: appraisals ?? [],
        mortgages,
        params,
        dtiLimits,
        obligationMonthsThreshold: settings?.dti_obligation_months_threshold,
      })
    },
  })
}
