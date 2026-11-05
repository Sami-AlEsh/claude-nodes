// How the pointer moves around the board, as picked in Settings › Board ›
// Navigation. Trackpad: scroll pans, ⌘-scroll or a pinch zooms, and dragging
// the canvas draws a selection box. Mouse: dragging the canvas pans, the
// mouse wheel zooms and ⇧-drag draws the box, while a trackpad's two-finger
// scroll and pinch work as before. Most of it is React Flow's props; the one
// thing React Flow can't do is tell a mouse wheel from a trackpad scroll, so
// the board does that here.
import type { ReactFlowProps } from '@xyflow/react'
import type { Point } from '@shared/geometry'
import type { NavigationMode, Viewport } from '@shared/types'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2

export type NavigationProps = Pick<
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
const TRACKPAD: NavigationProps = {
  panOnScroll: true,
  zoomOnPinch: true,
  selectionOnDrag: true,
  // Middle-drag pans, and so does any drag with Space held.
  panOnDrag: [1],
  panActivationKeyCode: 'Space',
  selectionKeyCode: null,
  multiSelectionKeyCode: ['Meta', 'Shift']
}

const MOUSE: NavigationProps = {
  ...TRACKPAD,
  selectionOnDrag: false,
  panOnDrag: [0, 1],
  // A left press on the canvas now starts a pan, so a click that wobbles a
  // pixel or two would be a pan too, and wouldn't clear the selection or
  // close a menu. A few pixels still count as a click.
  paneClickDistance: 4
}

/**
 * The React Flow props for `mode`. In Mouse mode, holding ⇧ gives the canvas
 * Trackpad mode's left-drag, which draws a selection box. That's done here
 * rather than with React Flow's `selectionKeyCode: 'Shift'`, which would also
 * start a box from a ⇧-press on a card, so ⇧-click could no longer add a card
 * to the selection, nor ⇧-drag move one.
 */
export function navigationProps(mode: NavigationMode, shiftHeld: boolean): NavigationProps {
  return mode === 'mouse' && !shiftHeld ? MOUSE : TRACKPAD
}

/**
 * Follows ⇧ for Mouse mode's selection box, calling `onChange` when the
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
 *
 * `pageZoom` is the window's zoom (View › Zoom In). Chromium divides both
 * fields by it and cuts `wheelDeltaY` to a whole number, so at 110% a notch
 * reads −109. At 100% both are exact; zoomed, they're allowed that 1 of slack.
 */
export function isMouseWheel(e: WheelSample, pageZoom = 1): boolean {
  // Lines or pages: only a wheel that turns in steps scrolls by those.
  if (e.deltaMode !== 0) return e.deltaY !== 0 && e.deltaX === 0
  const raw = e.wheelDeltaY ?? 0
  if (e.deltaX !== 0 || raw === 0) return false
  const slack = pageZoom === 1 ? 0 : 1
  const notches = Math.round((raw * pageZoom) / NOTCH)
  if (notches === 0 || Math.abs(Math.trunc((notches * NOTCH) / pageZoom) - raw) > slack) return false
  // A trackpad's delta can land on a whole notch too, but then it's still −3 × deltaY.
  return Math.abs(raw + 3 * e.deltaY) > slack
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
export function wheelReader(gap = GESTURE_GAP_MS): (e: WheelSample, at: number, pageZoom?: number) => boolean {
  let last = -Infinity
  let mouse = false
  return (e, at, pageZoom = 1) => {
    if (at - last > gap) mouse = isMouseWheel(e, pageZoom)
    last = at
    return mouse
  }
}

/** One notch zooms as far as one press of the zoom controls' + or −. */
export const ZOOM_STEP = 1.2
/** A fast spin reports several notches in one event; more than this would leap. */
const MAX_NOTCHES = 4

/** How far a mouse wheel event zooms, as a factor: above 1 (zooming in) for a scroll up, as React Flow zooms. */
export function wheelZoomFactor(e: WheelSample, pageZoom = 1): number {
  const raw = e.wheelDeltaY ? (e.wheelDeltaY * pageZoom) / NOTCH : -Math.sign(e.deltaY)
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
