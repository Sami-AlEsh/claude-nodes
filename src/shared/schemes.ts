// Colour schemes: the colours Nodus uses while it's dark, picked in Settings.
// 'nodus' is the look of tokens.css; every other scheme overrides a fixed set
// of its dark tokens on the board, and of the --nodus-* variables in views'
// pages. Light mode always keeps Nodus's own colours.
//
// The palettes are herdr-app's (https://github.com/herdrdev/herdr-app,
// Apache-2.0): its graphite, ink and moss presets (src/settings.rs),
// and its copy of Atom One Dark (defaults/themes/atom-one-dark.json), the
// colours of Atom's One Dark theme (MIT). The chrome is derived from each
// palette with herdr's own rule (`resolve()`), so no colour here is picked by
// hand.
//
// Two things never change with the scheme: the status colours (working
// orange, needs-you red, done blue), and the terminals, whose colours stay
// --term-bg, --term-fg and TERMINAL_THEME in every scheme.

import type { AppSettings, DarkScheme } from './types'

export type Mode = 'light' | 'dark'

/** The scheme in use, as AppSettings holds it. */
export type Schemes = Pick<AppSettings, 'darkScheme'>

export const DARK_SCHEMES: { id: DarkScheme; name: string }[] = [
  { id: 'nodus', name: 'Nodus' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'ink', name: 'Ink' },
  { id: 'moss', name: 'Moss' },
  { id: 'atom-one-dark', name: 'Atom One Dark' }
]

export const NODUS_SCHEMES: Schemes = { darkScheme: 'nodus' }

/** Anything this version doesn't know is 'nodus'. */
export function normalizeSchemes(raw: Partial<Record<keyof Schemes, unknown>>): Schemes {
  return { darkScheme: DARK_SCHEMES.find((s) => s.id === raw.darkScheme)?.id ?? 'nodus' }
}

/** What Nodus uses of a herdr palette: its ground and text, and five of its ANSI colours. */
interface Palette {
  background: string
  foreground: string
  /** ANSI blue (4) and bright blue (12): the accent and its hover. */
  blue: string
  brightBlue: string
  red: string
  green: string
  yellow: string
  purple: string
}

const PALETTES: Record<Exclude<DarkScheme, 'nodus'>, Palette> = {
  graphite: {
    background: '#17191d',
    foreground: '#d2d4d9',
    blue: '#96b2d7',
    brightBlue: '#b0cbef',
    red: '#dc8c95',
    green: '#a6bd91',
    yellow: '#d8be87',
    purple: '#b5a2ce'
  },
  ink: {
    background: '#111720',
    foreground: '#cdd6e4',
    blue: '#91b6ee',
    brightBlue: '#accbfa',
    red: '#e58c9a',
    green: '#89c5aa',
    yellow: '#d9be82',
    purple: '#b9a0e2'
  },
  moss: {
    background: '#151c19',
    foreground: '#cdd7ce',
    blue: '#99b9cd',
    brightBlue: '#b1d0e2',
    red: '#df978d',
    green: '#a0c4a2',
    yellow: '#d4bc8b',
    purple: '#bba4c8'
  },
  // Atom One Dark gives its blue for both; schemeColors lifts the hover.
  'atom-one-dark': {
    background: '#21252b',
    foreground: '#abb2bf',
    blue: '#61afef',
    brightBlue: '#61afef',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    purple: '#c678dd'
  }
}

