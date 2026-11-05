import { describe, expect, it, vi } from 'vitest'
import { normalizeSettings } from './store'

vi.mock('electron', () => ({ app: {} }))

describe('normalizeSettings', () => {
  it('hides the person’s own status line unless they turned it on', () => {
    expect(normalizeSettings(null).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({}).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({ showOwnStatusLine: 'yes' }).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({ showOwnStatusLine: true }).showOwnStatusLine).toBe(true)
  })
})
