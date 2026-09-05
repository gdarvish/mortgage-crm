import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fromDocs, toError, type FirestoreError } from '@/services/_firestoreHelpers'
import {
  paramsInForceAt,
  FALLBACK_REGULATORY_PARAMS,
  type RegulatoryParams,
} from '@/utils/regulatoryParams'

const COL = 'regulatory_params'

/**
 * Regulatory parameters are public reference data, exactly like interest_rates:
 * readable by anyone, writable only by an admin through a Cloud Function. They
 * are not user-scoped, so there is no user_id to narrow by.
 */
export const regulatoryService = {
  async getAll(): Promise<{ data: RegulatoryParams[]; error: FirestoreError | null }> {
    try {
      const snap = await getDocs(query(collection(db, COL), orderBy('effective_from', 'desc')))
      return { data: fromDocs<RegulatoryParams>(snap.docs), error: null }
    } catch (e) {
      // Never leave a caller without usable limits — fall back rather than fail.
      return { data: [], error: toError(e) }
    }
  },

  /**
   * The parameters in force on a given date. Pass a case's created_at to judge
   * it by the rules that applied when it was opened, rather than repainting it
   * the day the regulator moves the numbers.
   */
  async getInForceAt(at: string | Date = new Date()): Promise<RegulatoryParams> {
    const { data } = await this.getAll()
    return data.length > 0 ? paramsInForceAt(data, at) : FALLBACK_REGULATORY_PARAMS
  },
}
