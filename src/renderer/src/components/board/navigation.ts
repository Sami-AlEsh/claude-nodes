// How the pointer moves around the board, as picked in Settings › Board ›
// Controls. Two hands: scroll pans, ⌘-scroll or a pinch zooms, and dragging
// the canvas draws a selection box. One hand: dragging the canvas pans, the
// mouse wheel zooms and ⇧-drag draws the box, while a trackpad's two-finger
// scroll and pinch work as before. Most of it is React Flow's props; the one
// thing React Flow can't do is tell a mouse wheel from a trackpad scroll, so
// the board does that here.
import type { ReactFlowProps } from '@xyflow/react'
import type { Point } from '@shared/geometry'
import type { BoardControlsMode, Viewport } from '@shared/types'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2

export type BoardControlProps = Pick<
  ReactFlowProps,
  | 'panOnScroll'
  | 'zoomOnPinch'
  | 'selectionOnDrag'
  | 'panOnDrag'
  | 'panActivationKeyCode'
  | 'selectionKeyCode'
  | 'multiSelectionKeyCode'
>

// Constants, so React Flow sees the same arrays from one render to the next.
const TWO_HANDS: BoardControlProps = {
  panOnScroll: true,
  zoomOnPinch: true,
  selectionOnDrag: true,
  // Middle-drag pans, and so does any drag with Space held.
  panOnDrag: [1],
  panActivationKeyCode: 'Space',
  selectionKeyCode: null,
  multiSelectionKeyCode: ['Meta', 'Shift']
}

const ONE_HAND: BoardControlProps = {
  ...TWO_HANDS,
  selectionOnDrag: false,
  panOnDrag: [0, 1]
}

/**
 * The React Flow props for `mode`. In One hand mode, holding ⇧ gives the
 * canvas Two hands' left-drag, which draws a selection box. That's done here
 * rather than with React Flow's `selectionKeyCode: 'Shift'`, which would also
 * start a box from a ⇧-press on a card, so ⇧-click could no longer add a card
 * to the selection, nor ⇧-drag move one.
 */
export function boardControls(mode: BoardControlsMode, shiftHeld: boolean): BoardControlProps {
  return mode === 'oneHand' && !shiftHeld ? ONE_HAND : TWO_HANDS
}

/** What tells a wheel event's device. `wheelDeltaX` and `wheelDeltaY` are Chromium's legacy fields. */
export interface WheelSample {
  deltaX: number
  deltaY: number
  deltaMode: number
  wheelDeltaX?: number
  wheelDeltaY?: number
}

/** A wheel notch, in the legacy fields. */
const NOTCH = 120

/**
 * Whether a wheel event (not a pinch) came from a mouse wheel turning, rather
 * than from a trackpad or a Magic Mouse's touch surface. On macOS, Chromium
 * gives a device with smooth scrolling a `wheelDeltaY` of exactly −3 ×
 * `deltaY`, while a wheel that clicks round in notches reports whole notches
 * (multiples of 120) beside a `deltaY` macOS has accelerated. Only a turn
 * straight up or down counts: a sideways one (⇧ held, or a thumb wheel) still
 * pans.
 */
export function isMouseWheel(e: WheelSample): boolean {
  // Lines or pages: only a wheel that turns in steps scrolls by those.
  if (e.deltaMode !== 0) return e.deltaY !== 0 && e.deltaX === 0
  const notches = e.wheelDeltaY ?? 0
  if (e.deltaX !== 0 || notches === 0 || notches % NOTCH !== 0) return false
  // A trackpad's delta can land on a whole notch too, but then it's still exactly 3×.
  return notches !== -3 * e.deltaY
}

/** A pause this long ends a wheel gesture. A trackpad's momentum keeps its events much closer than this. */
export const GESTURE_GAP_MS = 250

/**
 * Reads wheel events a gesture at a time: the first event decides for the
 * whole gesture, so a trackpad flick's momentum keeps panning and a fast spin
 * of the wheel keeps zooming, even if an event in the middle reads the other
 * way. Returns whether each event is a mouse wheel's; `at` is the event's time
 * in milliseconds.
 */
export function wheelReader(gap = GESTURE_GAP_MS): (e: WheelSample, at: number) => boolean {
  let last = -Infinity
  let mouse = false
  return (e, at) => {
    if (at - last > gap) mouse = isMouseWheel(e)
    last = at
    return mouse
  }
}

/** One notch zooms as far as one press of the zoom controls' + or −. */
export const ZOOM_STEP = 1.2
/** A fast spin reports several notches in one event; more than this would leap. */
const MAX_NOTCHES = 4

/** How far a mouse wheel event zooms, as a factor: above 1 (zooming in) for a scroll up, as React Flow zooms. */
export function wheelZoomFactor(e: WheelSample): number {
  const raw = e.wheelDeltaY ? e.wheelDeltaY / NOTCH : -Math.sign(e.deltaY)
  const notches = Math.max(-MAX_NOTCHES, Math.min(MAX_NOTCHES, raw))
  return ZOOM_STEP ** notches
}

/**
 * The viewport zoomed by `factor` around `at`, a point on the board (in flow
 * coordinates) that stays under the pointer. The zoom stays within the board's
 * limits.
 */
export function zoomAround(viewport: Viewport, at: Point, factor: number): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor))
  return {
    x: viewport.x + at.x * (viewport.zoom - zoom),
    y: viewport.y + at.y * (viewport.zoom - zoom),
    zoom
  }
}
