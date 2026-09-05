// Usage: node scripts/migrate-dti-override.mjs [--apply] [--threshold 18]
// Requires: GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.
//
// Backfills `dti_override` on existing obligations.
//
// `include_in_dti` used to be computed once, at data entry, and then went stale
// as the end date approached. Inclusion is now derived on every read, so the
// stored flag is only worth preserving where it *disagrees* with what the rule
// would say today — that disagreement is the advisor having decided something
// deliberately. Everywhere else the record gets `dti_override: null` and simply
// follows the rule.
//
// Runs as a dry run by default; pass --apply to write.
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const thresholdArg = process.argv.indexOf('--threshold')
const thresholdMonths = thresholdArg > -1 ? Number(process.argv[thresholdArg + 1]) : 18

if (!Number.isFinite(thresholdMonths) || thresholdMonths <= 0) {
  console.error('--threshold must be a positive number of months')
  process.exit(1)
}

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

/** Mirror of shouldIncludeInDti in src/services/obligationService.ts. */
function shouldIncludeInDti(endDate) {
  if (!endDate) return true
  const end = new Date(endDate).getTime()
  if (Number.isNaN(end)) return true
  return end > Date.now() + thresholdMonths * 30.44 * 24 * 60 * 60 * 1000
}

const snap = await db.collection('obligations').get()
let pinned = 0
let auto = 0
let skipped = 0
let batch = db.batch()
let pending = 0

for (const doc of snap.docs) {
  const data = doc.data()
  if (data.dti_override !== undefined) {
    skipped++
    continue
  }
  const autoValue = shouldIncludeInDti(data.end_date ?? null)
  const stored = data.include_in_dti === true
  // Only a stored flag that contradicts the rule represents a real decision.
  const override = stored === autoValue ? null : stored
  if (override === null) auto++
  else pinned++

  if (apply) {
    batch.update(doc.ref, { dti_override: override })
    if (++pending === 400) {
      await batch.commit()
      batch = db.batch()
      pending = 0
    }
  }
}

if (apply && pending > 0) await batch.commit()

console.log(`obligations scanned: ${snap.size}`)
console.log(`  already migrated (skipped): ${skipped}`)
console.log(`  set to null (follow the ${thresholdMonths}-month rule): ${auto}`)
console.log(`  pinned to an explicit override: ${pinned}`)
console.log(apply ? 'changes written' : 'dry run — re-run with --apply to write')
