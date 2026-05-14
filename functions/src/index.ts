import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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

export const getCustomerByQuestionnaireToken = onCall({ region: REGION }, async (req) => {
  const token = req.data?.token
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  const docSnap = await findCustomerByToken(token)
  if (!docSnap) throw new HttpsError('not-found', 'Customer not found')

  const data = docSnap.data()
  return {
    id: docSnap.id,
    first_name: data.first_name,
    last_name: data.last_name,
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

  const allowed: Record<string, unknown> = {}
  const allowedKeys = [
    'phone', 'email', 'address', 'marital_status', 'children',
    'monthly_income', 'partner_income', 'own_capital', 'existing_obligations', 'notes',
  ]
  for (const key of allowedKeys) {
    if (key in payload) allowed[key] = (payload as Record<string, unknown>)[key]
  }
  allowed.questionnaire_completed = true
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
  return {
    id: docSnap.id,
    customer_id: data.customer_id,
    document_type: data.document_type,
    status: data.status,
  }
})

export const submitSignature = onCall({ region: REGION }, async (req) => {
  const { token, signature_url } = req.data ?? {}
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required')
  }
  if (!signature_url || typeof signature_url !== 'string') {
    throw new HttpsError('invalid-argument', 'signature_url is required')
  }
  const snap = await db.collection('signatures').where('token', '==', token).limit(1).get()
  if (snap.empty) throw new HttpsError('not-found', 'Signature request not found')
  await snap.docs[0].ref.update({
    signature_url,
    signed_at: FieldValue.serverTimestamp(),
    status: 'נחתם',
  })
  return { ok: true }
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
