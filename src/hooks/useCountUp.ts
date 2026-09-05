import { useEffect, useState } from 'react'

/** True when the viewer has asked the OS for reduced motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Counts up from zero to `target` on an ease-out-cubic curve.
 *
 * Returns the target immediately when the value is not animatable — a
 * non-finite number, a zero target, or a viewer who has asked for reduced
 * motion — so the caller can render the result unconditionally.
 */
export function useCountUp(target: number, duration = 1100, delay = 0): number {
  const [count, setCount] = useState(() => (Number.isFinite(target) ? target : 0))

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setCount(0)
      return
    }
    if (target === 0 || prefersReducedMotion()) {
      setCount(target)
      return
    }

    let frame = 0
    let start: number | null = null
    const timer = window.setTimeout(() => {
      setCount(0)
      const step = (now: number) => {
        if (start === null) start = now
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        if (progress < 1) {
          setCount(Math.round(eased * target))
          frame = requestAnimationFrame(step)
        } else {
          // Land exactly on the target — never on a rounded approximation.
          setCount(target)
        }
      }
      frame = requestAnimationFrame(step)
    }, delay)

    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [target, duration, delay])

  return count
}

/** True once `delay` ms have passed — for mount-time transitions. */
export function useMounted(delay = 80): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay])
  return mounted
}
