import type { MouseMode } from '@shared/types'

/** A step of the Settings mouse demo: its name, and what's held for it, shown in the board's corner. */
export interface MouseDemoStep {
  label: string
  /** A key held for the step. */
  key?: string
  /** A mouse button held for the step, other than the left one. */
  button?: 'right'
}

/** What the mouse does in each mode, in the order the demo plays them: pan, zoom, select. */
export const MOUSE_DEMO_STEPS: Record<MouseMode, MouseDemoStep[]> = {
  withKeyboard: [
    { label: 'Space + drag to pan', key: 'Space' },
    { label: '⌘ + wheel to zoom', key: '⌘' },
    { label: 'Drag to select' }
  ],
  mouseOnly: [
    { label: 'Right-drag to pan', button: 'right' },
    { label: '⌘ + wheel to zoom', key: '⌘' },
    { label: 'Drag to select' }
  ]
}
