import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * AppLayout's <main> deliberately carries no padding — the page shell
 * (.crm-page / .crm-page-narrow) owns it, so a page can run edge to edge
 * when it needs to. A page inside the layout that forgets the shell renders
 * flush against the window with nothing to catch it.
 */

const app = readFileSync('src/App.tsx', 'utf8')

function lazyImports(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [, name, path] of app.matchAll(/const (\w+) = lazy\(\(\) => import\('@\/pages\/(\w+)'\)\)/g)) {
    map[name] = path
  }
  return map
}

/** The components rendered under the protected AppLayout route. */
function protectedComponents(): string[] {
  const start = app.indexOf('<AppLayout />')
  const end = app.indexOf('</Route>', start)
  const block = app.slice(start, end)
  return [...block.matchAll(/element=\{<(\w+)\s*\/>\}/g)].map(m => m[1])
}

describe('every page inside AppLayout carries a page shell', () => {
  const imports = lazyImports()
  const components = protectedComponents().filter(c => c in imports)

  it('finds the protected pages', () => {
    expect(components.length).toBeGreaterThan(10)
  })

  it('AppLayout leaves the padding to the page', () => {
    const layout = readFileSync('src/components/layout/AppLayout.tsx', 'utf8')
    const main = /<main[^>]*>/.exec(layout)?.[0] ?? ''
    expect(main).not.toMatch(/\bp-\d|\bpx-\d|\bpy-\d/)
  })

  for (const component of components) {
    it(`${component} uses .crm-page`, () => {
      const source = readFileSync(`src/pages/${imports[component]}.tsx`, 'utf8')
      expect(source).toMatch(/crm-page(-narrow)?/)
    })
  }
})
