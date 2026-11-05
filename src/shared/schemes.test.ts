import { describe, expect, it } from 'vitest'
import {
  DARK_SCHEMES,
  LIGHT_SCHEMES,
  mix,
  normalizeSchemes,
  schemeColors,
  schemeCss,
  schemeTile,
  schemeTokens,
  viewCss,
  viewTokens,
  windowColor
} from './schemes'

// herdr-app's resolve() run on each palette: window, board, cards, toolbar,
// text, text 2, text 3, accent.
const DERIVED = {
  graphite: ['#17191d', '#131518', '#2c2e31', '#25272b', '#eeeeef', '#98999b', '#696a6d', '#96b2d7'],
  ink: ['#111720', '#0e131b', '#262c34', '#1f252d', '#eeeeef', '#96989c', '#65696f', '#91b6ee'],
  moss: ['#151c19', '#121815', '#2a302e', '#232a27', '#eeeeef', '#979a99', '#676c6a', '#99b9cd'],
  'atom-one-dark': ['#21252b', '#1c1f24', '#35393e', '#2e3238', '#eeeeef', '#9c9ea1', '#6f7175', '#61afef'],
  paper: ['#f1f1ee', '#fafaf9', '#ffffff', '#f1f1ee', '#1b1b1e', '#69696b', '#969698', '#1f62d0']
} as const

const pairs = [
  ...DARK_SCHEMES.map((s) => ['dark', s.id] as const),
  ...LIGHT_SCHEMES.map((s) => ['light', s.id] as const)
]
const tokensOf = ([mode, id]: (typeof pairs)[number]) =>
  mode === 'dark' ? schemeTokens(mode, id) : schemeTokens(mode, id)
const viewTokensOf = ([mode, id]: (typeof pairs)[number]) =>
  mode === 'dark' ? viewTokens(mode, id) : viewTokens(mode, id)

describe('mix', () => {
  it('rounds like herdr, in f32', () => {
    expect(mix('#17191d', '#000000', 0.16)).toBe('#131518')
    // Doubles would make the last channel 0x6a.
    expect(mix('#ffffff', '#1b1b1e', 0.66)).toBe('#69696b')
  })
})

describe('schemeColors', () => {
  it('derives each scheme’s chrome with herdr’s rule', () => {
    for (const [name, expected] of Object.entries(DERIVED)) {
      const c = schemeColors(name === 'paper' ? 'light' : 'dark', name as keyof typeof DERIVED)
      expect([c.window, c.board, c.cards, c.toolbar, c.text, c.text2, c.text3, c.accent], name).toEqual(expected)
    }
  })

  it('takes the palettes’ own colours for the accent’s hover and the diff and view colours', () => {
    expect(schemeColors('dark', 'ink')).toMatchObject({
      accentHover: '#accbfa',
      onAccent: '#111720',
      green: '#89c5aa',
      red: '#e58c9a',
      yellow: '#d9be82',
      purple: '#b9a0e2'
    })
    expect(schemeColors('light', 'paper')).toMatchObject({ accentHover: '#0969da', onAccent: '#ffffff' })
  })

  it('lifts the hover toward white when a palette gives one blue for both, as Atom One Dark does', () => {
    const c = schemeColors('dark', 'atom-one-dark')
    expect(c.accent).toBe('#61afef')
    expect(c.accentHover).toBe('#79bbf1')
  })
})

