import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import Anthropic from '@anthropic-ai/sdk'
import { db, REGION } from './common'

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function imageMediaType(ext: string | undefined): ImageMediaType {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/png'
  }
}

const OCR_PROMPT = `זהו תלוש שכר ישראלי. חלץ ממנו את הנתונים הבאים:
- employer_name: שם המעסיק
- gross_salary: שכר ברוטו (מספר בלבד, ללא סימני מטבע)
- net_salary: שכר נטו (מספר בלבד, ללא סימני מטבע)
- pay_period: תקופת השכר בפורמט MM/YYYY
- employee_name: שם העובד
- employee_id: מספר תעודת הזהות של העובד
אם שדה כלשהו אינו מופיע במסמך — החזר עבורו null.`

// Structured-output schema — guarantees the model returns valid, parseable JSON.
const OCR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['employer_name', 'gross_salary', 'net_salary', 'pay_period', 'employee_name', 'employee_id'],
  properties: {
    employer_name: { type: ['string', 'null'] },
    gross_salary: { type: ['number', 'null'] },
    net_salary: { type: ['number', 'null'] },
    pay_period: { type: ['string', 'null'] },
    employee_name: { type: ['string', 'null'] },
    employee_id: { type: ['string', 'null'] },
  },
}

export const ocrPayslip = onCall(
  { region: REGION, cors: true, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות')
    const documentId = request.data?.document_id
    if (!documentId || typeof documentId !== 'string') {
      throw new HttpsError('invalid-argument', 'חסר מזהה מסמך')
    }

    const docSnap = await db.collection('documents').doc(documentId).get()
    if (!docSnap.exists) throw new HttpsError('not-found', 'המסמך לא נמצא')
    const docData = docSnap.data()!
    if (docData.user_id !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'אין הרשאה למסמך זה')
    }
    const storagePath = docData.storage_path
    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('failed-precondition', 'למסמך אין קובץ מצורף')
    }

    const [buffer] = await getStorage().bucket().file(storagePath).download()
    const base64 = buffer.toString('base64')
    const ext = String(docData.file_name ?? '').split('.').pop()?.toLowerCase()
    const isPdf = ext === 'pdf'

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

    let response: Anthropic.Message
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        output_config: {
          format: { type: 'json_schema', schema: OCR_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              isPdf
                ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
                : { type: 'image', source: { type: 'base64', media_type: imageMediaType(ext), data: base64 } },
              { type: 'text', text: OCR_PROMPT },
            ],
          },
        ],
      })
    } catch (e) {
      console.error('ocrPayslip: Anthropic API error', e)
      throw new HttpsError('internal', 'שגיאה בעיבוד המסמך. נסה שוב מאוחר יותר.')
    }

    const textBlock = response.content.find((block) => block.type === 'text')
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new HttpsError('internal', 'לא ניתן היה לקרוא את המסמך. נסה להעלות תמונה ברורה יותר.')
    }

    await docSnap.ref.update({
      ocr_data: parsed,
      ocr_completed_at: FieldValue.serverTimestamp(),
    })
    return parsed
  }
)
