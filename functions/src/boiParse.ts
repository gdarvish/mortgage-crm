/**
 * Parsing for the Bank of Israel series feed.
 *
 * Kept free of firebase-admin and of the network so the shapes can be tested
 * directly. The feed has moved format at least once — the legacy page
 * endpoint returns a `points` array, the documented series database returns
 * SDMX-JSON — so both are accepted and the endpoint itself is configurable.
 */

export interface BoiObservation {
  /** The rate, in percent. */
  rate: number
  /** The period the reading belongs to, as the feed labels it. May be empty. */
  period: string
}

function toRate(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  // A policy rate outside this range is a parse error, not a rate.
  if (!Number.isFinite(n) || n < -5 || n > 30) return null
  return n
}

/** `{ resultSet: { series: [{ points: [{ value, period }] }] } }` and friends. */
function fromPoints(json: Record<string, unknown>): BoiObservation | null {
  const resultSet = json.resultSet as Record<string, unknown> | undefined
  const seriesList =
    (resultSet?.series as unknown[] | undefined) ??
    (json.series as unknown[] | undefined) ??
    []
  const first = seriesList[0] as Record<string, unknown> | undefined
  const points = (first?.points ?? first?.observations) as unknown[] | undefined
  if (!Array.isArray(points) || points.length === 0) return null

  // The feed is oldest-first; the last point that parses is the current rate.
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i] as Record<string, unknown>
    const rate = toRate(point?.value)
    if (rate !== null) {
      const period = point?.period ?? point?.date ?? point?.timePeriod
      return { rate, period: typeof period === 'string' ? period : '' }
    }
  }
  return null
}

/**
 * SDMX-JSON: observations are keyed by dimension index, and the period labels
 * live in the structure rather than beside the values.
 */
function fromSdmx(json: Record<string, unknown>): BoiObservation | null {
  const data = (json.data ?? json) as Record<string, unknown>
  const dataSets = data.dataSets as unknown[] | undefined
  const firstSet = dataSets?.[0] as Record<string, unknown> | undefined
  const seriesMap = firstSet?.series as Record<string, unknown> | undefined
  const firstSeries = seriesMap ? Object.values(seriesMap)[0] as Record<string, unknown> | undefined : undefined
  const observations = (firstSeries?.observations ?? firstSet?.observations) as
    Record<string, unknown[]> | undefined
  if (!observations) return null

  const structure = data.structure as Record<string, unknown> | undefined
  const dimensions = structure?.dimensions as Record<string, unknown> | undefined
  const observationDims = dimensions?.observation as Array<Record<string, unknown>> | undefined
  const periods = observationDims?.[0]?.values as Array<{ id?: string; name?: string }> | undefined

  // Keys are stringified indices into the observation dimension.
  const indices = Object.keys(observations)
    .map((k) => ({ key: k, index: parseInt(k, 10) }))
    .filter((k) => Number.isFinite(k.index))
    .sort((a, b) => b.index - a.index)

  for (const { key, index } of indices) {
    const rate = toRate(observations[key]?.[0])
    if (rate !== null) {
      const label = periods?.[index]
      return { rate, period: label?.id ?? label?.name ?? '' }
    }
  }
  return null
}

/**
 * Pulls the most recent rate out of whichever shape the feed returned.
 * Returns null when nothing in the payload looks like a rate, so the caller
 * can report the endpoint as unusable rather than publish a wrong number.
 */
export function parseBoiPayload(payload: unknown): BoiObservation | null {
  if (!payload || typeof payload !== 'object') return null
  const json = payload as Record<string, unknown>
  return fromPoints(json) ?? fromSdmx(json)
}

/** Prime in Israel is the Bank of Israel rate plus a fixed 1.5%. */
export const PRIME_SPREAD = 1.5

export function primeFrom(boiRate: number): number {
  return Math.round((boiRate + PRIME_SPREAD) * 100) / 100
}
