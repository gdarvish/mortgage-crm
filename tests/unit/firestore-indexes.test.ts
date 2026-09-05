import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Static index coverage.
 *
 * The Firestore emulator serves any query regardless of declared indexes, so
 * a missing composite index cannot be caught by an emulator test — it only
 * surfaces as `failed-precondition` against the real database, which is
 * exactly how the referral and commission pages came to be broken in
 * production while every test passed.
 *
 * Instead, every composite query the app issues is declared here and checked
 * against firestore.indexes.json. Adding a query means adding a line; CI then
 * tells you if the index is missing, before deploy rather than after.
 */

interface DeclaredIndex {
  collectionGroup: string
  queryScope: string
  fields: { fieldPath: string; order?: string; arrayConfig?: string }[]
}

const declared: DeclaredIndex[] = JSON.parse(
  readFileSync('firestore.indexes.json', 'utf8'),
).indexes

/** A query the code issues: equality fields, then the ordered field. */
interface QueryShape {
  where: string
  collection: string
  equality: string[]
  orderBy?: { field: string; direction: 'asc' | 'desc' }
}

/**
 * Firestore needs a composite index when a query combines any filter with an
 * orderBy on a different field, or filters on more than one field with a
 * range. Equality-only conjunctions are served by index merging and need
 * nothing declared, so they are not listed.
 */
