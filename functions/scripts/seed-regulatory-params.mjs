// Usage: node scripts/seed-regulatory-params.mjs [--apply] [--effective-from 2024-01-01]
// Requires: GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.
//
// Publishes an initial regulatory_params record from the values the code
// carried before this layer existed.
//
// ⚠ These are the defaults that were hard-coded, not authority. Verify every
// one against the current הוראת ניהול בנקאי תקין and צו הבנקאות (עמלות פירעון
// מוקדם), correct them here, and only then publish. Records are append-only:
// to change a value later, publish a new record with a new effective_from
// rather than editing this one, so historical cases keep their own rules.
//
// Runs as a dry run by default; pass --apply to write.
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const fromArg = process.argv.indexOf('--effective-from')
// Backdated by default so existing cases resolve to this record rather than
// falling through to the built-in defaults.
const effectiveFrom = fromArg > -1 ? process.argv[fromArg + 1] : '2020-01-01'

if (Number.isNaN(new Date(effectiveFrom).getTime())) {
  console.error(`--effective-from is not a valid date: ${effectiveFrom}`)
  process.exit(1)
}

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

const record = {
  effective_from: new Date(effectiveFrom).toISOString(),
  ltv_first_home: 75,
  ltv_upgrader: 70,
  ltv_investment: 50,
  min_fixed_percent: 33.3,
  max_prime_percent: 66.6,
  max_variable_percent: 66.6,
  max_period_months: 360,
  dti_warn_threshold: 40,
  dti_hard_threshold: 50,
  max_age_at_term: 85,
  dti_obligation_months: 18,
  prepay_seniority_discounts: [
    { years: 5, discount: 0.3 },
    { years: 3, discount: 0.2 },
  ],
  prepay_early_notice_discount: 0.1,
  source_note: 'ערכי ברירת מחדל שהיו מקודדים בקוד — טעונים אימות מול ההוראות העדכניות',
  updated_by: 'seed-script',
}

const existing = await db.collection('regulatory_params').limit(1).get()
if (!existing.empty) {
  console.log('regulatory_params already has records — nothing seeded.')
  console.log('Publish a new record through updateRegulatoryParams instead of re-seeding.')
  process.exit(0)
}

console.log(JSON.stringify(record, null, 2))
if (apply) {
  const ref = await db.collection('regulatory_params').add({
    ...record,
    created_at: FieldValue.serverTimestamp(),
  })
  console.log(`published as ${ref.id}`)
} else {
  console.log('dry run — re-run with --apply to write')
}
