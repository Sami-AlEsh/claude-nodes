import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TERMINAL_FONT,
  DEFAULT_TERMINAL_FONT_SIZE,
  FONT_CANDIDATES,
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  normalizeTerminalFont,
  terminalFontFamily
} from './terminalFont'

describe('normalizeTerminalFont', () => {
  it('gives the bundled font at 14 px unless something else is set', () => {
    expect(normalizeTerminalFont({})).toEqual({ terminalFont: DEFAULT_TERMINAL_FONT, terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE })
    expect(normalizeTerminalFont({ terminalFont: 'Menlo', terminalFontSize: 16 })).toEqual({
      terminalFont: 'Menlo',
      terminalFontSize: 16
    })
  })

  it('trims the font and falls back from an empty or non-string one', () => {
    expect(normalizeTerminalFont({ terminalFont: '  Monaco ' }).terminalFont).toBe('Monaco')
    expect(normalizeTerminalFont({ terminalFont: '   ' }).terminalFont).toBe(DEFAULT_TERMINAL_FONT)
    expect(normalizeTerminalFont({ terminalFont: 14 }).terminalFont).toBe(DEFAULT_TERMINAL_FONT)
  })

  it('keeps the size a whole number within the limits', () => {
    expect(normalizeTerminalFont({ terminalFontSize: 13.6 }).terminalFontSize).toBe(14)
    expect(normalizeTerminalFont({ terminalFontSize: 1 }).terminalFontSize).toBe(MIN_TERMINAL_FONT_SIZE)
    expect(normalizeTerminalFont({ terminalFontSize: 99 }).terminalFontSize).toBe(MAX_TERMINAL_FONT_SIZE)
    expect(normalizeTerminalFont({ terminalFontSize: NaN }).terminalFontSize).toBe(DEFAULT_TERMINAL_FONT_SIZE)
    expect(normalizeTerminalFont({ terminalFontSize: '16' }).terminalFontSize).toBe(DEFAULT_TERMINAL_FONT_SIZE)
  })
})

describe('terminalFontFamily', () => {
  it('puts the font first, then the prompt symbols, then the fonts terminals used before', () => {
    expect(terminalFontFamily('JetBrains Mono')).toBe(
      "'JetBrains Mono', 'Symbols Nerd Font', 'SF Mono', ui-monospace, 'Menlo', 'Monaco', monospace"
    )
  })

  it('doesn’t repeat a font already in the stack', () => {
    expect(terminalFontFamily('Menlo')).toBe("'Menlo', 'Symbols Nerd Font', 'SF Mono', ui-monospace, 'Monaco', monospace")
  })

  it('quotes a name with a quote in it', () => {
    expect(terminalFontFamily("Sami's Mono")).toMatch(/^'Sami\\'s Mono', /)
  })
})

describe('FONT_CANDIDATES', () => {
  it('starts with the bundled font and has no duplicates', () => {
    expect(FONT_CANDIDATES[0]).toBe(DEFAULT_TERMINAL_FONT)
    expect(new Set(FONT_CANDIDATES).size).toBe(FONT_CANDIDATES.length)
  })
})
