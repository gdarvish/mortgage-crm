import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore'

/**
 * Rules tests. The unit tests cover the arithmetic; nothing covered the
 * boundary between one advisor's data and another's, which is where the
 * damage would be.
 */

const PROJECT_ID = 'mortgage-crm-rules-test'
const ADVISOR_A = 'advisor-a'
const ADVISOR_B = 'advisor-b'

/** Every user-scoped collection, with a minimal valid document for each. */
const USER_SCOPED_COLLECTIONS = [
  'customers', 'leads', 'referral_partners', 'tasks', 'documents', 'mortgages',
  'loan_tracks', 'bank_responses', 'alerts', 'commissions', 'messages',
  'signatures', 'obligations', 'appraisals', 'bank_offers', 'borrowers',
  'meetings', 'disbursements',
] as const

let testEnv: RulesTestEnvironment

/** A Firestore handle authenticated as the given advisor. */
function asAdvisor(uid: string) {
  return testEnv.authenticatedContext(uid).firestore()
}

function asAnonymous() {
  return testEnv.unauthenticatedContext().firestore()
}

/** Seeds one document per collection owned by ADVISOR_A, bypassing the rules. */
async function seedOwnedByA() {
  await testEnv.withSecurityRulesDisabled(async (ctx: RulesTestContext) => {
    const db = ctx.firestore()
    for (const col of USER_SCOPED_COLLECTIONS) {
      await setDoc(doc(db, col, 'seeded'), { user_id: ADVISOR_A, note: 'seed' })
    }
    await setDoc(doc(db, 'interest_rates', 'seeded'), { track_type: 'קל"צ', rate: 4.5 })
    await setDoc(doc(db, 'cpi_index', 'seeded'), { value: 100 })
    await setDoc(doc(db, 'activity', 'seeded'), { user_id: ADVISOR_A })
    await setDoc(doc(db, 'audit_log', 'seeded'), { user_id: ADVISOR_A })
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await seedOwnedByA()
})

describe('ownership isolation', () => {
  for (const col of USER_SCOPED_COLLECTIONS) {
    describe(col, () => {
      it('the owner can read their own document', async () => {
        await assertSucceeds(getDoc(doc(asAdvisor(ADVISOR_A), col, 'seeded')))
      })

      it('another advisor cannot read it', async () => {
        await assertFails(getDoc(doc(asAdvisor(ADVISOR_B), col, 'seeded')))
      })

      it('another advisor cannot update it', async () => {
        await assertFails(updateDoc(doc(asAdvisor(ADVISOR_B), col, 'seeded'), { note: 'taken' }))
      })

      it('another advisor cannot delete it', async () => {
        await assertFails(deleteDoc(doc(asAdvisor(ADVISOR_B), col, 'seeded')))
      })

      it('an anonymous user cannot read it', async () => {
        await assertFails(getDoc(doc(asAnonymous(), col, 'seeded')))
      })

      it('a document cannot be created under someone else’s user_id', async () => {
        await assertFails(
          setDoc(doc(asAdvisor(ADVISOR_B), col, 'forged'), { user_id: ADVISOR_A }),
        )
      })

      // PR-L.3: an update must not hand the document to somebody else.
      it('the owner cannot change user_id on update', async () => {
        await assertFails(
          updateDoc(doc(asAdvisor(ADVISOR_A), col, 'seeded'), { user_id: ADVISOR_B }),
        )
      })

      it('the owner can update other fields', async () => {
        await assertSucceeds(
          updateDoc(doc(asAdvisor(ADVISOR_A), col, 'seeded'), { note: 'edited' }),
        )
      })
    })
  }
})

describe('queries must narrow to the caller', () => {
  // PR-C: rules are not filters. An unscoped collection query is rejected
  // whole, which is exactly how mortgageService silently returned nothing.
  it('an unscoped collection query is rejected', async () => {
    await assertFails(getDocs(collection(asAdvisor(ADVISOR_A), 'mortgages')))
  })

  it('a query scoped to the caller succeeds', async () => {
    await assertSucceeds(getDocs(query(
      collection(asAdvisor(ADVISOR_A), 'mortgages'),
      where('user_id', '==', ADVISOR_A),
    )))
  })

  it('a query scoped to another advisor is rejected', async () => {
    await assertFails(getDocs(query(
      collection(asAdvisor(ADVISOR_A), 'mortgages'),
      where('user_id', '==', ADVISOR_B),
    )))
  })
})

describe('public reference data', () => {
  it('anyone may read interest_rates and cpi_index', async () => {
    await assertSucceeds(getDoc(doc(asAnonymous(), 'interest_rates', 'seeded')))
    await assertSucceeds(getDoc(doc(asAnonymous(), 'cpi_index', 'seeded')))
  })

  it('a client cannot write interest_rates', async () => {
    await assertFails(setDoc(doc(asAdvisor(ADVISOR_A), 'interest_rates', 'forged'), { rate: 1 }))
    await assertFails(updateDoc(doc(asAdvisor(ADVISOR_A), 'interest_rates', 'seeded'), { rate: 1 }))
  })

  it('a client cannot write cpi_index', async () => {
    await assertFails(setDoc(doc(asAdvisor(ADVISOR_A), 'cpi_index', 'forged'), { value: 1 }))
  })
})

describe('function-owned collections', () => {
  it('the owner may read their activity feed and audit log', async () => {
    await assertSucceeds(getDoc(doc(asAdvisor(ADVISOR_A), 'activity', 'seeded')))
    await assertSucceeds(getDoc(doc(asAdvisor(ADVISOR_A), 'audit_log', 'seeded')))
  })

  it('another advisor cannot read them', async () => {
    await assertFails(getDoc(doc(asAdvisor(ADVISOR_B), 'activity', 'seeded')))
    await assertFails(getDoc(doc(asAdvisor(ADVISOR_B), 'audit_log', 'seeded')))
  })

  it('a client cannot write activity or audit_log', async () => {
    await assertFails(setDoc(doc(asAdvisor(ADVISOR_A), 'activity', 'forged'), { user_id: ADVISOR_A }))
    await assertFails(setDoc(doc(asAdvisor(ADVISOR_A), 'audit_log', 'forged'), { user_id: ADVISOR_A }))
  })

  it('a client cannot read or write rate_limits', async () => {
    await assertFails(getDoc(doc(asAdvisor(ADVISOR_A), 'rate_limits', 'x')))
    await assertFails(setDoc(doc(asAdvisor(ADVISOR_A), 'rate_limits', 'x'), { count: 0 }))
  })
})

describe('per-advisor settings', () => {
  it('an advisor can write their own settings', async () => {
    await assertSucceeds(setDoc(
      doc(asAdvisor(ADVISOR_A), 'users', ADVISOR_A, 'advisor_settings', 'profile'),
      { name: 'A' },
    ))
  })

  it('an advisor cannot touch another advisor’s settings', async () => {
    await assertFails(setDoc(
      doc(asAdvisor(ADVISOR_B), 'users', ADVISOR_A, 'advisor_settings', 'profile'),
      { name: 'B' },
    ))
    await assertFails(getDoc(
      doc(asAdvisor(ADVISOR_B), 'users', ADVISOR_A, 'advisor_settings', 'profile'),
    ))
  })
})
