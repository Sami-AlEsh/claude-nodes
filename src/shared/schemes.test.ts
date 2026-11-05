import { describe, expect, it } from 'vitest'
import {
  DARK_SCHEMES,
  mix,
  normalizeSchemes,
  schemeColors,
  schemeCss,
  schemeTile,
  schemeTokens,
  terminalTheme,
  terminalTokens,
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
  'atom-one-dark': ['#21252b', '#1c1f24', '#35393e', '#2e3238', '#eeeeef', '#9c9ea1', '#6f7175', '#61afef']
} as const

const schemes = DARK_SCHEMES.map((s) => s.id)

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
      const c = schemeColors(name as keyof typeof DERIVED)
      expect([c.window, c.board, c.cards, c.toolbar, c.text, c.text2, c.text3, c.accent], name).toEqual(expected)
    }
  })

  it('takes the palettes’ own colours for the accent’s hover and the diff and view colours', () => {
    expect(schemeColors('ink')).toMatchObject({
      accentHover: '#accbfa',
      onAccent: '#111720',
      green: '#89c5aa',
      red: '#e58c9a',
      yellow: '#d9be82',
      purple: '#b9a0e2'
    })
  })

  it('lifts the hover toward white when a palette gives one blue for both, as Atom One Dark does', () => {
    const c = schemeColors('atom-one-dark')
    expect(c.accent).toBe('#61afef')
    expect(c.accentHover).toBe('#79bbf1')
  })
})