const rgb = (color: string) => {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hex = (channels: number[]) => '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('')

/**
 * herdr's mix: `t` of the way from a to b, channel by channel. herdr does it
 * in f32, and so does this (Math.fround at every step), because doubles can
 * round a channel the other way: mixing #ffffff 66% toward #1b1b1e gives
 * herdr's #69696b in f32, #69696a in doubles.
 */
export function mix(a: string, b: string, t: number): string {
  const f = Math.fround
  const [x, y] = [rgb(a), rgb(b)]
  return hex(x.map((c, i) => Math.round(f(f(c * f(1 - f(t))) + f(y[i] * f(t))))))
}

const rgba = (color: string, alpha: number) => `rgba(${rgb(color).join(', ')}, ${alpha})`

/** A scheme's colours, derived from its palette as herdr's `resolve()` does. */
export interface SchemeColors {
  /** The window behind everything: the title bar's ground, the rail, the projects grid. */
  window: string
  /** The board behind the cards. */
  board: string
  /** Cards, menus, dialogs and views. */
  cards: string
  /** The title bar and the archive's panel, which sit translucent on top. */
  toolbar: string
  text: string
  text2: string
  text3: string
  accent: string
  accentHover: string
  /** Text on the accent: the palette's ground, since herdr's dark accents are pastel. */
  onAccent: string
  green: string
  red: string
  yellow: string
  purple: string
}

/**
 * herdr's dark rule, mapped onto Nodus's layers: the board steps 16% toward
 * black, cards 9% and the title bar 6% toward white, with the palette's ground
 * as the window, which keeps Nodus's order (board darkest, cards lightest).
 * herdr's text and its two dimmer steps, and its accent, the palette's blue.
 */
export function schemeColors(name: Exclude<DarkScheme, 'nodus'>): SchemeColors {
  const p = PALETTES[name]
  const bg = p.background
  const text = '#eeeeef'
  return {
    window: bg,
    board: mix(bg, '#000000', 0.16),
    cards: mix(bg, '#ffffff', 0.09),
    toolbar: mix(bg, '#ffffff', 0.06),
    text,
    text2: mix(bg, text, 0.6),
    text3: mix(bg, text, 0.38),
    accent: p.blue,
    // Atom One Dark gives one blue for both, so its hover is lifted toward
    // white, as Nodus's own dark hover is.
    accentHover: p.brightBlue !== p.blue ? p.brightBlue : mix(p.blue, '#ffffff', 0.15),
    onAccent: bg,
    green: p.green,
    red: p.red,
    yellow: p.yellow,
    purple: p.purple
  }
}

export type Tokens = Record<string, string>

/**
 * Today's dark values (tokens.css) of every board token a scheme sets. A
 * scheme leaves everything else alone: status and terminal colours, and the
 * translucent hovers, borders, shadows and marks, which work on any ground.
 * tokens.test.ts holds these to tokens.css.
 */
const NODUS_BOARD: Tokens = {
    '--bg-window': '#1e1e20',
    '--bg-toolbar': 'rgba(38, 38, 41, 0.82)',
    '--bg-canvas': '#19191b',
    '--bg-elevated': '#2a2a2d',
    '--bg-selected': 'rgba(10, 132, 255, 0.24)',
    '--text-primary': 'rgba(255, 255, 255, 0.9)',
    '--text-secondary': 'rgba(255, 255, 255, 0.58)',
    '--text-tertiary': 'rgba(255, 255, 255, 0.36)',
    '--text-on-accent': '#ffffff',
    '--accent': '#0a84ff',
    '--accent-hover': '#3396ff',
    '--accent-gradient-to': '#5e5ce6',
    '--focus-ring': 'rgba(10, 132, 255, 0.55)',
    '--diff-add': '#3fb950',
    '--diff-del': '#f85149',
    '--archive-drop': 'rgba(10, 132, 255, 0.12)',
    '--archive-panel': 'rgba(38, 38, 41, 0.8)',
    '--folder-label-selected': '#0a84ff'
}

/** The window's colour in light mode (tokens.css's --bg-window), which no scheme changes. */
const LIGHT_WINDOW = '#f5f5f4'

/** The board's dark CSS variables in a scheme. Translucent ones keep tokens.css's opacities. */
export function schemeTokens(name: DarkScheme): Tokens {
  if (name === 'nodus') return { ...NODUS_BOARD }
  const c = schemeColors(name)
  return {
    '--bg-window': c.window,
    '--bg-toolbar': rgba(c.toolbar, 0.82),
    '--bg-canvas': c.board,
    '--bg-elevated': c.cards,
    '--bg-selected': rgba(c.accent, 0.24),
    '--text-primary': c.text,
    '--text-secondary': c.text2,
    '--text-tertiary': c.text3,
    '--text-on-accent': c.onAccent,
    '--accent': c.accent,
    '--accent-hover': c.accentHover,
    '--accent-gradient-to': c.purple,
    '--focus-ring': rgba(c.accent, 0.55),
    '--diff-add': c.green,
    '--diff-del': c.red,
    '--archive-drop': rgba(c.accent, 0.12),
    '--archive-panel': rgba(c.toolbar, 0.8),
    '--folder-label-selected': c.accent
  }
}

/** Today's colours for views' pages (they used to be viewPage.ts's THEME). A view sits on a card, so its ground is the card's. */
const NODUS_VIEW: Record<Mode, Tokens> = {
  light: {
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
  },
  dark: {
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
  }
}

/**
 * Every --nodus-* colour a view's page gets in dark mode in a scheme. Orange
 * is a status colour, so it stays; the translucent ones work on any ground.
 */
export function viewTokens(name: DarkScheme): Tokens {
  if (name === 'nodus') return { ...NODUS_VIEW.dark }
  const c = schemeColors(name)
  return {
    ...NODUS_VIEW.dark,
    '--nodus-bg': c.cards,
    '--nodus-text': c.text,
    '--nodus-text-2': c.text2,
    '--nodus-text-3': c.text3,
    '--nodus-accent': c.accent,
    '--nodus-green': c.green,
    '--nodus-red': c.red,
    '--nodus-yellow': c.yellow,
    '--nodus-purple': c.purple
  }
}

/** What a scheme's tile in Settings shows: its ground, a bar of its text, and its blue, red, green, yellow and purple. */
export interface SchemeTile {
  background: string
  text: string
  dots: string[]
}

export function schemeTile(name: DarkScheme): SchemeTile {
  if (name === 'nodus') {
    const v = NODUS_VIEW.dark
    return {
      background: NODUS_BOARD['--bg-window'],
      text: v['--nodus-text'],
      dots: ['--nodus-accent', '--nodus-red', '--nodus-green', '--nodus-yellow', '--nodus-purple'].map((k) => v[k])
    }
  }
  const p = PALETTES[name]
  return { background: p.background, text: p.foreground, dots: [p.blue, p.red, p.green, p.yellow, p.purple] }
}

/** The colour behind the whole window (--bg-window) as the app shows now. */
export function windowColor(schemes: Schemes, dark: boolean): string {
  return dark ? schemeTokens(schemes.darkScheme)['--bg-window'] : LIGHT_WINDOW
}

const declarations = (tokens: Tokens, indent: string) =>
  Object.entries(tokens)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n')

/**
 * The board's stylesheet for a scheme, for the renderer's
 * <style id="color-schemes">: a dark-mode block, or nothing for 'nodus'.
 * `:root:root` outranks tokens.css's `:root` wherever the two stylesheets end
 * up in the document.
 */
export function schemeCss(schemes: Schemes): string {
  if (schemes.darkScheme === 'nodus') return ''
  const tokens = declarations(schemeTokens(schemes.darkScheme), '    ')
  return `@media (prefers-color-scheme: dark) {\n  :root:root {\n${tokens}\n  }\n}\n`
}

/** A view page's colours: Nodus's light ones, then the scheme's dark ones. */
export function viewCss(schemes: Schemes): string {
  return (
    `:root {\n${declarations(NODUS_VIEW.light, '  ')}\n}\n` +
    `@media (prefers-color-scheme: dark) {\n  :root {\n${declarations(viewTokens(schemes.darkScheme), '    ')}\n  }\n}\n`
  )
}
