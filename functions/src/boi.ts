import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineString } from 'firebase-functions/params'
import { db, REGION, checkRateLimit } from './common'
import { requireAuth } from './guards'
import { parseBoiPayload, primeFrom } from './boiParse'

/**
 * The Bank of Israel rate, fetched server-side.
 *
 * The page used to call the feed straight from the browser, which a browser
 * will not allow: edge.boi.gov.il is another origin and does not grant CORS,
 * so every refresh failed before it left the tab. Fetching here also gets a
 * sane timeout and a shared cache instead of one request per advisor per
 * page load.
 */

/**
 * Override with: firebase functions:config / .env  BOI_RATES_URL=…
 * The feed's address has changed before and this environment cannot reach
 * boi.gov.il to verify it, so it is a setting rather than a constant.
 */
const BOI_RATES_URL = defineString('BOI_RATES_URL', {
  default: 'https://edge.boi.gov.il/FusionEdge/skewers/clients/json/en/page_1007.aspx',
  description: 'JSON endpoint for the Bank of Israel policy rate series.',
})

const CACHE_DOC = db.collection('boi_rates').doc('latest')
const CACHE_TTL_MS = 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 15_000

export interface BoiRates {
  prime: number
  boiRate: number
  lastUpdate: string
  fetchedAt: string
}

interface CachedRates extends BoiRates {
  source: string
}

async function readCache(): Promise<CachedRates | null> {
  const snap = await CACHE_DOC.get()
  if (!snap.exists) return null
  const data = snap.data() as Partial<CachedRates> | undefined
  if (typeof data?.boiRate !== 'number' || typeof data.fetchedAt !== 'string') return null
  return data as CachedRates
}

function isFresh(cached: CachedRates, now: number): boolean {
  const age = now - new Date(cached.fetchedAt).getTime()
  return Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS
}

async function fetchFromBoi(url: string): Promise<BoiRates> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    const reason = e instanceof Error && e.name === 'AbortError'
      ? `לא התקבלה תשובה תוך ${FETCH_TIMEOUT_MS / 1000} שניות`
      : e instanceof Error ? e.message : 'שגיאת רשת'
    throw new HttpsError('unavailable', `בנק ישראל לא זמין: ${reason}`)
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    throw new HttpsError('unavailable', `בנק ישראל החזיר שגיאה ${res.status} עבור ${url}`)
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new HttpsError('unavailable', `התשובה מבנק ישראל אינה JSON תקין (${url})`)
  }

  const observation = parseBoiPayload(payload)
  if (!observation) {
    throw new HttpsError(
      'unavailable',
      `לא נמצאה ריבית בתשובה מבנק ישראל. ייתכן שכתובת המקור השתנתה — ניתן לעדכן אותה בהגדרת BOI_RATES_URL.`,
    )
  }

  return {
    boiRate: observation.rate,
    prime: primeFrom(observation.rate),
    lastUpdate: observation.period,
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * Returns the current Bank of Israel rate and the prime derived from it.
 *
 * Serves the shared cache unless it is over an hour old or the caller asked
 * to force a refresh. On failure it throws with the actual reason — a status
 * code, a timeout, an unparseable body — rather than the opaque failure a
 * blocked browser fetch produced.
 */
export const fetchBoiRates = onCall({ region: REGION }, async (req) => {
  const uid = requireAuth(req)
  const force = req.data?.force === true

  const now = Date.now()
  const cached = await readCache()
  if (cached && !force && isFresh(cached, now)) {
    return { ...cached, cached: true }
  }

  // Only a forced refresh reaches the network, so the limit is per advisor.
  await checkRateLimit(`boi:${uid}`, 10, 300)

  let fresh: BoiRates
  try {
    fresh = await fetchFromBoi(BOI_RATES_URL.value())
  } catch (e) {
    // A stale reading beats no reading: hand back what we have and say so.
    if (cached) {
      return { ...cached, cached: true, stale: true, error: (e as HttpsError).message }
    }
    throw e
  }

  const record: CachedRates = { ...fresh, source: BOI_RATES_URL.value() }
  await CACHE_DOC.set(record)
  return { ...record, cached: false }
})
