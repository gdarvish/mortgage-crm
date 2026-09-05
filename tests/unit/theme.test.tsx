// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ThemeProvider, useTheme, useThemeControls } from '@/theme/ThemeContext'
import { THEMES, type ThemeId } from '@/theme/themes'

/**
 * The theme system.
 *
 * The palette lives in two places by necessity — themes.ts drives the runtime,
 * index.css carries the pre-paint default so the first frame is not unstyled.
 * They have to agree, and nothing but a test will notice when they stop.
 */

/** #fff and #ffffff are the same colour; compare them as such. */
function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v)
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : v
}

/** The `@theme` block's token literals, as CSS sees them. */
function cssTokens(): Record<string, string> {
  const css = readFileSync('src/index.css', 'utf8')
  const tokens: Record<string, string> = {}
  for (const [, name, value] of css.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    if (!(name in tokens)) tokens[name] = value.trim()
  }
  return tokens
}

describe('index.css and themes.ts agree on the default palette', () => {
  const css = cssTokens()
  const earth = THEMES.earth

  // Every token ThemeProvider writes must have a matching literal in the
  // stylesheet, or the first paint differs from every paint after it.
  const pairs: [string, string][] = [
    ['--color-nav-bg', earth.nav],
    ['--color-nav-active', earth.navActive],
    ['--color-nav-text', earth.navText],
    ['--color-nav-text-active', earth.navTextActive],
    ['--color-primary', earth.primary],
    ['--color-primary-hover', earth.primaryHover],
    ['--color-primary-text', earth.primaryText],
    ['--color-bg', earth.bg],
    ['--color-card', earth.cardBg],
    ['--color-border', earth.border],
    ['--color-border-light', earth.borderLight],
    ['--color-text', earth.text],
    ['--color-text-sub', earth.textSub],
    ['--color-text-muted', earth.textMuted],
    ['--color-accent', earth.accent],
    ['--color-accent-bg', earth.accentBg],
    ['--color-danger', earth.danger],
    ['--color-danger-bg', earth.dangerBg],
    ['--color-success', earth.success],
    ['--color-success-bg', earth.successBg],
    ['--color-warning', earth.warning],
    ['--color-warning-bg', earth.warningBg],
    ['--color-info', earth.info],
    ['--color-info-bg', earth.infoBg],
    ['--color-input-bg', earth.inputBg],
    ['--color-pill-bg', earth.pillBg],
    ['--color-pill-text', earth.pillText],
  ]

  for (const [token, value] of pairs) {
    it(`${token} matches THEMES.earth`, () => {
      expect(normalizeHex(css[token] ?? '')).toBe(normalizeHex(value))
    })
  }
})

describe('every theme defines every token', () => {
  const keys = Object.keys(THEMES.earth) as (keyof typeof THEMES.earth)[]
  for (const id of Object.keys(THEMES) as ThemeId[]) {
    it(`${id} is complete`, () => {
      for (const key of keys) {
        expect(THEMES[id][key], `${id}.${String(key)}`).toBeTruthy()
      }
    })
  }
})

function Probe() {
  const theme = useTheme()
  const { themeId, setThemeId } = useThemeControls()
  return (
    <div>
      <span data-testid="id">{themeId}</span>
      <span data-testid="primary">{theme.primary}</span>
      <button onClick={() => setThemeId('night')}>night</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('defaults to earth and writes the tokens onto :root', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('id')).toHaveTextContent('earth')
    const root = document.documentElement
    expect(root.getAttribute('data-theme')).toBe('earth')
    expect(root.style.getPropertyValue('--color-primary')).toBe(THEMES.earth.primary)
    expect(root.style.getPropertyValue('--color-bg')).toBe(THEMES.earth.bg)
  })

  it('switching a theme rewrites the tokens — not just the label', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    return userEvent.click(screen.getByRole('button', { name: 'night' })).then(() => {
      expect(screen.getByTestId('id')).toHaveTextContent('night')
      expect(screen.getByTestId('primary')).toHaveTextContent(THEMES.night.primary)
      const root = document.documentElement
      expect(root.getAttribute('data-theme')).toBe('night')
      expect(root.style.getPropertyValue('--color-primary')).toBe(THEMES.night.primary)
      expect(root.style.getPropertyValue('--color-bg')).toBe(THEMES.night.bg)
      expect(document.body.style.background).toBeTruthy()
    })
  })

  it('remembers the choice across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ThemeProvider><Probe /></ThemeProvider>)
    await user.click(screen.getByRole('button', { name: 'night' }))
    unmount()

    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('id')).toHaveTextContent('night')
  })

  it('ignores a corrupted stored value rather than breaking', () => {
    localStorage.setItem('crm-theme', 'not-a-theme')
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('id')).toHaveTextContent('earth')
  })

  it('survives localStorage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => render(<ThemeProvider><Probe /></ThemeProvider>)).not.toThrow()
  })
})

describe('useTheme outside a provider', () => {
  function Bare() {
    const theme = useTheme()
    return <span data-testid="primary">{theme.primary}</span>
  }

  it('falls back to the default palette instead of crashing the page', () => {
    render(<Bare />)
    expect(screen.getByTestId('primary')).toHaveTextContent(THEMES.earth.primary)
  })

  it('but useThemeControls still throws — a dead switcher is a real bug', () => {
    function BareControls() {
      useThemeControls()
      return null
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<BareControls />)).toThrow(/ThemeProvider/)
  })
})

/**
 * A `var(--color-x)` nobody defines resolves to nothing — a transparent
 * background or an inherited colour, with no error anywhere. That is how
 * --color-card-bg and --color-primary-text shipped invisible-but-broken.
 */
describe('every referenced token exists', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) return sourceFiles(full)
      return /\.tsx?$/.test(entry) ? [full] : []
    })
  }

  const css = readFileSync('src/index.css', 'utf8')
  const context = readFileSync('src/theme/ThemeContext.tsx', 'utf8')
  const defined = new Set<string>([
    ...[...css.matchAll(/(--[\w-]+):/g)].map(m => m[1]),
    ...[...context.matchAll(/'(--[\w-]+)':/g)].map(m => m[1]),
  ])

  const referenced = new Map<string, string>()
  for (const file of sourceFiles('src')) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/var\((--[\w-]+)/g)) {
      if (!referenced.has(name)) referenced.set(name, file)
    }
  }

  it('finds tokens to check', () => {
    expect(referenced.size).toBeGreaterThan(5)
  })

  for (const [name, file] of referenced) {
    it(`${name} is defined (used in ${file})`, () => {
      expect(defined.has(name)).toBe(true)
    })
  }
})

describe('applyCssVars covers the whole palette', () => {
  it('mirrors every colour token onto :root', () => {
    const context = readFileSync('src/theme/ThemeContext.tsx', 'utf8')
    const mirrored = new Set([...context.matchAll(/theme\.(\w+)/g)].map(m => m[1]))
    // Everything but the theme's own identity fields is a paint value.
    const paintKeys = Object.keys(THEMES.earth).filter(k => k !== 'id' && k !== 'name')
    for (const key of paintKeys) {
      expect(mirrored.has(key), `theme.${key} is never written to a CSS variable`).toBe(true)
    }
  })
})
