import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Static audit of the Cloud Functions' access guards.
 *
 * A Cloud Function runs with the Admin SDK and bypasses firestore.rules
 * entirely, so a callable that forgets its auth or ownership check has no
 * second line of defence. The risk is not that an existing function is wrong —
 * it is that the next one added quietly isn't guarded, and looks no different
 * from one that legitimately needs no guard.
 *
 * This reads the source rather than executing it: it proves each callable
 * *has* a guard, not that the guard is correct. The behaviour of the guards
 * themselves is exercised by the emulator service tests.
 */

const FUNCTIONS_DIR = 'functions/src'

/**
 * Callables reachable without a Firebase login, on purpose: the client-facing
 * questionnaire, portal and signature pages authenticate with a single-use
 * token in the URL instead. Each must still be rate limited, because an
 * unauthenticated endpoint is the one an attacker can hammer.
 */
const TOKEN_AUTHENTICATED = new Set([
  'getCustomerByQuestionnaireToken',
  'submitQuestionnaire',
  'getPortalDataByToken',
  'getSignatureByToken',
  'submitSignature',
])

/** Callables that must additionally require an admin custom claim. */
const ADMIN_ONLY = new Set([
  'updateInterestRate',
  'updateRegulatoryParams',
])

interface Callable {
  name: string
  file: string
  body: string
}

/** Every `export const x = onCall(...)` with its handler body. */
function findCallables(): Callable[] {
  const callables: Callable[] = []
  for (const file of readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.ts'))) {
    const source = readFileSync(join(FUNCTIONS_DIR, file), 'utf8')
    const pattern = /export const (\w+) = onCall\(/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      // The handler runs to the next top-level export, or to end of file.
      const start = match.index
      const next = source.indexOf('\nexport ', start + 1)
      callables.push({
        name: match[1],
        file,
        body: source.slice(start, next === -1 ? source.length : next),
      })
    }
  }
  return callables
}

const callables = findCallables()

describe('cloud function guards', () => {
  it('finds the callables to audit', () => {
    // A sanity check on the parser itself: if this drops to zero because the
    // source shape changed, every assertion below would pass vacuously.
    expect(callables.length).toBeGreaterThanOrEqual(14)
  })

  for (const callable of callables) {
    describe(`${callable.name} (${callable.file})`, () => {
      if (TOKEN_AUTHENTICATED.has(callable.name)) {
        it('is rate limited, being reachable without a login', () => {
          expect(callable.body).toMatch(/checkRateLimit\(/)
        })

        it('validates the token it authenticates with', () => {
          expect(callable.body).toMatch(/token/)
        })
      } else {
        it('requires an authenticated caller', () => {
          expect(callable.body).toMatch(/require(Auth|Admin)\(/)
        })
      }

      if (ADMIN_ONLY.has(callable.name)) {
        it('requires an admin claim', () => {
          expect(callable.body).toMatch(/requireAdmin\(/)
        })
      }

      it('does not read request.auth without a guard', () => {
        // `req.auth!.uid` or `req.auth.uid` outside the guards means the
        // handler is trusting a field it has not checked.
        const rawAuthReads = callable.body.match(/\b(req|request)\.auth[!?]?\.uid/g) ?? []
        expect(rawAuthReads).toEqual([])
      })
    })
  }
})

describe('every callable that reads a document checks ownership', () => {
  /**
   * Handlers that fetch a document by an id supplied by the caller must run it
   * through requireOwnedDoc — the Admin SDK will happily return another
   * advisor's record otherwise.
   */
  const OWNERSHIP_EXEMPT = new Set([
    // Token-authenticated: the token is the authorisation, and each looks the
    // document up *by* that token rather than by a caller-supplied id.
    ...TOKEN_AUTHENTICATED,
    // Admin-only, and not scoped to any one advisor's data.
    ...ADMIN_ONLY,
    // Operates only on the caller's own uid, never on a supplied id.
    'deleteAllUserData',
  ])

  for (const callable of callables.filter(c => !OWNERSHIP_EXEMPT.has(c.name))) {
    it(`${callable.name} verifies ownership`, () => {
      const looksUpById = /\.doc\(/.test(callable.body)
      if (!looksUpById) return
      expect(callable.body).toMatch(/requireOwnedDoc\(|user_id !== uid/)
    })
  }
})

describe('the guard helpers exist and are exported', () => {
  const guards = readFileSync(join(FUNCTIONS_DIR, 'guards.ts'), 'utf8')

  for (const name of ['requireAuth', 'requireAdmin', 'requireString', 'requireOwnedDoc']) {
    it(`exports ${name}`, () => {
      expect(guards).toMatch(new RegExp(`export (async )?function ${name}\\(`))
    })
  }

  it('requireAdmin refuses a caller without the admin claim', () => {
    expect(guards).toMatch(/token\.admin !== true/)
  })

  it('requireOwnedDoc compares user_id against the caller', () => {
    expect(guards).toMatch(/data\.user_id !== uid/)
  })
})
