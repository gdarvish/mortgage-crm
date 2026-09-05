import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue } from 'firebase-admin/firestore'
import { createHmac, timingSafeEqual } from 'crypto'
import { db, REGION } from './common'
import { requireAuth } from './guards'

// Configure with: firebase functions:secrets:set WHATSAPP_TOKEN  (etc.)
const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID')
const WHATSAPP_VERIFY_TOKEN = defineSecret('WHATSAPP_VERIFY_TOKEN')
const WHATSAPP_APP_SECRET = defineSecret('WHATSAPP_APP_SECRET')

const GRAPH_API = 'https://graph.facebook.com/v21.0'

/** Normalises an Israeli or international phone to WhatsApp's digits-only international form. */
function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return '972' + digits.slice(1)
  return digits
}

/**
 * Sends a plain-text WhatsApp message via the Graph API and returns the
 * provider message id. Callers must declare WHATSAPP_TOKEN and
 * WHATSAPP_PHONE_NUMBER_ID in their function's `secrets`.
 */
async function sendWaText(phone: string, text: string): Promise<string | null> {
  const intlPhone = toInternational(phone)
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
  const body = (await res.json()) as { messages?: { id: string }[]; error?: { message?: string } }
  if (!res.ok) throw new Error(body.error?.message || 'שליחת ההודעה נכשלה')
  return body.messages?.[0]?.id ?? null
}

function verifyMetaSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// ── Outbound: send a WhatsApp message ───────────────────────────────────────

export const sendWhatsAppMessage = onCall(
  { region: REGION, cors: true, secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID] },
  async (request) => {
    const uid = requireAuth(request)
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
    if (customer.user_id !== uid) {
      throw new HttpsError('permission-denied', 'אין הרשאה ללקוח זה')
    }
    const phone = customer.phone
    if (!phone || typeof phone !== 'string') {
      throw new HttpsError('failed-precondition', 'ללקוח אין מספר טלפון')
    }
    const intlPhone = toInternational(phone)

    let providerMessageId: string | null = null
    try {
      providerMessageId = await sendWaText(phone, text)
    } catch (e) {
      if (e instanceof HttpsError) throw e
      console.error('sendWhatsAppMessage: provider error', e)
      throw new HttpsError('internal', 'שגיאת תקשורת עם WhatsApp')
    }

    const msgRef = await db.collection('messages').add({
      user_id: uid,
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

    const sig = req.headers['x-hub-signature-256'] as string | undefined
    if (!verifyMetaSignature(req.rawBody, sig, WHATSAPP_APP_SECRET.value())) {
      res.status(403).send('Invalid signature')
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

// ── Meeting reminders ────────────────────────────────────────────────────────

/** Daily scan that sends a WhatsApp reminder for tomorrow's planned meetings. */
export const sendMeetingReminders = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'Asia/Jerusalem',
    region: REGION,
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
  },
  async () => {
    const now = new Date()
    const tomorrowStart = new Date(now)
    tomorrowStart.setDate(now.getDate() + 1)
    tomorrowStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrowStart)
    tomorrowEnd.setHours(23, 59, 59, 999)

    const snap = await db
      .collection('meetings')
      .where('status', '==', 'מתוכננת')
      .where('reminder_sent', '==', false)
      .where('starts_at', '>=', tomorrowStart.toISOString())
      .where('starts_at', '<=', tomorrowEnd.toISOString())
      .get()

    let sent = 0
    for (const mdoc of snap.docs) {
      const m = mdoc.data()
      try {
        if (m.customer_id) {
          const cust = await db.collection('customers').doc(m.customer_id).get()
          const c = cust.data()
          const phone = c?.phone
          if (phone && typeof phone === 'string') {
            const time = new Date(m.starts_at).toLocaleTimeString('he-IL', {
              hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
            })
            const locationPart = m.location ? `, ב${m.location}` : ''
            const text = `שלום ${c?.first_name ?? ''}, תזכורת לפגישתנו מחר בשעה ${time}${locationPart}. נתראה!`
            const providerMessageId = await sendWaText(phone, text)
            await db.collection('messages').add({
              user_id: m.user_id,
              customer_id: m.customer_id,
              channel: 'וואטסאפ',
              direction: 'נשלח',
              content: text,
              provider_message_id: providerMessageId,
              delivery_status: 'sent',
              read_at: null,
              template_id: null,
              sent_at: FieldValue.serverTimestamp(),
            })
          }
        }
      } catch (e) {
        // Mark as sent even on partial failure so we do not spam on retries.
        console.error('sendMeetingReminders: failed for', mdoc.id, e)
      }
      await mdoc.ref.update({ reminder_sent: true })
      sent++
    }
    console.log(`sendMeetingReminders: processed ${sent} meetings`)
  }
)
