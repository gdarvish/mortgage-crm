import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { randomUUID } from 'node:crypto'
import { db, REGION } from './common'

// Feature functions live in separate modules.
export * from './activity'
export * from './audit'
export * from './ocr'
export * from './ai'
export * from './whatsapp'

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

/** Rate limiter פשוט מבוסס Firestore — חלון קבוע פר מזהה (IP). */
async function checkRateLimit(qualifier: string, maxCalls = 10, windowSec = 60): Promise<void> {
  const ref = db.collection('rate_limits').doc(qualifier.replace(/\//g, '_'))
  const now = Date.now()
  await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data()
    let count = 1
    let windowStart = now
    if (data && typeof data.windowStart === 'number' && now - data.windowStart < windowSec * 1000) {
      count = (data.count ?? 0) + 1
      windowStart = data.windowStart
    }
    if (count > maxCalls) {
      throw new HttpsError('resource-exhausted', 'יותר מדי בקשות. נסה שוב בעוד דקה.')
    }
    tx.set(ref, { count, windowStart })
  })
}

/** אימות reCAPTCHA v3. אם RECAPTCHA_SECRET_KEY לא מוגדר — מדלגים על הבדיקה. */
async function verifyRecaptcha(token: unknown): Promise<void> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) return
  if (!token || typeof token !== 'string') {
    throw new HttpsError('permission-denied', 'reCAPTCHA token missing')
  }
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
  })
  const result = (await res.json()) as { success?: boolean; score?: number }
  if (!result.success || (result.score ?? 0) < 0.5) {
    throw new HttpsError('permission-denied', 'reCAPTCHA verification failed')
  }
}

function clientIp(req: { rawRequest?: { ip?: string } }): string {
  return req.rawRequest?.ip ?? 'unknown'
}

export const getCustomerByQuestionnaireToken = onCall({ region: REGION }, async (req) => {
  await checkRateLimit('q_get:' + clientIp(req))
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
    employment_type: data.employment_type ?? null,
    has_existing_property: data.has_existing_property ?? null,
    existing_property_value: data.existing_property_value ?? null,
    credit_card_frames: data.credit_card_frames ?? null,
    mortgage_purpose: data.mortgage_purpose ?? null,
    requested_amount: data.requested_amount ?? null,
  }
})

const STRING_FIELDS = [
  'first_name', 'last_name', 'id_number', 'phone', 'email',
  'address', 'marital_status', 'notes', 'employment_type', 'mortgage_purpose',
] as const

const NUMBER_FIELDS = [
  'children', 'monthly_income', 'partner_income', 'own_capital',
  'existing_obligations', 'existing_property_value', 'credit_card_frames',
  'requested_amount',
] as const

const BOOLEAN_FIELDS = ['has_existing_property'] as const

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of STRING_FIELDS) {
    if (key in payload) {
      const v = payload[key]
      if (typeof v !== 'string' || v.length > 500) {
        throw new HttpsError('invalid-argument', `שדה ${key} אינו תקין`)
      }
      out[key] = v.trim()
    }
  }
  for (const key of NUMBER_FIELDS) {
    if (key in payload) {
      const v = payload[key]
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100_000_000) {
        throw new HttpsError('invalid-argument', `שדה ${key} אינו תקין`)
      }
      out[key] = v
    }
  }
  for (const key of BOOLEAN_FIELDS) {
    if (key in payload) {
      const v = payload[key]
      if (typeof v !== 'boolean') {
        throw new HttpsError('invalid-argument', `שדה ${key} אינו תקין`)
      }
      out[key] = v
    }
  }
  return out
}

export const submitQuestionnaire = onCall({ region: REGION }, async (req) => {
  await checkRateLimit('q_submit:' + clientIp(req))
  const { token, payload, recaptcha_token } = req.data ?? {}
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  if (!payload || typeof payload !== 'object') {
    throw new HttpsError('invalid-argument', 'payload is required')
  }
  await verifyRecaptcha(recaptcha_token)
  const docSnap = await findCustomerByToken(token)
  if (!docSnap) throw new HttpsError('not-found', 'Customer not found')
  if (isExpired(docSnap.data().questionnaire_token_expires_at)) {
    throw new HttpsError('deadline-exceeded', 'Token expired')
  }

  const allowed = sanitizePayload(payload as Record<string, unknown>)
  allowed.questionnaire_completed = true
  // Burn the token after a successful submission.
  allowed.questionnaire_token = null
  allowed.questionnaire_token_expires_at = null
  allowed.updated_at = FieldValue.serverTimestamp()

  await docSnap.ref.update(allowed)
  return { ok: true }
})

