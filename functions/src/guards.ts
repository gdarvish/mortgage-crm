import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { db } from './common'

/**
 * The checks every callable must pass before it touches anything.
 *
 * They were written inline in each function, which is exactly the shape a
 * missing guard hides in: a new callable that forgets one looks no different
 * from one that does not need it. Naming them makes their absence visible,
 * and makes the rule testable.
 */

/** The caller's uid, or a refusal. */
export function requireAuth(request: Pick<CallableRequest, 'auth'>): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות')
  return request.auth.uid
}

/** The caller's uid, or a refusal if they are not an admin. */
export function requireAdmin(request: Pick<CallableRequest, 'auth'>, action = 'לפעולה זו'): string {
  const uid = requireAuth(request)
  if (request.auth!.token.admin !== true) {
    throw new HttpsError('permission-denied', `נדרשות הרשאות מנהל ${action}`)
  }
  return uid
}

/** A required string argument, or a refusal. */
export function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpsError('invalid-argument', message)
  }
  return value
}

/**
 * A document the caller owns.
 *
 * Ownership is re-checked on the server for every callable: the Firestore
 * rules protect direct client reads, but a Cloud Function runs with the Admin
 * SDK and bypasses them entirely.
 */
export async function requireOwnedDoc(
  collectionName: string,
  id: string,
  uid: string,
  notFoundMessage = 'הרשומה לא נמצאה',
): Promise<Record<string, unknown>> {
  const snap = await db.collection(collectionName).doc(id).get()
  if (!snap.exists) throw new HttpsError('not-found', notFoundMessage)
  const data = snap.data()!
  if (data.user_id !== uid) throw new HttpsError('permission-denied', 'אין הרשאה לרשומה זו')
  return data
}
