import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Two bugs of the same shape lived in the nav: it linked to /rates and
 * /family, which are not routes at all, and the desktop strip listed eight
 * of the fifteen pages while the other seven sat behind a menu that is
 * hidden above the lg breakpoint — unreachable on a desktop.
 */

const app = readFileSync('src/App.tsx', 'utf8')
const header = readFileSync('src/components/layout/Header.tsx', 'utf8')

/** Paths declared under the protected AppLayout route. */
function routePaths(): string[] {
  const start = app.indexOf('<AppLayout />')
  const block = app.slice(start, app.indexOf('</Route>', start))
  return [...block.matchAll(/<Route path="([^"]+)"/g)]
    .map(m => `/${m[1]}`)
    // Detail routes are reached from their list page, not from the nav.
    .filter(p => !p.includes(':'))
}

function navPaths(): string[] {
  return [...header.matchAll(/path: '([^']+)'/g)].map(m => m[1])
}

describe('navigation', () => {
  const routes = routePaths()
  const nav = navPaths()

  it('reads both lists', () => {
    expect(routes.length).toBeGreaterThan(10)
    expect(nav.length).toBeGreaterThan(10)
  })

  for (const path of navPaths()) {
    it(`${path} is a real route`, () => {
      expect(routes).toContain(path)
    })
  }

  for (const path of routePaths()) {
    it(`${path} is reachable from the nav`, () => {
      expect(nav).toContain(path)
    })
  }

  it('shows the whole nav on desktop, not a subset', () => {
    // One list, rendered by both the desktop strip and the mobile drawer.
    expect(header).not.toMatch(/mobileExtraItems|allMobileItems/)
    expect(header.match(/navItems\.map/g)?.length).toBe(2)
  })
})
