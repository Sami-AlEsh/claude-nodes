import { describe, expect, it } from 'vitest'
import { MOUSE_DEMO_STEPS } from './mouseDemoSteps'

describe('MOUSE_DEMO_STEPS', () => {
  it('plays pan, zoom and select in both modes, as the demo’s animation does', () => {
    for (const steps of Object.values(MOUSE_DEMO_STEPS)) {
      expect(steps.map((s) => s.label.match(/to (\w+)$/)?.[1])).toEqual(['pan', 'zoom', 'select'])
    }
  })

  it('keeps the keyboard mode’s steps', () => {
    expect(MOUSE_DEMO_STEPS.withKeyboard).toEqual([
      { label: 'Space + drag to pan', key: 'Space' },
      { label: '⌘ + wheel to zoom', key: '⌘' },
      { label: 'Drag to select' }
    ])
  })

  it('pans with the right button for the mouse alone, and selects with a plain drag', () => {
    expect(MOUSE_DEMO_STEPS.mouseOnly).toEqual([
      { label: 'Right-drag to pan', button: 'right' },
      { label: '⌘ + wheel to zoom', key: '⌘' },
      { label: 'Drag to select' }
    ])
  })

  it('shows at most one thing held per step', () => {
    for (const step of Object.values(MOUSE_DEMO_STEPS).flat()) {
      expect(Boolean(step.key) && Boolean(step.button)).toBe(false)
    }
  })
})
