import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue } from 'firebase-admin/firestore'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { db, REGION } from './common'

// Configure with: firebase functions:secrets:set WHATSAPP_TOKEN  (etc.)
const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID')
const WHATSAPP_VERIFY_TOKEN = defineSecret('WHATSAPP_VERIFY_TOKEN')
// App Secret from Meta App Dashboard → Settings → Basic — used to verify
// the X-Hub-Signature-256 header on inbound webhook POSTs.
const WHATSAPP_APP_SECRET = defineSecret('WHATSAPP_APP_SECRET')

const GRAPH_API = 'https://graph.facebook.com/v21.0'

/** Normalises an Israeli or international phone to WhatsApp's digits-only international form. */
function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return '972' + digits.slice(1)
  return digits
}

// ── Outbound: send a WhatsApp message ───────────────────────────────────────

export const sendWhatsAppMessage = onCall(
  { region: REGION, cors: true, secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות')
    const customerId = request.data?.customer_id
    const text = request.data?.text
    if (!customerId || typeof customerId !== 'string') {
      throw new HttpsError('invalid-argument', 'חסר מזהה לקוח')
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new HttpsError('invalid-argument', 'תוכן ההודעה ריק')
    }

    const custSnap = await db.collection('customers').doc(customerId).get()
    if (!custSnap.exists) throw new HttpsError('not-found', 'הלקוח לא נמצא')
    const customer = custSnap.data()!
    if (customer.user_id !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'אין הרשאה ללקוח זה')
    }
    const phone = customer.phone
    if (!phone || typeof phone !== 'string') {
      throw new HttpsError('failed-precondition', 'ללקוח אין מספר טלפון')
    }
    const intlPhone = toInternational(phone)

    let providerMessageId: string | null = null
    try {
      const res = await fetch(`${GRAPH_API}/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: intlPhone,
          type: 'text',
          text: { body: text },
        }),
      })
      const body = (await res.json()) as {
        messages?: { id: string }[]
        error?: { message?: string }
      }
      if (!res.ok) {
        throw new HttpsError('internal', body.error?.message || 'שליחת ההודעה נכשלה')
      }
      providerMessageId = body.messages?.[0]?.id ?? null
    } catch (e) {
      if (e instanceof HttpsError) throw e
      console.error('sendWhatsAppMessage: provider error', e)
      throw new HttpsError('internal', 'שגיאת תקשורת עם WhatsApp')
    }

    const msgRef = await db.collection('messages').add({
      user_id: request.auth.uid,
      customer_id: customerId,
      channel: 'וואטסאפ',
      direction: 'נשלח',
      content: text,
      provider_message_id: providerMessageId,
      delivery_status: 'sent',
      read_at: null,
      template_id: null,
      sent_at: FieldValue.serverTimestamp(),
    })

    // Remember the normalised phone so inbound replies can be matched back to this customer.
    await custSnap.ref.update({ whatsapp_phone: intlPhone })

    return { id: msgRef.id, provider_message_id: providerMessageId }
  }
)

// ── Inbound: webhook for replies and delivery receipts ──────────────────────

interface InboundMessage {
  from?: string
  id?: string
  type?: string
  text?: { body?: string }
  button?: { text?: string }
}

interface StatusUpdate {
  id?: string
  status?: string
}

interface WebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: InboundMessage[]; statuses?: StatusUpdate[] }
    }>
  }>
}

async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  const from = String(msg.from ?? '')
  if (!from) return
  const text = msg.text?.body ?? msg.button?.text ?? '[הודעה ללא טקסט]'

  const custSnap = await db
    .collection('customers')
    .where('whatsapp_phone', '==', from)
    .limit(1)
    .get()
  if (custSnap.empty) {
    console.log(`whatsappWebhook: no customer matched for ${from}`)
    return
  }
  const customer = custSnap.docs[0]
  await db.collection('messages').add({
    user_id: customer.data().user_id,
    customer_id: customer.id,
    channel: 'וואטסאפ',
    direction: 'התקבל',
    content: text,
    provider_message_id: msg.id ?? null,
    delivery_status: 'received',
    read_at: null,
    template_id: null,
    sent_at: FieldValue.serverTimestamp(),
  })
}

async function handleStatusUpdate(status: StatusUpdate): Promise<void> {
  if (!status.id || !status.status) return
  const snap = await db
    .collection('messages')
    .where('provider_message_id', '==', status.id)
    .limit(1)
    .get()
  if (snap.empty) return
  const update: Record<string, unknown> = { delivery_status: status.status }
  if (status.status === 'read') update.read_at = FieldValue.serverTimestamp()
  await snap.docs[0].ref.update(update)
}

export const whatsappWebhook = onRequest(
  { region: REGION, secrets: [WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET] },
  async (req, res) => {
    // Verification handshake — Meta sends a GET when the webhook URL is registered.
    if (req.method === 'GET') {
      const mode = req.query['hub.mode']
      const token = req.query['hub.verify_token']
      const challenge = req.query['hub.challenge']
      if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN.value()) {
        res.status(200).send(String(challenge ?? ''))
      } else {
        res.status(403).send('Forbidden')
      }
      return
    }
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    // Verify Meta's HMAC signature before any processing — otherwise anyone
    // who knows the webhook URL can write forged inbound messages.
    const signature = req.get('x-hub-signature-256') ?? ''
    const expected =
      'sha256=' +
      createHmac('sha256', WHATSAPP_APP_SECRET.value())
        .update(req.rawBody) // rawBody is available on Cloud Functions v2 onRequest
        .digest('hex')
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      console.warn('whatsappWebhook: invalid signature')
      res.status(403).send('Forbidden')
      return
    }

    try {
      const body = req.body as WebhookBody
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          for (const msg of change.value?.messages ?? []) {
            await handleInboundMessage(msg)
          }
          for (const status of change.value?.statuses ?? []) {
            await handleStatusUpdate(status)
          }
        }
      }
    } catch (e) {
      console.error('whatsappWebhook: processing error', e)
    }
    // Always acknowledge with 200 so Meta does not retry indefinitely.
    res.status(200).send('OK')
  }
)
