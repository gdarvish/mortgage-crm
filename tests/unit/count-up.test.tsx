// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCountUp, useMounted } from '@/hooks/useCountUp'

/**
 * The counter runs on every KPI card, so it has to land on the exact figure
 * and it has to stand down for a viewer who asked for reduced motion —
 * otherwise the dashboard animates numbers at somebody who cannot read them.
 */

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({
    matches: reduce && q.includes('prefers-reduced-motion'),
    media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
}

/** Drives requestAnimationFrame off the fake timer clock. */
function installRafOnTimers() {
  let now = 0
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => { now += 16; cb(now) }, 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
}

beforeEach(() => {
  vi.useFakeTimers()
  installRafOnTimers()
  setReducedMotion(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useCountUp', () => {
  it('lands exactly on the target', () => {
    const { result } = renderHook(() => useCountUp(1234, 100))
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current).toBe(1234)
  })

  it('climbs towards the target rather than jumping', () => {
    const { result } = renderHook(() => useCountUp(1000, 320))
    act(() => { vi.advanceTimersByTime(64) })
    const midway = result.current
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1000)
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current).toBe(1000)
  })

  it('shows the figure immediately under reduced motion', () => {
    setReducedMotion(true)
    const { result } = renderHook(() => useCountUp(4200, 1100))
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe(4200)
  })

  it('reports zero for a value that is not a number', () => {
    const { result } = renderHook(() => useCountUp(Number.NaN))
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe(0)
  })

  it('re-runs when the target changes', () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target, 100), {
      initialProps: { target: 100 },
    })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current).toBe(100)
    rerender({ target: 250 })
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current).toBe(250)
  })

  it('stops animating once unmounted', () => {
    const { result, unmount } = renderHook(() => useCountUp(500, 320))
    unmount()
    const afterUnmount = result.current
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current).toBe(afterUnmount)
  })
})

describe('useMounted', () => {
  it('flips once the delay has passed', () => {
    const { result } = renderHook(() => useMounted(80))
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(80) })
    expect(result.current).toBe(true)
  })
})