export const getPortalDataByToken = onCall({ region: REGION }, async (req) => {
  await checkRateLimit('portal_get:' + clientIp(req))
  const token = req.data?.token
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  const snap = await db.collection('customers')
    .where('portal_token', '==', token).limit(1).get()
  if (snap.empty) throw new HttpsError('not-found', 'Customer not found')
  const custDoc = snap.docs[0]
  const customer = custDoc.data()
  if (isExpired(customer.portal_token_expires_at)) {
    throw new HttpsError('deadline-exceeded', 'Token expired')
  }
  const uid = customer.user_id as string
  const [docsSnap, sigsSnap, settingsSnap] = await Promise.all([
    db.collection('documents').where('customer_id', '==', custDoc.id).get(),
    db.collection('signatures')
      .where('customer_id', '==', custDoc.id)
      .where('status', '==', 'ממתין').get(),
    db.doc(`users/${uid}/advisor_settings/profile`).get(),
  ])
  const advisor = settingsSnap.exists ? settingsSnap.data() : null
  return {
    first_name: customer.first_name ?? '',
    status: customer.status ?? '',
    documents: docsSnap.docs.map((d) => ({
      type: d.data().type ?? '',
      status: d.data().status ?? '',
    })),
    pending_signatures: sigsSnap.docs.map((d) => ({
      document_name: d.data().document_name ?? 'מסמך לחתימה',
      sign_url_token: d.data().token ?? null,
    })),
    advisor: {
      name: advisor?.name ?? '',
      phone: advisor?.phone ?? '',
      title: advisor?.title ?? 'יועץ משכנתאות',
    },
  }
})

