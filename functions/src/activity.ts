import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db, REGION } from './common'

type EventType =
  | 'customer_created'
  | 'status_changed'
  | 'document_uploaded'
  | 'mortgage_created'
  | 'signature_received'
  | 'commission_paid'

type EntityType = 'customer' | 'lead' | 'document' | 'mortgage' | 'signature' | 'commission'

async function logActivity(entry: {
  user_id: unknown
  event_type: EventType
  entity_type: EntityType
  entity_id: string
  entity_name: string
  description: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  if (!entry.user_id || typeof entry.user_id !== 'string') return
  await db.collection('activity').add({
    user_id: entry.user_id,
    event_type: entry.event_type,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    entity_name: entry.entity_name,
    description: entry.description,
    metadata: entry.metadata ?? null,
    created_at: FieldValue.serverTimestamp(),
  })
}

export const logCustomerCreated = onDocumentCreated(
  { document: 'customers/{id}', region: REGION },
  async (event) => {
    const data = event.data?.data()
    if (!data) return
    const name = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
    await logActivity({
      user_id: data.user_id,
      event_type: 'customer_created',
      entity_type: 'customer',
      entity_id: event.params.id,
      entity_name: name,
      description: `לקוח חדש נוצר: ${name}`,
    })
  }
)

export const logCustomerStatusChanged = onDocumentUpdated(
  { document: 'customers/{id}', region: REGION },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after || before.status === after.status) return
    const name = `${after.first_name ?? ''} ${after.last_name ?? ''}`.trim()
    await logActivity({
      user_id: after.user_id,
      event_type: 'status_changed',
      entity_type: 'customer',
      entity_id: event.params.id,
      entity_name: name,
      description: `הסטטוס של ${name} שונה מ"${before.status}" ל"${after.status}"`,
      metadata: { from: before.status, to: after.status },
    })
  }
)

export const logDocumentUploaded = onDocumentCreated(
  { document: 'documents/{id}', region: REGION },
  async (event) => {
    const data = event.data?.data()
    if (!data) return
    const type = data.type ?? 'מסמך'
    await logActivity({
      user_id: data.user_id,
      event_type: 'document_uploaded',
      entity_type: 'document',
      entity_id: event.params.id,
      entity_name: type,
      description: `הועלה מסמך: ${type}`,
      metadata: { customer_id: data.customer_id ?? null },
    })
  }
)

export const logMortgageCreated = onDocumentCreated(
  { document: 'mortgages/{id}', region: REGION },
  async (event) => {
    const data = event.data?.data()
    if (!data) return
    await logActivity({
      user_id: data.user_id,
      event_type: 'mortgage_created',
      entity_type: 'mortgage',
      entity_id: event.params.id,
      entity_name: data.type ?? 'משכנתא',
      description: 'נוצר תמהיל משכנתא חדש',
      metadata: { customer_id: data.customer_id ?? null },
    })
  }
)

export const logSignatureReceived = onDocumentUpdated(
  { document: 'signatures/{id}', region: REGION },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    if (before.status === after.status || after.status !== 'נחתם') return
    const name = after.document_name ?? 'מסמך'
    await logActivity({
      user_id: after.user_id,
      event_type: 'signature_received',
      entity_type: 'signature',
      entity_id: event.params.id,
      entity_name: name,
      description: `התקבלה חתימה על "${name}"`,
      metadata: { customer_id: after.customer_id ?? null },
    })
  }
)

export const logCommissionPaid = onDocumentUpdated(
  { document: 'commissions/{id}', region: REGION },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    if (before.status === after.status || after.status !== 'שולם') return
    await logActivity({
      user_id: after.user_id,
      event_type: 'commission_paid',
      entity_type: 'commission',
      entity_id: event.params.id,
      entity_name: 'עמלה',
      description: `עמלה בסך ${after.amount ?? 0} ₪ סומנה כשולמה`,
      metadata: { customer_id: after.customer_id ?? null, amount: after.amount ?? 0 },
    })
  }
)