describe('schemeTokens', () => {
  it('maps a scheme onto the board’s tokens, keeping today’s opacities', () => {
    expect(schemeTokens('graphite')).toEqual({
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
  })

  it('sets the same tokens in every scheme, so none is left over from another', () => {
    const keys = Object.keys(schemeTokens('nodus')).sort()
    for (const id of schemes) expect(Object.keys(schemeTokens(id)).sort(), id).toEqual(keys)
  })

  it('never touches status colours', () => {
    for (const id of schemes) {
      expect(Object.keys(schemeTokens(id)).filter((n) => /status/.test(n)), id).toEqual([])
      // Views' orange is the working status's.
      expect(viewTokens(id)['--nodus-orange'], id).toBe(viewTokens('nodus')['--nodus-orange'])
    }
    expect(schemeCss({ darkScheme: 'atom-one-dark' })).not.toMatch(/--status/)
  })
})

describe('viewTokens', () => {
  it('gives views today’s dark colours in Nodus’s scheme', () => {
    expect(viewTokens('nodus')).toEqual({
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
    expect(viewTokens('moss')).toMatchObject({
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
    expect(schemeTile('atom-one-dark')).toEqual({
      background: '#21252b',
      text: '#abb2bf',
      dots: ['#61afef', '#e06c75', '#98c379', '#e5c07b', '#c678dd']
    })
    expect(schemeTile('nodus').background).toBe('#1e1e20')
  })
})

describe('windowColor', () => {
  it('is the window’s colour in the mode showing, and light mode is always Nodus’s', () => {
    expect(windowColor({ darkScheme: 'nodus' }, true)).toBe('#1e1e20')
    expect(windowColor({ darkScheme: 'nodus' }, false)).toBe('#f5f5f4')
    expect(windowColor({ darkScheme: 'ink' }, true)).toBe('#111720')
    expect(windowColor({ darkScheme: 'ink' }, false)).toBe('#f5f5f4')
  })
})

describe('schemeCss', () => {
  it('adds nothing for Nodus’s own colours', () => {
    expect(schemeCss({ darkScheme: 'nodus' })).toBe('')
  })

  it('puts the board’s tokens in a dark-mode block, so light mode’s board is left alone', () => {
    const css = schemeCss({ darkScheme: 'ink' })
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).not.toContain('prefers-color-scheme: light')
    expect(css).toContain('--bg-window: #111720;')
    expect(css).toContain(':root:root {')
  })

  it('sets the terminal’s tokens outside the dark-mode block, since terminals are always dark', () => {
    const css = schemeCss({ darkScheme: 'ink' })
    const media = css.indexOf('@media')
    const mediaEnd = css.indexOf('\n}\n', media) + 3
    expect(css.slice(mediaEnd)).toContain('--term-bg: #111720;')
    expect(css.slice(mediaEnd)).toContain('--term-fg: #cdd6e4;')
    expect(css.slice(media, mediaEnd)).not.toContain('--term-')
  })
})

describe('viewCss', () => {
  it('has Nodus’s light colours, then the scheme’s dark ones', () => {
    const css = viewCss({ darkScheme: 'graphite' })
    expect(css.indexOf('--nodus-bg: #ffffff;')).toBeLessThan(css.indexOf('@media (prefers-color-scheme: dark)'))
    expect(css.indexOf('--nodus-bg: #2c2e31;')).toBeGreaterThan(css.indexOf('@media (prefers-color-scheme: dark)'))
  })
})

describe('terminalTheme', () => {
  it('keeps today’s terminal for Nodus’s scheme', () => {
    expect(terminalTheme('nodus')).toEqual({
      background: '#1e1e20',
      foreground: '#e6e6e6',
      cursor: '#e6e6e6',
      cursorAccent: '#1e1e20',
      selectionBackground: '#0a84ff55',
      selectionInactiveBackground: '#8e8e9340',
      scrollbarSliderBackground: '#ffffff1f',
      scrollbarSliderHoverBackground: '#ffffff33',
      scrollbarSliderActiveBackground: '#ffffff47',
      black: '#3a3a3c',
      red: '#ff6b62',
      green: '#5fd068',
      yellow: '#f5c451',
      blue: '#5aa9ff',
      magenta: '#d68cf7',
      cyan: '#5ad1e0',
      white: '#d8d8dc',
      brightBlack: '#6e6e73',
      brightRed: '#ff8a80',
      brightGreen: '#7fe08a',
      brightYellow: '#ffd978',
      brightBlue: '#80bdff',
      brightMagenta: '#e2a8fb',
      brightCyan: '#80e2ee',
      brightWhite: '#f5f5f7'
    })
  })

  it('draws a scheme’s terminal in its palette: ground, text, cursor, selection and herdr’s 16 colours', () => {
    expect(terminalTheme('ink')).toMatchObject({
      background: '#111720',
      foreground: '#cdd6e4',
      cursor: '#cdd6e4',
      cursorAccent: '#111720',
      selectionBackground: '#344861',
      selectionInactiveBackground: '#8e8e9340',
      black: '#414b5a',
      red: '#e58c9a',
      green: '#89c5aa',
      yellow: '#d9be82',
      blue: '#91b6ee',
      magenta: '#b9a0e2',
      cyan: '#85c4d0',
      white: '#cdd6e4',
      brightBlack: '#7f91a7',
      brightRed: '#f5a5b2',
      brightGreen: '#a5dec3',
      brightYellow: '#edd39c',
      brightBlue: '#accbfa',
      brightMagenta: '#d0b7f4',
      brightCyan: '#a0dce5',
      brightWhite: '#f0f5fc'
    })
    // Atom One Dark names its own cursor.
    expect(terminalTheme('atom-one-dark')).toMatchObject({ cursor: '#abb2bf', selectionBackground: '#323844', blue: '#61afef' })
  })

  it('gives every scheme the same keys, all set', () => {
    const keys = Object.keys(terminalTheme('nodus')).sort()
    for (const id of schemes) {
      const theme = terminalTheme(id)
      expect(Object.keys(theme).sort(), id).toEqual(keys)
      for (const [key, value] of Object.entries(theme)) expect(value, `${id} ${key}`).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/)
    }
  })

  it('gives the frame around a terminal the theme’s ground and text, and the preview its three colours', () => {
    expect(terminalTokens('moss')).toEqual({
      '--term-bg': '#151c19',
      '--term-fg': '#cdd7ce',
      '--term-black': '#435248',
      '--term-blue': '#99b9cd',
      '--term-green': '#a0c4a2'
    })
    expect(terminalTokens('nodus')).toEqual({
      '--term-bg': '#1e1e20',
      '--term-fg': '#e6e6e6',
      '--term-black': '#3a3a3c',
      '--term-blue': '#5aa9ff',
      '--term-green': '#5fd068'
    })
  })
})

describe('normalizeSchemes', () => {
  it('keeps known schemes and turns anything else into Nodus’s', () => {
    expect(normalizeSchemes({ darkScheme: 'atom-one-dark' })).toEqual({ darkScheme: 'atom-one-dark' })
    expect(normalizeSchemes({})).toEqual({ darkScheme: 'nodus' })
    // A name that isn't one of the dark schemes.
    expect(normalizeSchemes({ darkScheme: 'paper' })).toEqual({ darkScheme: 'nodus' })
    expect(normalizeSchemes({ darkScheme: 42 })).toEqual({ darkScheme: 'nodus' })
  })
})
