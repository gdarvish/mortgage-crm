import { describe, it, expect } from 'vitest'
import { parseBoiPayload, primeFrom, PRIME_SPREAD } from '../../functions/src/boiParse'

/**
 * The Bank of Israel feed is outside our control and has changed shape at
 * least once. Publishing a wrong prime rate is worse than reporting that the
 * feed could not be read, so anything unrecognisable has to come back null.
 */

describe('parseBoiPayload — legacy points feed', () => {
  const legacy = {
    resultSet: {
      series: [{
        points: [
          { value: '5.75', period: '2025-11' },
          { value: '6.00', period: '2026-03' },
        ],
      }],
    },
  }

  it('takes the most recent point', () => {
    expect(parseBoiPayload(legacy)).toEqual({ rate: 6, period: '2026-03' })
  })

  it('accepts the series without the resultSet wrapper', () => {
    expect(parseBoiPayload({ series: legacy.resultSet.series })).toEqual({ rate: 6, period: '2026-03' })
  })

  it('accepts numeric values as well as strings', () => {
    const payload = { series: [{ points: [{ value: 4.5, period: '2026-01' }] }] }
    expect(parseBoiPayload(payload)?.rate).toBe(4.5)
  })

  it('skips a trailing point with no value rather than failing', () => {
    const payload = {
      series: [{ points: [{ value: '4.25', period: '2026-01' }, { value: null, period: '2026-02' }] }],
    }
    expect(parseBoiPayload(payload)).toEqual({ rate: 4.25, period: '2026-01' })
  })

  it('reports no period when the feed omits one', () => {
    expect(parseBoiPayload({ series: [{ points: [{ value: '4' }] }] })).toEqual({ rate: 4, period: '' })
  })
})

describe('parseBoiPayload — SDMX-JSON', () => {
  const sdmx = {
    data: {
      dataSets: [{
        series: {
          '0:0:0': { observations: { '0': [5.75], '1': [6.0] } },
        },
      }],
      structure: {
        dimensions: {
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2025-11' }, { id: '2026-03' }] }],
        },
      },
    },
  }

  it('takes the last observation and its period label', () => {
    expect(parseBoiPayload(sdmx)).toEqual({ rate: 6, period: '2026-03' })
  })

  it('works without the outer data wrapper', () => {
    expect(parseBoiPayload(sdmx.data)).toEqual({ rate: 6, period: '2026-03' })
  })

  it('still returns the rate when the structure carries no labels', () => {
    const noStructure = { data: { dataSets: sdmx.data.dataSets } }
    expect(parseBoiPayload(noStructure)).toEqual({ rate: 6, period: '' })
  })
})

describe('parseBoiPayload — refusals', () => {
  it('refuses anything that is not an object', () => {
    expect(parseBoiPayload(null)).toBeNull()
    expect(parseBoiPayload('6.00')).toBeNull()
    expect(parseBoiPayload(6)).toBeNull()
  })

  it('refuses an HTML error page parsed as JSON', () => {
    expect(parseBoiPayload({ error: 'Not Found' })).toBeNull()
  })

  it('refuses an empty series', () => {
    expect(parseBoiPayload({ series: [{ points: [] }] })).toBeNull()
  })

  it('refuses a value outside any plausible policy rate', () => {
    expect(parseBoiPayload({ series: [{ points: [{ value: '4200' }] }] })).toBeNull()
    expect(parseBoiPayload({ series: [{ points: [{ value: 'n/a' }] }] })).toBeNull()
  })
})

describe('primeFrom', () => {
  it('adds the fixed spread', () => {
    expect(primeFrom(4.5)).toBe(4.5 + PRIME_SPREAD)
    expect(PRIME_SPREAD).toBe(1.5)
  })

  it('does not leak binary floating point into the displayed rate', () => {
    expect(primeFrom(4.35)).toBe(5.85)
  })
})
