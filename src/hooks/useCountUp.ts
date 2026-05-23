import { useState, useEffect } from 'react'

// Animates a number from 0 to `target` with an ease-out-cubic curve.
export function useCountUp(target: number, duration = 1100, delay = 0): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(target)) {
      if (import.meta.env.DEV) console.warn('useCountUp: non-finite target', target)
      setCount(0)
      return
    }
    if (target === 0) {
      setCount(0)
      return
    }
    let raf = 0
    let t0: number | null = null
    const tid = window.setTimeout(() => {
      const step = (ts: number) => {
        if (t0 === null) t0 = ts
        const p = Math.min((ts - t0) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setCount(Math.round(eased * target))
        if (p < 1) raf = requestAnimationFrame(step)
        else setCount(target)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => {
      window.clearTimeout(tid)
      cancelAnimationFrame(raf)
    }
  }, [target, duration, delay])

  return count
}

// Returns true after `delay` ms — used to trigger mount-time transitions.
export function useMounted(delay = 80): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])
  return mounted
}
