import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getStorage } from 'firebase-admin/storage'
import Anthropic from '@anthropic-ai/sdk'
import { db, REGION, imageMediaType, checkAiRateLimit } from './common'

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

const MODEL = 'claude-sonnet-4-6'

function anthropic(): Anthropic {
  return new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })
}

function textFrom(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

async function requireOwnedDoc(
  collectionName: string,
  id: string,
  uid: string
): Promise<Record<string, unknown>> {
  const snap = await db.collection(collectionName).doc(id).get()
  if (!snap.exists) throw new HttpsError('not-found', 'הרשומה לא נמצאה')
  const data = snap.data()!
  if (data.user_id !== uid) throw new HttpsError('permission-denied', 'אין הרשאה לרשומה זו')
  return data
}

// ── C.1 — Smart Composer ────────────────────────────────────────────────────

export const composeMessage = onCall(
  { region: REGION, cors: true, secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות')
    // Auth and ownership were enforced; call volume was not. Each Claude call
    // costs money and latency, so cap them per advisor per hour.
    await checkAiRateLimit(request.auth.uid)
    const customerId = request.data?.customer_id
    const purpose = typeof request.data?.purpose === 'string' ? request.data.purpose : 'עדכון ללקוח'
    const tone = typeof request.data?.tone === 'string' ? request.data.tone : 'מקצועי וידידותי'
    if (!customerId || typeof customerId !== 'string') {
      throw new HttpsError('invalid-argument', 'חסר מזהה לקוח')
    }

    const customer = await requireOwnedDoc('customers', customerId, request.auth.uid)

    const msgSnap = await db
      .collection('messages')
      .where('user_id', '==', request.auth.uid)
      .where('customer_id', '==', customerId)
      .get()
    const recent = msgSnap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.sent_at ?? '').localeCompare(String(a.sent_at ?? '')))
      .slice(0, 5)
      .map((m) => `[${m.direction ?? ''}] ${m.content ?? ''}`)

    const customerSummary = {
      name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim(),
      status: customer.status ?? null,
      lead_source: customer.lead_source ?? null,
      monthly_income: customer.monthly_income ?? null,
      notes: customer.notes ?? null,
    }

    const prompt = `אתה יועץ משכנתאות מקצועי בישראל. נסח הודעה אישית ללקוח.
מטרת ההודעה: ${purpose}.
טון נדרש: ${tone}.
פרטי הלקוח: ${JSON.stringify(customerSummary)}.
הודעות אחרונות בשיחה (החדשה ראשונה): ${recent.length ? recent.join(' | ') : 'אין'}.

הנחיות: כתוב הודעה קצרה (2-4 משפטים) בעברית, פנייה אישית בשם הלקוח, מתאימה לשליחה בוואטסאפ.
החזר רק את גוף ההודעה — ללא הקדמה, ללא כותרת וללא הסברים.`

    let response: Anthropic.Message
    try {
      response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })
    } catch (e) {
      console.error('composeMessage: Anthropic API error', e)
      throw new HttpsError('internal', 'שגיאה בניסוח ההודעה. נסה שוב.')
    }
    return { message: textFrom(response).trim() }
  }
)

// ── C.2 — Document Validator ─────────────────────────────────────────────────

const VALIDATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'document_type', 'findings'],
  properties: {
    status: { type: 'string', enum: ['valid', 'issue', 'unclear'] },
    document_type: { type: 'string' },
    findings: { type: 'string' },
  },
}

