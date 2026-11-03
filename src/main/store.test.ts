import { describe, expect, it, vi } from 'vitest'
import { normalizeSettings } from './store'

vi.mock('electron', () => ({ app: {} }))

describe('normalizeSettings', () => {
  it('keeps sessions running unless told otherwise', () => {
    expect(normalizeSettings(null).stopIdleAfter).toBeNull()
    expect(normalizeSettings({}).stopIdleAfter).toBeNull()
  })

  it('keeps a saved idle limit that’s one of the choices', () => {
    expect(normalizeSettings({ stopIdleAfter: 30 }).stopIdleAfter).toBe(30)
    expect(normalizeSettings({ stopIdleAfter: 120 }).stopIdleAfter).toBe(120)
  })

  it('drops an idle limit this version doesn’t offer', () => {
    expect(normalizeSettings({ stopIdleAfter: 7 }).stopIdleAfter).toBeNull()
    expect(normalizeSettings({ stopIdleAfter: '30' }).stopIdleAfter).toBeNull()
  })
})
