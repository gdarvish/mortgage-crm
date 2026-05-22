import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db, REGION } from './common'

type AuditEntityType = 'customer' | 'lead' | 'mortgage' | 'document'

// Timestamps change on almost every write and are not meaningful history.
const IGNORED_FIELDS = ['updated_at', 'created_at']

function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if (IGNORED_FIELDS.includes(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key] ?? null, to: after[key] ?? null }
    }
  }
  return changes
}

function makeAuditTrigger(entityType: AuditEntityType, collection: string) {
  return onDocumentUpdated({ document: `${collection}/{id}`, region: REGION }, async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    const changes = diffFields(before, after)
    const changedFields = Object.keys(changes)
    if (changedFields.length === 0) return
    await db.collection('audit_log').add({
      user_id: after.user_id ?? before.user_id ?? null,
      entity_type: entityType,
      entity_id: event.params.id,
      changes,
      changed_fields: changedFields,
      changed_at: FieldValue.serverTimestamp(),
    })
  })
}

export const auditCustomerChanges = makeAuditTrigger('customer', 'customers')
export const auditLeadChanges = makeAuditTrigger('lead', 'leads')
export const auditMortgageChanges = makeAuditTrigger('mortgage', 'mortgages')
export const auditDocumentChanges = makeAuditTrigger('document', 'documents')