describe('schemeTokens', () => {
  it('maps a scheme onto the board’s tokens, keeping today’s opacities', () => {
    expect(schemeTokens('dark', 'graphite')).toEqual({
      '--bg-window': '#17191d',
      '--bg-toolbar': 'rgba(37, 39, 43, 0.82)',
      '--bg-canvas': '#131518',
      '--bg-elevated': '#2c2e31',
      '--bg-selected': 'rgba(150, 178, 215, 0.24)',
      '--text-primary': '#eeeeef',
      '--text-secondary': '#98999b',
      '--text-tertiary': '#696a6d',
      '--text-on-accent': '#17191d',
      '--accent': '#96b2d7',
      '--accent-hover': '#b0cbef',
      '--accent-gradient-to': '#b5a2ce',
      '--focus-ring': 'rgba(150, 178, 215, 0.55)',
      '--diff-add': '#a6bd91',
      '--diff-del': '#dc8c95',
      '--archive-drop': 'rgba(150, 178, 215, 0.12)',
      '--archive-panel': 'rgba(37, 39, 43, 0.8)',
      '--folder-label-selected': '#96b2d7'
    })
    expect(schemeTokens('light', 'paper')).toMatchObject({
      '--bg-window': '#f1f1ee',
      '--bg-toolbar': 'rgba(241, 241, 238, 0.82)',
      '--bg-selected': 'rgba(31, 98, 208, 0.14)',
      '--focus-ring': 'rgba(31, 98, 208, 0.5)',
      '--archive-drop': 'rgba(31, 98, 208, 0.08)',
      '--text-on-accent': '#ffffff'
    })
  })

  it('sets the same tokens in every scheme, so none is left over from another', () => {
    const keys = Object.keys(schemeTokens('dark', 'nodus')).sort()
    for (const pair of pairs) expect(Object.keys(tokensOf(pair)).sort(), pair.join(' ')).toEqual(keys)
  })

  it('never touches status or terminal colours', () => {
    for (const pair of pairs) {
      expect(Object.keys(tokensOf(pair)).filter((n) => /status|term/.test(n)), pair.join(' ')).toEqual([])
      // Views' orange is the working status's.
      const nodus = pair[0] === 'dark' ? viewTokens('dark', 'nodus') : viewTokens('light', 'nodus')
      expect(viewTokensOf(pair)['--nodus-orange'], pair.join(' ')).toBe(nodus['--nodus-orange'])
    }
    expect(schemeCss({ darkScheme: 'atom-one-dark', lightScheme: 'paper' })).not.toMatch(/--status|--term/)
  })
})

describe('viewTokens', () => {
  it('gives views today’s colours in Nodus’s scheme', () => {
    expect(viewTokens('light', 'nodus')).toEqual({
      '--nodus-bg': '#ffffff',
      '--nodus-surface': 'rgba(0, 0, 0, 0.035)',
      '--nodus-hover': 'rgba(0, 0, 0, 0.05)',
      '--nodus-text': 'rgba(0, 0, 0, 0.88)',
      '--nodus-text-2': 'rgba(0, 0, 0, 0.56)',
      '--nodus-text-3': 'rgba(0, 0, 0, 0.36)',
      '--nodus-border': 'rgba(0, 0, 0, 0.1)',
      '--nodus-accent': '#007aff',
      '--nodus-green': '#2da44e',
      '--nodus-red': '#cf222e',
      '--nodus-orange': '#ff9500',
      '--nodus-yellow': '#d4a72c',
      '--nodus-purple': '#8250df'
    })
    expect(viewTokens('dark', 'nodus')).toEqual({
      '--nodus-bg': '#2a2a2d',
      '--nodus-surface': 'rgba(255, 255, 255, 0.04)',
      '--nodus-hover': 'rgba(255, 255, 255, 0.07)',
      '--nodus-text': 'rgba(255, 255, 255, 0.9)',
      '--nodus-text-2': 'rgba(255, 255, 255, 0.58)',
      '--nodus-text-3': 'rgba(255, 255, 255, 0.36)',
      '--nodus-border': 'rgba(255, 255, 255, 0.1)',
      '--nodus-accent': '#0a84ff',
      '--nodus-green': '#3fb950',
      '--nodus-red': '#f85149',
      '--nodus-orange': '#ff9f0a',
      '--nodus-yellow': '#e3b341',
      '--nodus-purple': '#a371f7'
    })
  })

  it('puts a view on the scheme’s card, in its text and colours', () => {
    expect(viewTokens('dark', 'moss')).toMatchObject({
      '--nodus-bg': '#2a302e',
      '--nodus-text': '#eeeeef',
      '--nodus-text-2': '#979a99',
      '--nodus-text-3': '#676c6a',
      '--nodus-accent': '#99b9cd',
      '--nodus-green': '#a0c4a2',
      '--nodus-red': '#df978d',
      '--nodus-yellow': '#d4bc8b',
      '--nodus-purple': '#bba4c8',
      '--nodus-border': 'rgba(255, 255, 255, 0.1)'
    })
  })
})

