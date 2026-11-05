// Colour schemes: the colours Nodus uses while it's dark, and while it's
// light, picked in Settings. 'nodus' is the look of tokens.css; every other
// scheme overrides a fixed set of its tokens on the board, and of the
// --nodus-* variables in views' pages.
//
// The palettes are herdr-app's (https://github.com/herdrdev/herdr-app,
// Apache-2.0): its graphite, ink, moss and paper presets (src/settings.rs),
// and its copy of Atom One Dark (defaults/themes/atom-one-dark.json), the
// colours of Atom's One Dark theme (MIT). The chrome is derived from each
// palette with herdr's own rule (`resolve()`), so no colour here is picked by
// hand.
//
// Two things never change with the scheme: the status colours (working
// orange, needs-you red, done blue), and the terminals, whose colours stay
// --term-bg, --term-fg and TERMINAL_THEME in every scheme.

import type { AppSettings, DarkScheme, LightScheme } from './types'

export type Mode = 'light' | 'dark'

/** The pair of schemes in use, as AppSettings holds them. */
export type Schemes = Pick<AppSettings, 'darkScheme' | 'lightScheme'>

export const DARK_SCHEMES: { id: DarkScheme; name: string }[] = [
  { id: 'nodus', name: 'Nodus' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'ink', name: 'Ink' },
  { id: 'moss', name: 'Moss' },
  { id: 'atom-one-dark', name: 'Atom One Dark' }
]

export const LIGHT_SCHEMES: { id: LightScheme; name: string }[] = [
  { id: 'nodus', name: 'Nodus' },
  { id: 'paper', name: 'Paper' }
]

export const NODUS_SCHEMES: Schemes = { darkScheme: 'nodus', lightScheme: 'nodus' }

/** Anything this version doesn't know is 'nodus'. */
export function normalizeSchemes(raw: Partial<Record<keyof Schemes, unknown>>): Schemes {
  const known = <T extends string>(list: { id: T }[], value: unknown): T =>
    list.find((s) => s.id === value)?.id ?? ('nodus' as T)
  return { darkScheme: known(DARK_SCHEMES, raw.darkScheme), lightScheme: known(LIGHT_SCHEMES, raw.lightScheme) }
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

const PALETTES: Record<Exclude<DarkScheme | LightScheme, 'nodus'>, Palette> = {
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
  },
  paper: {
    background: '#ffffff',
    foreground: '#25272c',
    blue: '#1f62d0',
    brightBlue: '#0969da',
    red: '#c62a2a',
    green: '#1a7f37',
    yellow: '#8f5d00',
    purple: '#7a45c8'
  }
}

