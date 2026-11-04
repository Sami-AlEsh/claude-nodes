import { describe, expect, it, vi } from 'vitest'
import { normalizeSettings } from './store'

vi.mock('electron', () => ({ app: {} }))

describe('normalizeSettings', () => {
  it('keeps today’s board controls unless one hand was picked', () => {
    expect(normalizeSettings(null).boardControls).toBe('twoHands')
    expect(normalizeSettings({}).boardControls).toBe('twoHands')
    expect(normalizeSettings({ boardControls: 'oneHand' }).boardControls).toBe('oneHand')
    expect(normalizeSettings({ boardControls: 'twoHands' }).boardControls).toBe('twoHands')
  })

  it('drops board controls this version doesn’t know', () => {
    expect(normalizeSettings({ boardControls: 'mouse' }).boardControls).toBe('twoHands')
    expect(normalizeSettings({ boardControls: true }).boardControls).toBe('twoHands')
  })
})