export const validateDocument = onCall(
  { region: REGION, cors: true, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות')
    // Auth and ownership were enforced; call volume was not. Each Claude call
    // costs money and latency, so cap them per advisor per hour.
    await checkAiRateLimit(request.auth.uid)
    const documentId = request.data?.document_id
    if (!documentId || typeof documentId !== 'string') {
      throw new HttpsError('invalid-argument', 'חסר מזהה מסמך')
    }

    const docData = await requireOwnedDoc('documents', documentId, request.auth.uid)
    const storagePath = docData.storage_path
    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('failed-precondition', 'למסמך אין קובץ מצורף')
    }

    const [buffer] = await getStorage().bucket().file(storagePath).download()
    const base64 = buffer.toString('base64')
    const ext = String(docData.file_name ?? '').split('.').pop()?.toLowerCase()
    const isPdf = ext === 'pdf'

    const prompt = `אתה בודק מסמכים עבור תיק משכנתא בישראל. סוג המסמך הצפוי: "${docData.type ?? 'לא ידוע'}".
בדוק את המסמך המצורף וקבע:
- status: "valid" אם המסמך תקין, ברור ותואם לסוג הצפוי; "issue" אם יש בעיה (מידע חסר, מסמך פג תוקף, אינו תואם לסוג הצפוי); "unclear" אם לא ניתן לקרוא את המסמך.
- document_type: סוג המסמך בפועל כפי שזיהית.
- findings: הסבר קצר בעברית — אם יש בעיה פרט אותה; אם תקין ציין מה אומת.`

    let response: Anthropic.Message
    try {
      response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: 800,
        output_config: {
          format: { type: 'json_schema', schema: VALIDATE_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              isPdf
                ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
                : { type: 'image', source: { type: 'base64', media_type: imageMediaType(ext), data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      })
    } catch (e) {
      console.error('validateDocument: Anthropic API error', e)
      throw new HttpsError('internal', 'שגיאה בבדיקת המסמך. נסה שוב.')
    }

    try {
      return JSON.parse(textFrom(response)) as Record<string, unknown>
    } catch {
      throw new HttpsError('internal', 'לא ניתן היה לנתח את המסמך')
    }
  }
)

// ── C.3 — Mortgage Mix Advisor ───────────────────────────────────────────────

const MIX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rationale', 'risk_level', 'tracks'],
  properties: {
    rationale: { type: 'string' },
    risk_level: { type: 'string', enum: ['נמוך', 'בינוני', 'גבוה'] },
    tracks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'amount', 'interest_rate', 'period_months'],
        properties: {
          type: {
            type: 'string',
            enum: ['פריים', 'קל"צ', 'קל"ב', 'משתנה_צמודה', 'משתנה_לא_צמודה'],
          },
          amount: { type: 'number' },
          interest_rate: { type: 'number' },
          period_months: { type: 'integer' },
        },
      },
    },
  },
}

export const adviseMortgageMix = onCall(
  { region: REGION, cors: true, secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות')
    // Auth and ownership were enforced; call volume was not. Each Claude call
    // costs money and latency, so cap them per advisor per hour.
    await checkAiRateLimit(request.auth.uid)
    const loanAmount = request.data?.loan_amount
    if (typeof loanAmount !== 'number' || loanAmount <= 0) {
      throw new HttpsError('invalid-argument', 'סכום הלוואה לא תקין')
    }
    const monthlyIncome = request.data?.monthly_income
    const propertyType = request.data?.property_type
    const propertyPrice = request.data?.property_price

    const prompt = `אתה יועץ משכנתאות מומחה בישראל. הצע תמהיל משכנתא אופטימלי.
סכום ההלוואה: ${loanAmount} ש"ח.
הכנסה חודשית נטו: ${typeof monthlyIncome === 'number' ? monthlyIncome : 'לא ידוע'} ש"ח.
סוג הנכס: ${propertyType ?? 'לא ידוע'}.
מחיר הנכס: ${typeof propertyPrice === 'number' ? propertyPrice : 'לא ידוע'} ש"ח.

הנחיות מחייבות:
- חלק את ההלוואה ל-2 עד 4 מסלולים. סכום ה-amount של כל המסלולים יחד חייב להיות בדיוק ${loanAmount}.
- עמוד במגבלות בנק ישראל: לפחות שליש מההלוואה במסלול ריבית קבועה (קל"צ או קל"ב); מסלול פריים עד שני שלישים מההלוואה.
- השתמש בריביות ריאליות לשוק המשכנתאות הישראלי הנוכחי.
- ב-rationale הסבר בעברית את ההיגיון מאחורי התמהיל ואת התאמתו לפרופיל הלקוח.
- ב-risk_level דרג את רמת הסיכון הכוללת של התמהיל.`

    let response: Anthropic.Message
    try {
      response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: 1500,
        output_config: {
          format: { type: 'json_schema', schema: MIX_SCHEMA },
        },
        messages: [{ role: 'user', content: prompt }],
      })
    } catch (e) {
      console.error('adviseMortgageMix: Anthropic API error', e)
      throw new HttpsError('internal', 'שגיאה בהפקת ההמלצה. נסה שוב.')
    }

    try {
      return JSON.parse(textFrom(response)) as Record<string, unknown>
    } catch {
      throw new HttpsError('internal', 'לא ניתן היה לנתח את ההמלצה')
    }
  }
)
