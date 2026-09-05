import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Tailwind 4 puts its utilities in @layer utilities, and unlayered CSS beats
 * every layer regardless of specificity. An unlayered `* { padding: 0 }`
 * therefore wins over p-8, px-4 and every other spacing utility in the app —
 * which is exactly what happened: cards rendered with no padding and inputs
 * ran edge to edge, everywhere, silently.
 */

const css = readFileSync('src/index.css', 'utf8')

/** The character ranges covered by an `@layer <name> { … }` block. */
function layerRanges(): [number, number][] {
  const ranges: [number, number][] = []
  for (const match of css.matchAll(/@layer\s+[\w\s,]+\{/g)) {
    let depth = 1
    let i = match.index! + match[0].length
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    ranges.push([match.index!, i])
  }
  return ranges
}

function isLayered(index: number): boolean {
  return layerRanges().some(([start, end]) => index > start && index < end)
}

describe('the element reset is layered', () => {
  it('has an @layer base block', () => {
    expect(css).toMatch(/@layer\s+base\s*\{/)
  })

  const resets: [string, RegExp][] = [
    ['the universal reset', /^\s*\*\s*\{/m],
    ['the input font-size', /^\s*input,\s*select,\s*textarea\s*\{/m],
    ['the heading font-family', /^\s*h1,\s*h2,/m],
    ['the body rule', /^\s*body\s*\{/m],
  ]

  for (const [name, pattern] of resets) {
    it(`${name} cannot outrank a utility class`, () => {
      const match = pattern.exec(css)
      expect(match, `${name} is missing from index.css`).not.toBeNull()
      expect(isLayered(match!.index)).toBe(true)
    })
  }
})
