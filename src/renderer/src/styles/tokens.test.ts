import { describe, expect, it } from 'vitest'
import { NODUS_SCHEMES, schemeTokens, windowColor } from '@shared/schemes'
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
  it('agree on every dark token a scheme sets', () => {
    for (const [name, value] of Object.entries(schemeTokens('nodus'))) expect(dark[name], name).toBe(value)
  })

  it('agree on the window’s colour in both modes', () => {
    expect(windowColor(NODUS_SCHEMES, false)).toBe(light['--bg-window'])
    expect(windowColor(NODUS_SCHEMES, true)).toBe(dark['--bg-window'])
  })
})
