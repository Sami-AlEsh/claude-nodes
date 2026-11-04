import { describe, expect, it } from 'vitest'
import { schemeTokens } from '@shared/schemes'
import css from './tokens.css?raw'

/** The custom properties a block of tokens.css sets. */
function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const darkAt = css.indexOf('@media (prefers-color-scheme: dark)')
const light = declarations(css.slice(0, darkAt))
// Dark mode keeps the light value of anything its block doesn't set.
const dark = { ...light, ...declarations(css.slice(darkAt)) }

describe('tokens.css and the Nodus colour scheme', () => {
  it('agree on every token a scheme sets, in both modes', () => {
    for (const [name, value] of Object.entries(schemeTokens('light', 'nodus'))) expect(light[name], name).toBe(value)
    for (const [name, value] of Object.entries(schemeTokens('dark', 'nodus'))) expect(dark[name], name).toBe(value)
  })
})
