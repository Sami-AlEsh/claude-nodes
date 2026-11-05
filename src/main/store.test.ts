import { describe, expect, it, vi } from 'vitest'
import { normalizeSettings } from './store'

vi.mock('electron', () => ({ app: {} }))

describe('normalizeSettings', () => {
  it('keeps today’s trackpad navigation unless mouse was picked', () => {
    expect(normalizeSettings(null).navigation).toBe('trackpad')
    expect(normalizeSettings({}).navigation).toBe('trackpad')
    expect(normalizeSettings({ navigation: 'mouse' }).navigation).toBe('mouse')
    expect(normalizeSettings({ navigation: 'trackpad' }).navigation).toBe('trackpad')
  })

  it('drops navigation modes this version doesn’t know', () => {
    expect(normalizeSettings({ navigation: 'pen' }).navigation).toBe('trackpad')
    expect(normalizeSettings({ navigation: true }).navigation).toBe('trackpad')
  })

  it('hides the person’s own status line unless they turned it on', () => {
    expect(normalizeSettings(null).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({}).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({ showOwnStatusLine: 'yes' }).showOwnStatusLine).toBe(false)
    expect(normalizeSettings({ showOwnStatusLine: true }).showOwnStatusLine).toBe(true)
  })
})
