// Usage: node scripts/migrate-document-urls.mjs [--apply]
// Requires: GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key.
//
// Retires the permanent download links on existing documents.
//
// getDownloadURL bakes a `?token=` into the URL that bypasses storage.rules
// entirely, so every link ever handed out — forwarded by mistake, left in
// browser history, captured in a log — reads the payslip or ID behind it
// forever. This clears file_url from every document and rotates the underlying
// Storage token so the old URLs stop resolving. The app mints short-lived
// signed URLs through getDocumentUrl instead.
//
// Runs as a dry run by default; pass --apply to write.
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const apply = process.argv.includes('--apply')

initializeApp({ credential: applicationDefault() })
const db = getFirestore()
const bucket = getStorage().bucket()

/**
 * Revokes the download token on a Storage object. Clearing
 * firebaseStorageDownloadTokens invalidates every URL minted from it.
 */
async function revokeToken(storagePath) {
  const file = bucket.file(storagePath)
  const [exists] = await file.exists()
  if (!exists) return 'missing'
  const [metadata] = await file.getMetadata()
  if (!metadata.metadata?.firebaseStorageDownloadTokens) return 'no-token'
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: '' } })
  return 'revoked'
}

const snap = await db.collection('documents').get()
let cleared = 0
let revoked = 0
let skipped = 0
const failures = []

let batch = db.batch()
let pending = 0

for (const doc of snap.docs) {
  const data = doc.data()
  if (!data.file_url) {
    skipped++
    continue
  }
  cleared++

  if (apply) {
    batch.update(doc.ref, { file_url: null })
    if (++pending === 400) {
      await batch.commit()
      batch = db.batch()
      pending = 0
    }
    if (data.storage_path) {
      try {
        if (await revokeToken(data.storage_path) === 'revoked') revoked++
      } catch (e) {
        // Log the document id only — the storage path embeds the customer id.
        failures.push(doc.id)
        console.error('failed to revoke token for document', doc.id, e.message)
      }
    }
  }
}

if (apply && pending > 0) await batch.commit()

console.log(`documents scanned: ${snap.size}`)
console.log(`  already clean (skipped): ${skipped}`)
console.log(`  file_url cleared: ${cleared}`)
if (apply) {
  console.log(`  storage tokens revoked: ${revoked}`)
  if (failures.length > 0) console.log(`  revocation failures: ${failures.length}`)
} else {
  console.log('dry run — re-run with --apply to write')
}
