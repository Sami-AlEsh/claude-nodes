import { describe, expect, it, vi } from 'vitest'
import { normalizeSettings } from './store'

vi.mock('electron', () => ({ app: {} }))

describe('normalizeSettings', () => {
  it('starts in light mode when no theme was saved', () => {
    expect(normalizeSettings(null).theme).toBe('light')
    expect(normalizeSettings({}).theme).toBe('light')
  })

  it('keeps a saved theme, System included', () => {
    expect(normalizeSettings({ theme: 'system' }).theme).toBe('system')
    expect(normalizeSettings({ theme: 'dark' }).theme).toBe('dark')
  })

  it('drops a theme this version doesn’t know', () => {
    expect(normalizeSettings({ theme: 'sepia' }).theme).toBe('light')
  })
})
