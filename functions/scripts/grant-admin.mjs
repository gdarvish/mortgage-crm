// Usage: node scripts/grant-admin.mjs <UID>
// Requires: GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

initializeApp({ credential: applicationDefault() })

const uid = process.argv[2]
if (!uid) {
  console.error('Usage: node scripts/grant-admin.mjs <UID>')
  process.exit(1)
}

await getAuth().setCustomUserClaims(uid, { admin: true })
console.log(`admin claim granted to ${uid} — המשתמש צריך להתנתק ולהתחבר מחדש`)
