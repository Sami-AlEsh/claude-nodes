// The terminal's font on this Mac: loading the bundled faces before any
// terminal is measured, finding which candidate fonts are installed, and
// following the font picked in Settings.
import {
  DEFAULT_TERMINAL_FONT,
  DEFAULT_TERMINAL_FONT_SIZE,
  FONT_CANDIDATES,
  SYMBOLS_FONT,
  normalizeTerminalFont
} from '@shared/terminalFont'
import type { AppSettings } from '@shared/types'
import { useApp } from '@renderer/store'
import { setTerminalFont } from './registry'

/**
 * Loads the fonts shipped with the app: the text face upright and italic
 * (a style not loaded would be drawn in a fallback the first time, and cached
 * that way in xterm's glyph atlas), and the symbols. xterm measures its font
 * when a terminal is created, and terminals are created synchronously, so
 * this runs before React renders anything. It rejects for a face that can't
 * be fetched; main.tsx renders anyway then, in the fallback.
 */
export function loadBundledFonts(): Promise<unknown> {
  const size = `${DEFAULT_TERMINAL_FONT_SIZE}px`
  return Promise.all([
    document.fonts.load(`${size} '${DEFAULT_TERMINAL_FONT}'`),
    document.fonts.load(`italic ${size} '${DEFAULT_TERMINAL_FONT}'`),
    document.fonts.load(`${size} '${SYMBOLS_FONT}'`)
  ])
}

/**
 * The candidate fonts installed on this Mac, bundled ones included.
 * `document.fonts.check` can't tell whether a system font exists, so each is
 * measured instead: a test string drawn in the family comes out a different
 * width from the generic fallback, in at least one of two fallbacks, when
 * the family is really there.
 */
export function installedFonts(): string[] {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return [FONT_CANDIDATES[0]]
  const sample = 'mmmmmmmmmmlli1|WWW@#'
  const width = (font: string) => {
    ctx.font = `16px ${font}`
    return ctx.measureText(sample).width
  }
  const mono = width('monospace')
  const serif = width('serif')
  return FONT_CANDIDATES.filter((family) => {
    const quoted = `'${family.replace(/'/g, "\\'")}'`
    return width(`${quoted}, monospace`) !== mono || width(`${quoted}, serif`) !== serif
  })
}

/** Gives terminals the font from Settings, from the saved settings before anything is drawn, then whenever they change. */
export function followTerminalFont() {
  // Normalized again here: settings from an older main process (a dev
  // session that hasn't restarted) can lack the font, and the defaults apply.
  const apply = (settings: Partial<AppSettings>) => {
    const { terminalFont, terminalFontSize } = normalizeTerminalFont(settings)
    setTerminalFont(terminalFont, terminalFontSize)
  }
  apply(window.api.settings.getSync())
  useApp.subscribe((state) => {
    if (state.settings) apply(state.settings)
  })
}
