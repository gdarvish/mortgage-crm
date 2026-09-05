import {
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  Timestamp,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export type FirestoreError = { message: string; code?: string }

export function toError(e: unknown): FirestoreError {
  if (e instanceof Error) return { message: e.message, code: (e as { code?: string }).code }
  return { message: String(e) }
}

export function requireUserId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  return uid
}

export async function awaitUserId(): Promise<string> {
  if (auth.currentUser?.uid) return auth.currentUser.uid
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      if (user?.uid) resolve(user.uid)
      else reject(new Error('Not authenticated'))
    })
  })
}

function tsToIso(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(tsToIso)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = tsToIso(v)
    }
    return out
  }
  return value
}

export function fromDoc<T>(snap: DocumentSnapshot | QueryDocumentSnapshot): T {
  const data = snap.data() ?? {}
  return { id: snap.id, ...(tsToIso(data) as object) } as T
}

export function fromDocs<T>(snaps: QueryDocumentSnapshot[]): T[] {
  return snaps.map((s) => fromDoc<T>(s))
}

/**
 * הזרקת user_id של המשתמש המחובר ל-payload — לשימוש בכל create()
 * כדי להבטיח בעלות תקינה (נדרש על ידי Firestore Rules).
 */
export async function withUserId<T extends Record<string, unknown>>(
  payload: T
): Promise<T & { user_id: string }> {
  const uid = await awaitUserId()
  return { ...payload, user_id: uid }
}

/**
 * Loads a related document, tolerating one that cannot be read.
 *
 * Rules like `allow read: if isOwner(resource.data.user_id)` raise an
 * evaluation error on a document that no longer exists, which the client
 * surfaces as `permission-denied`. Left unguarded inside a Promise.all, a
 * single deleted customer takes down the whole commissions or tasks list
 * rather than leaving one row without a name.
 */
export async function loadRelated<T>(
  collectionName: string,
  id: string,
): Promise<T | null> {
  try {
    const snap = await getDoc(doc(db, collectionName, id))
    return snap.exists() ? fromDoc<T>(snap) : null
  } catch {
    return null
  }
}

export const sentinels = {
  serverTimestamp,
}
