import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { randomUUID } from 'node:crypto'

initializeApp()
const db = getFirestore()

const REGION = 'europe-west1'

async function findCustomerByToken(token: string) {
  const snap = await db
    .collection('customers')
    .where('questionnaire_token', '==', token)
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0]
}

/** בדיקת תפוגת טוקן. טוקנים ישנים ללא תאריך תפוגה נחשבים תקפים. */
function isExpired(expiresAt: unknown): boolean {
  if (!expiresAt || typeof expiresAt !== 'string') return false
  return new Date(expiresAt).getTime() < Date.now()
}

export const getCustomerByQuestionnaireToken = onCall({ region: REGION }, async (req) => {
  const token = req.data?.token
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  const docSnap = await findCustomerByToken(token)
  if (!docSnap) throw new HttpsError('not-found', 'Customer not found')

  const data = docSnap.data()
  if (isExpired(data.questionnaire_token_expires_at)) {
    throw new HttpsError('deadline-exceeded', 'Token expired')
  }
  return {
    id: docSnap.id,
    first_name: data.first_name ?? '',
    last_name: data.last_name ?? '',
    id_number: data.id_number ?? '',
    phone: data.phone ?? '',
    address: data.address ?? '',
    marital_status: data.marital_status ?? '',
    children: data.children ?? 0,
    monthly_income: data.monthly_income ?? 0,
    partner_income: data.partner_income ?? 0,
    own_capital: data.own_capital ?? 0,
    existing_obligations: data.existing_obligations ?? 0,
    questionnaire_completed: data.questionnaire_completed ?? false,
  }
})

export const submitQuestionnaire = onCall({ region: REGION }, async (req) => {
  const { token, payload } = req.data ?? {}
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  if (!payload || typeof payload !== 'object') {
    throw new HttpsError('invalid-argument', 'payload is required')
  }
  const docSnap = await findCustomerByToken(token)
  if (!docSnap) throw new HttpsError('not-found', 'Customer not found')
  if (isExpired(docSnap.data().questionnaire_token_expires_at)) {
    throw new HttpsError('deadline-exceeded', 'Token expired')
  }

  const allowed: Record<string, unknown> = {}
  const allowedKeys = [
    'first_name', 'last_name', 'id_number',
    'phone', 'email', 'address', 'marital_status', 'children',
    'monthly_income', 'partner_income', 'own_capital', 'existing_obligations', 'notes',
  ]
  for (const key of allowedKeys) {
    if (key in payload) allowed[key] = (payload as Record<string, unknown>)[key]
  }
  allowed.questionnaire_completed = true
  // Burn the token after a successful submission.
  allowed.questionnaire_token = null
  allowed.questionnaire_token_expires_at = null
  allowed.updated_at = FieldValue.serverTimestamp()

  await docSnap.ref.update(allowed)
  return { ok: true }
})

export const getSignatureByToken = onCall({ region: REGION }, async (req) => {
  const token = req.data?.token
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  const snap = await db.collection('signatures').where('token', '==', token).limit(1).get()
  if (snap.empty) throw new HttpsError('not-found', 'Signature request not found')
  const docSnap = snap.docs[0]
  const data = docSnap.data()
  if (data.status === 'נחתם') {
    throw new HttpsError('already-exists', 'Signature already completed')
  }
  if (isExpired(data.token_expires_at)) {
    throw new HttpsError('deadline-exceeded', 'Token expired')
  }
  return {
    id: docSnap.id,
    document_name: data.document_name ?? data.document_type ?? 'מסמך לחתימה',
    customer_name: data.customer_name ?? '',
    document_type: data.document_type ?? null,
  }
})