export const getSignatureByToken = onCall({ region: REGION }, async (req) => {
  await checkRateLimit('sig_get:' + clientIp(req))
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
  await checkRateLimit('sig_submit:' + clientIp(req))
  const { token, signer_name, signer_id, signature_dataurl, user_agent, recaptcha_token } =
    req.data ?? {}
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  if (!signer_name || !signer_id || !signature_dataurl) {
    throw new HttpsError('invalid-argument', 'Missing required signature fields')
  }
  await verifyRecaptcha(recaptcha_token)

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

async function deleteStorageForCustomer(customerId: string): Promise<void> {
  const bucket = getStorage().bucket()
  const docsSnap = await db.collection('documents')
    .where('customer_id', '==', customerId).get()
  for (const d of docsSnap.docs) {
    const storagePath = d.data().storage_path
    if (storagePath && typeof storagePath === 'string') {
      try { await bucket.file(storagePath).delete() } catch { /* file may not exist */ }
    }
  }
  try { await bucket.deleteFiles({ prefix: `documents/${customerId}/` }) } catch { /* ok */ }
  try { await bucket.deleteFiles({ prefix: `signatures/${customerId}/` }) } catch { /* ok */ }
}

export const onCustomerDeleted = onDocumentDeleted(
  { region: REGION, document: 'customers/{customerId}' },
  async (event) => {
    const customerId = event.params.customerId
    await deleteStorageForCustomer(customerId)
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

export const deleteAllUserData = onCall({ region: REGION }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות')
  const uid = req.auth.uid
  const bucket = getStorage().bucket()

  // Collect customer IDs for Storage cleanup
  const custSnap = await db.collection('customers').where('user_id', '==', uid).get()
  for (const cust of custSnap.docs) {
    await deleteStorageForCustomer(cust.id)
  }
  try { await bucket.deleteFiles({ prefix: `logos/${uid}/` }) } catch { /* ok */ }

  const collections = [
    'customers', 'leads', 'tasks', 'alerts', 'commissions', 'documents',
    'messages', 'referral_partners', 'mortgages', 'loan_tracks', 'bank_responses',
    'signatures',
  ]
  for (const col of collections) {
    await deleteWhere(col, 'user_id', uid)
  }

  return { ok: true }
})

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

    // Appraisals ordered more than 14 days ago and still not received.
    const apprCutoff = new Date(now.getTime() - 14 * DAY_MS)
    const appraisals = await db
      .collection('appraisals')
      .where('status', '==', 'הוזמנה')
      .where('ordered_at', '<=', apprCutoff.toISOString())
      .get()
    let apprCreated = 0
    for (const apprDoc of appraisals.docs) {
      const appr = apprDoc.data()
      if (!appr.ordered_at) continue
      const existing = await db
        .collection('alerts')
        .where('appraisal_id', '==', apprDoc.id)
        .where('status', '==', 'פתוח')
        .limit(1)
        .get()
      if (!existing.empty) continue

      const daysWaiting = Math.round((now.getTime() - new Date(appr.ordered_at).getTime()) / DAY_MS)
      await db.collection('alerts').add({
        user_id: appr.user_id,
        customer_id: appr.customer_id,
        mortgage_id: appr.mortgage_id ?? null,
        appraisal_id: apprDoc.id,
        loan_track_id: null,
        document_id: null,
        alert_type: 'appraisal_pending',
        alert_date: now.toISOString(),
        days_until_end: daysWaiting,
        urgency: 'אזהרה',
        status: 'פתוח',
        snoozed_until: null,
        created_at: FieldValue.serverTimestamp(),
      })
      apprCreated++
    }

    // Disbursements planned to be released within 3 days.
    const disbCutoff = new Date(now.getTime() + 3 * DAY_MS)
    const disbursements = await db
      .collection('disbursements')
      .where('status', '==', 'מתוכנן')
      .where('due_date', '<=', disbCutoff.toISOString())
      .get()
    let disbCreated = 0
    for (const dDoc of disbursements.docs) {
      const d = dDoc.data()
      if (!d.due_date) continue
      const existing = await db
        .collection('alerts')
        .where('disbursement_id', '==', dDoc.id)
        .where('status', '==', 'פתוח')
        .limit(1)
        .get()
      if (!existing.empty) continue

      const daysLeft = Math.round((new Date(d.due_date).getTime() - now.getTime()) / DAY_MS)
      await db.collection('alerts').add({
        user_id: d.user_id,
        customer_id: d.customer_id,
        mortgage_id: d.mortgage_id ?? null,
        disbursement_id: dDoc.id,
        loan_track_id: null,
        document_id: null,
        alert_type: 'disbursement_due',
        alert_date: now.toISOString(),
        days_until_end: daysLeft,
        urgency: daysLeft <= 1 ? 'דחוף' : 'אזהרה',
        status: 'פתוח',
        snoozed_until: null,
        created_at: FieldValue.serverTimestamp(),
      })
      disbCreated++
    }

    console.log(`generateAlerts: created ${created} track alerts, ${apprCreated} appraisal alerts, ${disbCreated} disbursement alerts (scanned ${tracks.size} tracks)`)
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

export const generateApprovalAlerts = onSchedule(
  { schedule: 'every day 02:30', timeZone: 'Asia/Jerusalem', region: REGION },
  async () => {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 30 * DAY_MS)

    const mortgages = await db
      .collection('mortgages')
      .where('status', '==', 'אושר')
      .where('approval_expires_at', '>=', now.toISOString())
      .where('approval_expires_at', '<=', cutoff.toISOString())
      .get()

    let created = 0
    for (const mortDoc of mortgages.docs) {
      const mort = mortDoc.data()
      const existing = await db
        .collection('alerts')
        .where('mortgage_id', '==', mortDoc.id)
        .where('alert_type', '==', 'approval_expiring')
        .where('status', '==', 'פתוח')
        .limit(1)
        .get()
      if (!existing.empty) continue

      const daysLeft = Math.round(
        (new Date(mort.approval_expires_at).getTime() - now.getTime()) / DAY_MS,
      )

      await db.collection('alerts').add({
        user_id: mort.user_id,
        customer_id: mort.customer_id,
        mortgage_id: mortDoc.id,
        loan_track_id: null,
        document_id: null,
        alert_type: 'approval_expiring',
        alert_date: now.toISOString(),
        days_until_end: daysLeft,
        urgency: daysLeft < 7 ? 'דחוף' : 'אזהרה',
        status: 'פתוח',
        snoozed_until: null,
        created_at: FieldValue.serverTimestamp(),
      })
      created++
    }
    console.log(`generateApprovalAlerts: created ${created} alerts`)
  }
)

/** Standard monthly payment (annuity). Mirrors the frontend calculation. */
function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0) return 0
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

const REFI_STATION_MONTHS = 60
const DEFAULT_REFI_GAP = 0.5

/** Weekly scan surfacing refinance opportunities on live loan tracks. */
export const scanRefinanceOpportunities = onSchedule(
  { schedule: 'every monday 06:00', timeZone: 'Asia/Jerusalem', region: REGION },
  async () => {
    const now = new Date()

    // Latest published rate per track type.
    const rateSnap = await db.collection('interest_rates').orderBy('effective_date', 'desc').limit(50).get()
    const currentRate = new Map<string, number>()
    for (const r of rateSnap.docs) {
      const d = r.data()
      if (d.track_type && typeof d.rate === 'number' && !currentRate.has(d.track_type)) {
        currentRate.set(d.track_type, d.rate)
      }
    }

    // Per-advisor rate-gap threshold (cached).
    const thresholdCache = new Map<string, number>()
    const gapThreshold = async (uid: string): Promise<number> => {
      if (thresholdCache.has(uid)) return thresholdCache.get(uid)!
      let threshold = DEFAULT_REFI_GAP
      try {
        const s = await db.doc(`users/${uid}/advisor_settings/profile`).get()
        const v = s.data()?.refinance_gap_threshold
        if (typeof v === 'number' && v > 0) threshold = v
      } catch { /* use default */ }
      thresholdCache.set(uid, threshold)
      return threshold
    }

    const variableTypes = ['משתנה_צמודה', 'משתנה_לא_צמודה']
    const tracks = await db.collection('loan_tracks').where('is_existing', '==', true).get()

    let created = 0
    for (const trackDoc of tracks.docs) {
      const t = trackDoc.data()
      const amount = t.amount ?? 0
      const rate = t.interest_rate ?? 0
      const uid = t.user_id
      if (!uid || amount < 100000) continue

      const current = currentRate.get(t.type)
      const threshold = await gapThreshold(uid)

      let reason: 'gap' | 'station' | null = null
      let stationDate: string | null = null
      let monthlySaving = 0

      // Rate-gap trigger.
      if (typeof current === 'number' && rate - current >= threshold) {
        reason = 'gap'
        const remaining = t.period_months ?? 240
        monthlySaving = Math.round(monthlyPayment(amount, rate, remaining) - monthlyPayment(amount, current, remaining))
      }

      // Exit-station trigger for variable tracks.
      if (!reason && variableTypes.includes(t.type) && t.start_date) {
        const start = new Date(t.start_date).getTime()
        if (!Number.isNaN(start)) {
          const monthsSinceStart = (now.getTime() - start) / (30.44 * DAY_MS)
          const nextStation = Math.ceil(monthsSinceStart / REFI_STATION_MONTHS) * REFI_STATION_MONTHS
          const stationTime = start + nextStation * 30.44 * DAY_MS
          const daysToStation = (stationTime - now.getTime()) / DAY_MS
          if (daysToStation >= 0 && daysToStation <= 90) {
            reason = 'station'
            stationDate = new Date(stationTime).toISOString()
          }
        }
      }

      if (!reason) continue

      // Dedup: one open refinance alert per track.
      const existing = await db
        .collection('alerts')
        .where('loan_track_id', '==', trackDoc.id)
        .where('alert_type', '==', 'refinance_opportunity')
        .where('status', '==', 'פתוח')
        .limit(1)
        .get()
      if (!existing.empty) continue

      const mort = await db.collection('mortgages').doc(t.mortgage_id).get()
      const customerId = mort.data()?.customer_id ?? null

      await db.collection('alerts').add({
        user_id: uid,
        customer_id: customerId,
        loan_track_id: trackDoc.id,
        mortgage_id: t.mortgage_id ?? null,
        document_id: null,
        alert_type: 'refinance_opportunity',
        alert_date: now.toISOString(),
        days_until_end: stationDate ? Math.round((new Date(stationDate).getTime() - now.getTime()) / DAY_MS) : 0,
        urgency: 'אזהרה',
        status: 'פתוח',
        snoozed_until: null,
        track_type: t.type,
        track_amount: amount,
        metadata: {
          reason,
          rate_gap: typeof current === 'number' ? Math.round((rate - current) * 100) / 100 : null,
          current_rate: current ?? null,
          monthly_saving: monthlySaving,
          station_date: stationDate,
        },
        created_at: FieldValue.serverTimestamp(),
      })
      created++
    }
    console.log(`scanRefinanceOpportunities: created ${created} alerts (scanned ${tracks.size} tracks)`)
  }
)
