// The terminal's font and size, as Settings holds them, and the font stack
// xterm gets from them. Shared because the main process normalizes the
// settings and the renderer draws with them.

/** Shipped with the app (fonts.css): the default text face, and the symbols shell prompts use, one cell each. */
export const DEFAULT_TERMINAL_FONT = 'JetBrains Mono'
export const SYMBOLS_FONT = 'Symbols Nerd Font Mono'

export const DEFAULT_TERMINAL_FONT_SIZE = 14
export const MIN_TERMINAL_FONT_SIZE = 9
export const MAX_TERMINAL_FONT_SIZE = 24

export interface TerminalFont {
  terminalFont: string
  terminalFontSize: number
}

/** The font settings with anything missing or unusable replaced: an empty font is the default, and the size is a whole number within the limits. */
export function normalizeTerminalFont(raw: Partial<Record<keyof TerminalFont, unknown>>): TerminalFont {
  const font = typeof raw.terminalFont === 'string' ? raw.terminalFont.trim() : ''
  const size =
    typeof raw.terminalFontSize === 'number' && Number.isFinite(raw.terminalFontSize)
      ? Math.round(raw.terminalFontSize)
      : DEFAULT_TERMINAL_FONT_SIZE
  return {
    terminalFont: font || DEFAULT_TERMINAL_FONT,
    terminalFontSize: Math.min(MAX_TERMINAL_FONT_SIZE, Math.max(MIN_TERMINAL_FONT_SIZE, size))
  }
}

/**
 * xterm's `fontFamily` for a chosen font: the font, then the symbols face,
 * so every font gets a prompt's arrows and branch sign, then the fonts
 * terminals used before, in case the chosen one is missing.
 */
export function terminalFontFamily(family: string): string {
  const quote = (name: string) => `'${name.replace(/'/g, "\\'")}'`
  const stack = [quote(family), quote(SYMBOLS_FONT), quote('SF Mono'), 'ui-monospace', quote('Menlo'), quote('Monaco'), 'monospace']
  return stack.filter((name, i) => stack.indexOf(name) === i).join(', ')
}

/** Monospace fonts worth looking for on a Mac, the bundled one first. Settings offers the ones that are there. */
export const FONT_CANDIDATES = [
  DEFAULT_TERMINAL_FONT,
  'SF Mono',
  'Menlo',
  'Monaco',
  'Courier New',
  'Andale Mono',
  'PT Mono',
  'Hack',
  'Hack Nerd Font',
  'Hack Nerd Font Mono',
  'JetBrainsMono Nerd Font',
  'Fira Code',
  'Fira Mono',
  'FiraCode Nerd Font',
  'Cascadia Code',
  'Cascadia Mono',
  'Source Code Pro',
  'SauceCodePro Nerd Font',
  'IBM Plex Mono',
  'Geist Mono',
  'GeistMono Nerd Font',
  'Iosevka',
  'Iosevka Term',
  'Inconsolata',
  'Roboto Mono',
  'Ubuntu Mono',
  'DejaVu Sans Mono',
  'Liberation Mono',
  'Noto Sans Mono',
  'Space Mono',
  'Anonymous Pro',
  'Meslo LG M',
  'MesloLGS NF',
  'MesloLGS Nerd Font',
  'Consolas',
  'Victor Mono',
  'Berkeley Mono',
  'MonoLisa',
  'Operator Mono',
  'Dank Mono',
  'Input Mono',
  'Hasklig',
  'Monaspace Neon',
  'Monaspace Argon',
  'Commit Mono',
  'Maple Mono',
  'Comic Mono',
  '0xProto',
  'Zed Mono',
  'Recursive Mono Linear Static',
  'Intel One Mono'
]
