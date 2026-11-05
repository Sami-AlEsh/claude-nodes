// How the mouse moves around the board, as picked in Settings › Board ›
// Mouse. Keyboard + mouse: scrolling pans, ⌘-scroll zooms, and dragging the
// canvas draws a selection box. Mouse only: dragging the canvas pans and
// ⇧-drag draws the box, while ⌘-scroll still zooms. A trackpad works the
// same in both. It's all React Flow's props, swapped while ⇧ is held.
import type { ReactFlowProps } from '@xyflow/react'
import type { MouseMode } from '@shared/types'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2

export type MouseControlProps = Pick<
  ReactFlowProps,
  | 'panOnScroll'
  | 'zoomOnPinch'
  | 'selectionOnDrag'
  | 'panOnDrag'
  | 'panActivationKeyCode'
  | 'selectionKeyCode'
  | 'multiSelectionKeyCode'
  | 'paneClickDistance'
>

// Constants, so React Flow sees the same arrays from one render to the next.
const WITH_KEYBOARD: MouseControlProps = {
  panOnScroll: true,
  zoomOnPinch: true,
  selectionOnDrag: true,
  // Middle-drag pans, and so does any drag with Space held.
  panOnDrag: [1],
  panActivationKeyCode: 'Space',
  selectionKeyCode: null,
  multiSelectionKeyCode: ['Meta', 'Shift']
}

const MOUSE_ONLY: MouseControlProps = {
  ...WITH_KEYBOARD,
  selectionOnDrag: false,
  panOnDrag: [0, 1],
  // A left press on the canvas now starts a pan, so a click that wobbles a
  // pixel or two would be a pan too, and wouldn't clear the selection or
  // close a menu. A few pixels still count as a click.
  paneClickDistance: 4
}

/**
 * The React Flow props for `mode`. In Mouse only, holding ⇧ gives the canvas
 * the keyboard mode's left-drag, which draws a selection box. That's done here
 * rather than with React Flow's `selectionKeyCode: 'Shift'`, which would also
 * start a box from a ⇧-press on a card, so ⇧-click could no longer add a card
 * to the selection, nor ⇧-drag move one.
 */
export function mouseControls(mode: MouseMode, shiftHeld: boolean): MouseControlProps {
  return mode === 'mouseOnly' && !shiftHeld ? MOUSE_ONLY : WITH_KEYBOARD
}

/**
 * Follows ⇧ for the Mouse only selection box, calling `onChange` when the
 * board should swap its props. Never while a button is down: React Flow
 * finishes a press with the props it ends under, so swapping them mid-press
 * (⇧ let go before the button) would leave a selection box half-started, and
 * the next ⇧ and move would draw it with no button held. The swap waits for
 * the release.
 */
export function shiftTracker(onChange: (held: boolean) => void) {
  let held = false
  let wanted = false
  let pressed = false
  const settle = () => {
    if (pressed || wanted === held) return
    held = wanted
    onChange(held)
  }
  return {
    key(e: { shiftKey: boolean }) {
      wanted = e.shiftKey
      settle()
    },
    pointer(e: { shiftKey: boolean; buttons: number }) {
      pressed = e.buttons !== 0
      wanted = e.shiftKey
      settle()
    },
    blur() {
      pressed = false
      wanted = false
      settle()
    }
  }
}