const rgb = (color: string) => {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hex = (channels: number[]) => '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('')

/**
 * herdr's mix: `t` of the way from a to b, channel by channel. herdr does it
 * in f32, and so does this (Math.fround at every step), because doubles round
 * a few channels the other way: Paper's secondary text would be #69696a, not
 * herdr's #69696b.
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
 * herdr's rule, mapped onto Nodus's layers. Dark: the board steps 16% toward
 * black, cards 9% and the title bar 6% toward white, with the palette's ground
 * as the window, which keeps Nodus's order (board darkest, cards lightest).
 * Light: the window and title bar are 60% of the way to warm grey, the board
 * 20%, and cards are the palette's ground. herdr's text and its two dimmer
 * steps, and its accent, the palette's blue.
 */
export function schemeColors(mode: Mode, name: Exclude<DarkScheme | LightScheme, 'nodus'>): SchemeColors {
  const p = PALETTES[name]
  const bg = p.background
  const light = mode === 'light'
  const text = light ? '#1b1b1e' : '#eeeeef'
  const warm = '#e8e8e2'
  return {
    window: light ? mix(bg, warm, 0.6) : bg,
    board: light ? mix(bg, warm, 0.2) : mix(bg, '#000000', 0.16),
    cards: light ? bg : mix(bg, '#ffffff', 0.09),
    toolbar: light ? mix(bg, warm, 0.6) : mix(bg, '#ffffff', 0.06),
    text,
    text2: mix(bg, text, light ? 0.66 : 0.6),
    text3: mix(bg, text, light ? 0.46 : 0.38),
    accent: p.blue,
    // Atom One Dark gives one blue for both, so its hover is lifted toward
    // white (darkened, in light mode), as Nodus's own is.
    accentHover: p.brightBlue !== p.blue ? p.brightBlue : mix(p.blue, light ? '#000000' : '#ffffff', 0.15),
    onAccent: bg,
    green: p.green,
    red: p.red,
    yellow: p.yellow,
    purple: p.purple
  }
}

export type Tokens = Record<string, string>

/**
 * Today's values (tokens.css) of every board token a scheme sets. A scheme
 * leaves everything else alone: status and terminal colours, and the
 * translucent hovers, borders, shadows and marks, which work on any ground.
 * tokens.test.ts holds these to tokens.css.
 */
const NODUS_BOARD: Record<Mode, Tokens> = {
  light: {
    '--bg-window': '#f5f5f4',
    '--bg-toolbar': 'rgba(246, 246, 245, 0.82)',
    '--bg-canvas': '#f3f3f1',
    '--bg-elevated': '#ffffff',
    '--bg-selected': 'rgba(0, 122, 255, 0.14)',
    '--text-primary': 'rgba(0, 0, 0, 0.88)',
    '--text-secondary': 'rgba(0, 0, 0, 0.56)',
    '--text-tertiary': 'rgba(0, 0, 0, 0.36)',
    '--text-on-accent': '#ffffff',
    '--accent': '#007aff',
    '--accent-hover': '#0068d9',
    '--accent-gradient-to': '#5e5ce6',
    '--focus-ring': 'rgba(0, 122, 255, 0.5)',
    '--diff-add': '#2da44e',
    '--diff-del': '#cf222e',
    '--archive-drop': 'rgba(0, 122, 255, 0.08)',
    '--archive-panel': 'rgba(248, 248, 247, 0.8)',
    '--folder-label-selected': '#0063e1'
  },
  dark: {
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
}

/** The board's CSS variables in a scheme. Translucent ones keep tokens.css's opacities. */
export function schemeTokens(mode: 'dark', name: DarkScheme): Tokens
export function schemeTokens(mode: 'light', name: LightScheme): Tokens
export function schemeTokens(mode: Mode, name: DarkScheme | LightScheme): Tokens {
  if (name === 'nodus') return { ...NODUS_BOARD[mode] }
  const c = schemeColors(mode, name)
  const light = mode === 'light'
  return {
    '--bg-window': c.window,
    '--bg-toolbar': rgba(c.toolbar, 0.82),
    '--bg-canvas': c.board,
    '--bg-elevated': c.cards,
    '--bg-selected': rgba(c.accent, light ? 0.14 : 0.24),
    '--text-primary': c.text,
    '--text-secondary': c.text2,
    '--text-tertiary': c.text3,
    '--text-on-accent': c.onAccent,
    '--accent': c.accent,
    '--accent-hover': c.accentHover,
    '--accent-gradient-to': c.purple,
    '--focus-ring': rgba(c.accent, light ? 0.5 : 0.55),
    '--diff-add': c.green,
    '--diff-del': c.red,
    '--archive-drop': rgba(c.accent, light ? 0.08 : 0.12),
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
 * Every --nodus-* colour a view's page gets in a scheme. Orange is a status
 * colour, so it stays; the translucent ones work on any ground.
 */
export function viewTokens(mode: 'dark', name: DarkScheme): Tokens
export function viewTokens(mode: 'light', name: LightScheme): Tokens
export function viewTokens(mode: Mode, name: DarkScheme | LightScheme): Tokens {
  if (name === 'nodus') return { ...NODUS_VIEW[mode] }
  const c = schemeColors(mode, name)
  return {
    ...NODUS_VIEW[mode],
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

export function schemeTile(mode: 'dark', name: DarkScheme): SchemeTile
export function schemeTile(mode: 'light', name: LightScheme): SchemeTile
export function schemeTile(mode: Mode, name: DarkScheme | LightScheme): SchemeTile {
  if (name === 'nodus') {
    const v = NODUS_VIEW[mode]
    return {
      background: NODUS_BOARD[mode]['--bg-window'],
      text: v['--nodus-text'],
      dots: ['--nodus-accent', '--nodus-red', '--nodus-green', '--nodus-yellow', '--nodus-purple'].map((k) => v[k])
    }
  }
  const p = PALETTES[name]
  return { background: p.background, text: p.foreground, dots: [p.blue, p.red, p.green, p.yellow, p.purple] }
}

/** The colour behind the whole window (--bg-window) in the scheme the app shows now. */
export function windowColor(schemes: Schemes, dark: boolean): string {
  return dark
    ? schemeTokens('dark', schemes.darkScheme)['--bg-window']
    : schemeTokens('light', schemes.lightScheme)['--bg-window']
}

const declarations = (tokens: Tokens, indent: string) =>
  Object.entries(tokens)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n')

/**
 * The board's stylesheet for a pair of schemes: one block per mode that isn't
 * 'nodus', for the renderer's <style id="color-schemes">. `:root:root`
 * outranks tokens.css's `:root` wherever the two stylesheets end up in the
 * document.
 */
export function schemeCss(schemes: Schemes): string {
  const block = (mode: Mode, tokens: Tokens) =>
    `@media (prefers-color-scheme: ${mode}) {\n  :root:root {\n${declarations(tokens, '    ')}\n  }\n}\n`
  return (
    (schemes.lightScheme === 'nodus' ? '' : block('light', schemeTokens('light', schemes.lightScheme))) +
    (schemes.darkScheme === 'nodus' ? '' : block('dark', schemeTokens('dark', schemes.darkScheme)))
  )
}

/** A view page's colours for a pair of schemes: light, then dark. */
export function viewCss(schemes: Schemes): string {
  return (
    `:root {\n${declarations(viewTokens('light', schemes.lightScheme), '  ')}\n}\n` +
    `@media (prefers-color-scheme: dark) {\n  :root {\n${declarations(viewTokens('dark', schemes.darkScheme), '    ')}\n  }\n}\n`
  )
}