describe('schemeTile', () => {
  it('shows the palette’s ground, text and five colours', () => {
    expect(schemeTile('dark', 'atom-one-dark')).toEqual({
      background: '#21252b',
      text: '#abb2bf',
      dots: ['#61afef', '#e06c75', '#98c379', '#e5c07b', '#c678dd']
    })
    expect(schemeTile('light', 'paper').dots).toEqual(['#1f62d0', '#c62a2a', '#1a7f37', '#8f5d00', '#7a45c8'])
    expect(schemeTile('dark', 'nodus').background).toBe('#1e1e20')
  })
})

describe('windowColor', () => {
  it('is the window’s colour in the mode showing', () => {
    expect(windowColor({ darkScheme: 'nodus', lightScheme: 'nodus' }, true)).toBe('#1e1e20')
    expect(windowColor({ darkScheme: 'nodus', lightScheme: 'nodus' }, false)).toBe('#f5f5f4')
    expect(windowColor({ darkScheme: 'ink', lightScheme: 'paper' }, true)).toBe('#111720')
    expect(windowColor({ darkScheme: 'ink', lightScheme: 'paper' }, false)).toBe('#f1f1ee')
  })
})

describe('schemeCss', () => {
  it('adds nothing for Nodus’s own colours', () => {
    expect(schemeCss({ darkScheme: 'nodus', lightScheme: 'nodus' })).toBe('')
  })

  it('has a block for each mode that has a scheme of its own', () => {
    const dark = schemeCss({ darkScheme: 'ink', lightScheme: 'nodus' })
    expect(dark).toContain('@media (prefers-color-scheme: dark)')
    expect(dark).not.toContain('prefers-color-scheme: light')
    expect(dark).toContain('--bg-window: #111720;')
    expect(dark).toContain(':root:root {')

    const both = schemeCss({ darkScheme: 'moss', lightScheme: 'paper' })
    expect(both.indexOf('prefers-color-scheme: light')).toBeGreaterThanOrEqual(0)
    expect(both).toContain('--bg-canvas: #fafaf9;')
    expect(both).toContain('--bg-canvas: #121815;')
  })
})

describe('viewCss', () => {
  it('has light colours, then dark ones', () => {
    const css = viewCss({ darkScheme: 'graphite', lightScheme: 'nodus' })
    expect(css.indexOf('--nodus-bg: #ffffff;')).toBeLessThan(css.indexOf('@media (prefers-color-scheme: dark)'))
    expect(css.indexOf('--nodus-bg: #2c2e31;')).toBeGreaterThan(css.indexOf('@media (prefers-color-scheme: dark)'))
  })
})

describe('normalizeSchemes', () => {
  it('keeps known schemes and turns anything else into Nodus’s', () => {
    expect(normalizeSchemes({ darkScheme: 'atom-one-dark', lightScheme: 'paper' })).toEqual({
      darkScheme: 'atom-one-dark',
      lightScheme: 'paper'
    })
    expect(normalizeSchemes({})).toEqual({ darkScheme: 'nodus', lightScheme: 'nodus' })
    // A light scheme isn't a dark one, and the other way round.
    expect(normalizeSchemes({ darkScheme: 'paper', lightScheme: 'ink' })).toEqual({ darkScheme: 'nodus', lightScheme: 'nodus' })
    expect(normalizeSchemes({ darkScheme: 'solarized', lightScheme: 42 })).toEqual({ darkScheme: 'nodus', lightScheme: 'nodus' })
  })
})
