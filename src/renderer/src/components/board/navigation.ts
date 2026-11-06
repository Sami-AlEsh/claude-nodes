// How the mouse moves around the board, as picked in Settings › Board ›
// Mouse. Keyboard + mouse: scrolling pans, ⌘-scroll zooms, and dragging the
// canvas draws a selection box. Mouse only: the same, and the right button
// pans when it's held and moved, so no key is needed for it. A right-click
// that doesn't move still opens the board's menu (rightClicks). A trackpad
// works the same in both. It's all React Flow's props, plus that menu.
import type { ReactFlowProps } from '@xyflow/react'
import type { Point } from '@shared/geometry'
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
  // Middle- and right-drag pan. With the right button here React Flow keeps
  // the pane's contextmenu to itself, so the board opens its menu on a
  // right-click itself (rightClicks).
  panOnDrag: [1, 2]
}

/** The React Flow props for `mode`. */
export function mouseControls(mode: MouseMode): MouseControlProps {
  return mode === 'mouseOnly' ? MOUSE_ONLY : WITH_KEYBOARD
}

/** How far, in screen pixels, a right press can stray and still be a click rather than a pan. */
export const RIGHT_CLICK_DISTANCE = 4

/** Whether the pointer at `at` is still near enough to where the right button went down for a click (screen points). */
export function rightClick(press: Point, at: Point): boolean {
  return Math.hypot(at.x - press.x, at.y - press.y) < RIGHT_CLICK_DISTANCE
}

/**
 * Tells a right-click on the canvas from a right-drag, for Mouse only, where
 * the right button pans and React Flow no longer reports the pane's
 * contextmenu. macOS fires contextmenu as the button goes down, before
 * anyone can know whether a pan follows, so this waits for the release: a
 * right press on the canvas that comes back up without having strayed
 * RIGHT_CLICK_DISTANCE calls `onClick` with the point it was pressed at,
 * however long it was held. A press that strayed that far was a pan, even if
 * it came back, and so was one that another button joined. ⌃-click, the
 * Mac's other right-click, counts too: it doesn't pan, but React Flow keeps
 * its contextmenu all the same.
 */
export function rightClicks(onClick: (press: Point) => void) {
  let press: (Point & { button: number }) | null = null
  return {
    /** A button went down; `onCanvas` says whether on the empty canvas, where the board's menu belongs. */
    down(e: { button: number; ctrlKey: boolean; clientX: number; clientY: number }, onCanvas: boolean) {
      const secondary = e.button === 2 || (e.button === 0 && e.ctrlKey)
      press = secondary && onCanvas ? { x: e.clientX, y: e.clientY, button: e.button } : null
    },
    move(e: { buttons: number; clientX: number; clientY: number }) {
      if (!press) return
      // `buttons` has bit 1 for the left button and bit 2 for the right one.
      const alone = e.buttons === (press.button === 2 ? 2 : 1)
      if (!alone || !rightClick(press, { x: e.clientX, y: e.clientY })) press = null
    },
    up(e: { button: number; clientX: number; clientY: number }) {
      const at = press
      press = null
      if (at && e.button === at.button && rightClick(at, { x: e.clientX, y: e.clientY })) onClick({ x: at.x, y: at.y })
    },
    /** The press ended some other way: the pointer was cancelled or the window lost focus. */
    cancel() {
      press = null
    }
  }
}