const QUERIES: QueryShape[] = [
  // ── PR-D: the two that failed in production ──
  { where: 'referralService.getAll', collection: 'referral_partners', equality: ['user_id'], orderBy: { field: 'total_referrals', direction: 'desc' } },
  { where: 'commissionService.getAll', collection: 'commissions', equality: ['user_id'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'commissionService.getAll (status filter)', collection: 'commissions', equality: ['user_id', 'status'], orderBy: { field: 'created_at', direction: 'desc' } },

  // ── PR-C changed this query's shape ──
  { where: 'mortgageService.getByCustomer', collection: 'mortgages', equality: ['user_id', 'customer_id'], orderBy: { field: 'created_at', direction: 'desc' } },

  // ── Customers ──
  { where: 'customerService.getAll / getPaginated', collection: 'customers', equality: ['user_id'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'customerService.getPaginated (status filter)', collection: 'customers', equality: ['user_id', 'status'], orderBy: { field: 'created_at', direction: 'desc' } },

  // ── Leads ──
  { where: 'leadService.getAll', collection: 'leads', equality: ['user_id'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'leadService.getAll (status filter)', collection: 'leads', equality: ['user_id', 'status'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'leadService.getAll (source filter)', collection: 'leads', equality: ['user_id', 'source'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'leadService.getAll (both filters)', collection: 'leads', equality: ['user_id', 'status', 'source'], orderBy: { field: 'created_at', direction: 'desc' } },

  // ── Tasks ──
  { where: 'taskService.getAll', collection: 'tasks', equality: ['user_id'], orderBy: { field: 'due_date', direction: 'asc' } },
  { where: 'taskService.getAll (status filter) / dashboard', collection: 'tasks', equality: ['user_id', 'status'], orderBy: { field: 'due_date', direction: 'asc' } },
  { where: 'taskService.getAll (customer filter)', collection: 'tasks', equality: ['user_id', 'customer_id'], orderBy: { field: 'due_date', direction: 'asc' } },

  // ── Alerts ──
  { where: 'alertService.getAll / dashboard', collection: 'alerts', equality: ['user_id', 'status'], orderBy: { field: 'days_until_end', direction: 'asc' } },
  // PR-F: the nightly reopen of snoozed alerts.
  { where: 'generateAlerts snooze reopen', collection: 'alerts', equality: ['status'], orderBy: { field: 'snoozed_until', direction: 'asc' } },

  // ── Per-case collections ──
  { where: 'documentService.getByCustomer', collection: 'documents', equality: ['user_id', 'customer_id'], orderBy: { field: 'uploaded_at', direction: 'desc' } },
  { where: 'obligationService.getByCustomer', collection: 'obligations', equality: ['user_id', 'customer_id'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'appraisalService.getByCustomer', collection: 'appraisals', equality: ['user_id', 'customer_id'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'borrowerService.getByCustomer', collection: 'borrowers', equality: ['user_id', 'customer_id'], orderBy: { field: 'created_at', direction: 'asc' } },
  { where: 'disbursementService.getByCustomer', collection: 'disbursements', equality: ['user_id', 'customer_id'], orderBy: { field: 'due_date', direction: 'asc' } },
  { where: 'bankOfferService.getByMortgage', collection: 'bank_offers', equality: ['user_id', 'mortgage_id'], orderBy: { field: 'created_at', direction: 'desc' } },
  { where: 'meetingService.getAll / getToday', collection: 'meetings', equality: ['user_id'], orderBy: { field: 'starts_at', direction: 'asc' } },

  // ── Audit and activity ──
  { where: 'AuditLogPage', collection: 'audit_log', equality: ['user_id'], orderBy: { field: 'changed_at', direction: 'desc' } },
  { where: 'ActivityFeed', collection: 'activity', equality: ['user_id'], orderBy: { field: 'created_at', direction: 'desc' } },

  // ── Scheduled functions ──
  { where: 'generateAlerts appraisal scan', collection: 'appraisals', equality: ['status'], orderBy: { field: 'ordered_at', direction: 'asc' } },
  { where: 'generateApprovalAlerts', collection: 'mortgages', equality: ['status'], orderBy: { field: 'approval_expires_at', direction: 'asc' } },
  { where: 'disbursement due scan', collection: 'disbursements', equality: ['status'], orderBy: { field: 'due_date', direction: 'asc' } },
  { where: 'meeting reminder scan', collection: 'meetings', equality: ['status', 'reminder_sent'], orderBy: { field: 'starts_at', direction: 'asc' } },
]

/**
 * Whether a declared index serves a query: its leading fields must be exactly
 * the equality fields in some order, followed by the ordered field.
 */
function isServedBy(shape: QueryShape, index: DeclaredIndex): boolean {
  if (index.collectionGroup !== shape.collection) return false
  const paths = index.fields.map((f) => f.fieldPath)
  const wanted = shape.orderBy ? shape.equality.length + 1 : shape.equality.length
  if (paths.length !== wanted) return false

  const leading = paths.slice(0, shape.equality.length)
  if ([...leading].sort().join() !== [...shape.equality].sort().join()) return false

  if (!shape.orderBy) return true
  const last = index.fields[index.fields.length - 1]
  if (last.fieldPath !== shape.orderBy.field) return false
  // Firestore serves either direction from one index, but declaring the
  // direction the code actually uses keeps the intent legible.
  return last.order === (shape.orderBy.direction === 'desc' ? 'DESCENDING' : 'ASCENDING')
}

describe('every composite query has a declared index', () => {
  for (const shape of QUERIES) {
    it(`${shape.collection} — ${shape.where}`, () => {
      const match = declared.find((index) => isServedBy(shape, index))
      expect(
        match,
        `No index in firestore.indexes.json serves ${shape.collection} ` +
        `[${shape.equality.join(', ')}] ordered by ${shape.orderBy?.field ?? '(none)'} ` +
        `${shape.orderBy?.direction ?? ''} — used by ${shape.where}`,
      ).toBeDefined()
    })
  }
})

describe('firestore.indexes.json is well formed', () => {
  it('declares no duplicate indexes', () => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const index of declared) {
      const key = `${index.collectionGroup}:${index.fields.map((f) => `${f.fieldPath}/${f.order}`).join(',')}`
      if (seen.has(key)) duplicates.push(key)
      seen.add(key)
    }
    expect(duplicates).toEqual([])
  })

  it('gives every field a direction', () => {
    for (const index of declared) {
      for (const field of index.fields) {
        expect(field.order ?? field.arrayConfig).toBeDefined()
      }
    }
  })
})