export const submitSignature = onCall({ region: REGION }, async (req) => {
  const { token, signer_name, signer_id, signature_dataurl, user_agent } = req.data ?? {}
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  if (!signer_name || !signer_id || !signature_dataurl) {
    throw new HttpsError('invalid-argument', 'Missing required signature fields')
  }

  const snap = await db.collection('signatures').where('token', '==', token).limit(1).get()
  if (snap.empty) throw new HttpsError('not-found', 'Signature request not found')
  const sigDoc = snap.docs[0]
  const sigData = sigDoc.data()
  if (sigData.status === 'נחתם') {
    throw new HttpsError('already-exists', 'Signature already completed')
  }
  if (isExpired(sigData.token_expires_at)) {
    throw new HttpsError('deadline-exceeded', 'Token expired')
  }

  // Decode the base64 PNG and upload it to Storage.
  const matches = String(signature_dataurl).match(/^data:image\/png;base64,(.+)$/)
  if (!matches) throw new HttpsError('invalid-argument', 'Invalid signature format')
  const buffer = Buffer.from(matches[1], 'base64')

  const downloadToken = randomUUID()
  const path = `signatures/${sigData.customer_id}/${sigDoc.id}.png`
  const bucket = getStorage().bucket()
  await bucket.file(path).save(buffer, {
    contentType: 'image/png',
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        signer_name: String(signer_name),
        signer_id: String(signer_id),
        signed_at: new Date().toISOString(),
      },
    },
  })
  const signatureUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`

  await sigDoc.ref.update({
    status: 'נחתם',
    signed_at: FieldValue.serverTimestamp(),
    signer_name: String(signer_name),
    signer_id: String(signer_id),
    signature_url: signatureUrl,
    signed_ip: req.rawRequest?.ip ?? 'unknown',
    signed_user_agent: user_agent ? String(user_agent) : null,
    token: null,
  })

  return { ok: true, signature_url: signatureUrl }
})

async function deleteWhere(collection: string, field: string, value: string) {
  const snap = await db.collection(collection).where(field, '==', value).get()
  if (snap.empty) return
  const batches: FirebaseFirestore.WriteBatch[] = []
  let batch = db.batch()
  let count = 0
  for (const doc of snap.docs) {
    batch.delete(doc.ref)
    count += 1
    if (count >= 400) {
      batches.push(batch)
      batch = db.batch()
      count = 0
    }
  }
  batches.push(batch)
  await Promise.all(batches.map((b) => b.commit()))
}

export const onCustomerDeleted = onDocumentDeleted(
  { region: REGION, document: 'customers/{customerId}' },
  async (event) => {
    const customerId = event.params.customerId
    await Promise.all([
      deleteWhere('documents', 'customer_id', customerId),
      deleteWhere('mortgages', 'customer_id', customerId),
      deleteWhere('signatures', 'customer_id', customerId),
      deleteWhere('alerts', 'customer_id', customerId),
      deleteWhere('tasks', 'customer_id', customerId),
      deleteWhere('commissions', 'customer_id', customerId),
      deleteWhere('messages', 'customer_id', customerId),
    ])
  }
)

export const onMortgageDeleted = onDocumentDeleted(
  { region: REGION, document: 'mortgages/{mortgageId}' },
  async (event) => {
    const mortgageId = event.params.mortgageId
    await Promise.all([
      deleteWhere('loan_tracks', 'mortgage_id', mortgageId),
      deleteWhere('bank_responses', 'mortgage_id', mortgageId),
    ])
  }
)

const DAY_MS = 24 * 60 * 60 * 1000

/** יצירת התראות יומית עבור מסלולי הלוואה שמסתיימים בקרוב. */
export const generateAlerts = onSchedule(
  { schedule: 'every day 02:00', timeZone: 'Asia/Jerusalem', region: REGION },
  async () => {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 180 * DAY_MS)

    const tracks = await db
      .collection('loan_tracks')
      .where('end_date', '>=', now.toISOString())
      .where('end_date', '<=', cutoff.toISOString())
      .get()

    let created = 0
    for (const trackDoc of tracks.docs) {
      const track = trackDoc.data()
      // התראות רלוונטיות רק למסלולים בריבית קבועה.
      if (!['קל"צ', 'קל"ב'].includes(track.type)) continue

      const existing = await db
        .collection('alerts')
        .where('loan_track_id', '==', trackDoc.id)
        .where('status', '==', 'פתוח')
        .limit(1)
        .get()
      if (!existing.empty) continue

      const mort = await db.collection('mortgages').doc(track.mortgage_id).get()
      const mortData = mort.data()
      if (!mort.exists || !mortData) continue

      const daysLeft = Math.round((new Date(track.end_date).getTime() - now.getTime()) / DAY_MS)
      const urgency = daysLeft < 60 ? 'דחוף' : daysLeft < 120 ? 'אזהרה' : 'תקין'

      await db.collection('alerts').add({
        user_id: track.user_id,
        customer_id: mortData.customer_id,
        loan_track_id: trackDoc.id,
        mortgage_id: track.mortgage_id,
        document_id: null,
        alert_type: 'track_ending',
        alert_date: now.toISOString(),
        days_until_end: daysLeft,
        urgency,
        status: 'פתוח',
        snoozed_until: null,
        track_type: track.type,
        track_amount: track.amount ?? 0,
        track_end_date: track.end_date,
        created_at: FieldValue.serverTimestamp(),
      })
      created++
    }
    console.log(`generateAlerts: created ${created} alerts (scanned ${tracks.size} tracks)`)
  }
)

/** יצירת התראות יומית עבור מסמכים שתוקפם עומד לפוג, וסימון מסמכים שפג תוקפם. */
export const generateDocumentAlerts = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Asia/Jerusalem', region: REGION },
  async () => {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 30 * DAY_MS)

    const docs = await db
      .collection('documents')
      .where('expires_at', '>=', now.toISOString())
      .where('expires_at', '<=', cutoff.toISOString())
      .get()

    let created = 0
    for (const docSnap of docs.docs) {
      const docData = docSnap.data()
      const existing = await db
        .collection('alerts')
        .where('document_id', '==', docSnap.id)
        .where('status', '==', 'פתוח')
        .limit(1)
        .get()
      if (!existing.empty) continue

      const daysLeft = Math.round((new Date(docData.expires_at).getTime() - now.getTime()) / DAY_MS)

      await db.collection('alerts').add({
        user_id: docData.user_id,
        customer_id: docData.customer_id,
        document_id: docSnap.id,
        loan_track_id: null,
        alert_type: 'document_expiring',
        alert_date: now.toISOString(),
        days_until_end: daysLeft,
        urgency: daysLeft < 7 ? 'דחוף' : 'אזהרה',
        status: 'פתוח',
        snoozed_until: null,
        document_type: docData.type ?? null,
        created_at: FieldValue.serverTimestamp(),
      })
      created++
    }

    // סימון מסמכים שכבר פג תוקפם.
    const expired = await db.collection('documents').where('expires_at', '<', now.toISOString()).get()
    let marked = 0
    for (const docSnap of expired.docs) {
      if (docSnap.data().status !== 'פג תוקף') {
        await docSnap.ref.update({ status: 'פג תוקף' })
        marked++
      }
    }
    console.log(`generateDocumentAlerts: created ${created} alerts, marked ${marked} expired`)
  }
)
