import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

initializeApp()

export const db = getFirestore()
export const REGION = 'europe-west1'

/**
 * Fixed-window rate limiter, keyed by an arbitrary qualifier (a uid, an IP).
 *
 * Lives here rather than in index.ts so every callable — the AI functions
 * included — can reach it without importing the whole function surface.
 */
export async function checkRateLimit(
  qualifier: string,
  maxCalls = 10,
  windowSec = 60,
): Promise<void> {
  const ref = db.collection('rate_limits').doc(qualifier.replace(/\//g, '_'))
  const now = Date.now()
  await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data()
    let count = 1
    let windowStart = now
    if (data && typeof data.windowStart === 'number' && now - data.windowStart < windowSec * 1000) {
      count = (data.count ?? 0) + 1
      windowStart = data.windowStart
    }
    if (count > maxCalls) {
      throw new HttpsError('resource-exhausted', 'יותר מדי בקשות. נסה שוב בעוד דקה.')
    }
    // expireAt drives the Firestore TTL policy so stale limiter docs self-delete.
    tx.set(ref, { count, windowStart, expireAt: Timestamp.fromMillis(now + 60 * 60 * 1000) })
  })
}

/** Calls per hour allowed per advisor across the Claude-backed functions. */
export const AI_HOURLY_LIMIT = 30

/** Rate-limits one advisor's use of the AI functions. */
export function checkAiRateLimit(uid: string): Promise<void> {
  return checkRateLimit(`ai:${uid}`, AI_HOURLY_LIMIT, 3600)
}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

/** Maps a file extension to a Claude-supported image media type, defaulting to PNG. */
export function imageMediaType(ext: string | undefined): ImageMediaType {
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
