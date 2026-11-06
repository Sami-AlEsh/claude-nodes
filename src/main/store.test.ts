import { describe, expect, it, vi } from 'vitest'
import { normalizeSettings } from './store'

vi.mock('electron', () => ({ app: {} }))

describe('normalizeSettings', () => {
  it('keeps the mouse with the keyboard unless mouse only was picked', () => {
    expect(normalizeSettings(null).mouseMode).toBe('withKeyboard')
    expect(normalizeSettings({}).mouseMode).toBe('withKeyboard')
    expect(normalizeSettings({ mouseMode: 'mouseOnly' }).mouseMode).toBe('mouseOnly')
    expect(normalizeSettings({ mouseMode: 'withKeyboard' }).mouseMode).toBe('withKeyboard')
  })

  it('drops mouse modes this version doesn’t know', () => {
    expect(normalizeSettings({ mouseMode: 'oneHand' }).mouseMode).toBe('withKeyboard')
    expect(normalizeSettings({ mouseMode: true }).mouseMode).toBe('withKeyboard')
  })

  it('hides the person’s own status line unless they turned it on', () => {
    expect(normalizeSettings(null).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({}).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({ showOwnStatusLine: 'yes' }).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({ showOwnStatusLine: true }).showOwnStatusLine).toBe(true)
  })

  it('gives terminals the bundled font at 14 px unless they were set, within the size limits', () => {
    expect(normalizeSettings({})).toMatchObject({ terminalFont: 'JetBrains Mono', terminalFontSize: 14 })
    expect(normalizeSettings({ terminalFont: 'Menlo', terminalFontSize: 40 })).toMatchObject({
      terminalFont: 'Menlo',
      terminalFontSize: 24
    })
  })
})

describe('the project panel’s settings', () => {
  it('starts folded at 360 px, and remembers being left open and its width', () => {
    expect(normalizeSettings(null)).toMatchObject({ panelOpen: false, panelWidth: 360 })
    expect(normalizeSettings({ panelOpen: true, panelWidth: 480 })).toMatchObject({
      panelOpen: true,
      panelWidth: 480
    })
    expect(normalizeSettings({ panelWidth: 10 }).panelWidth).toBe(280)
  })
})
