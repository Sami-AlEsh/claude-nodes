import { describe, expect, it } from 'vitest'
import {
  GESTURE_GAP_MS,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  navigationProps,
  isMouseWheel,
  shiftTracker,
  wheelReader,
  wheelZoomFactor,
  zoomAround,
  type WheelSample
} from './navigation'

// Wheel events as Chromium builds them on macOS. A device with smooth
// scrolling (trackpad, Magic Mouse) sends its point delta, with
// wheelDelta = 3 × that delta the other way. A wheel that clicks round sends
// whole notches (±120 each) beside the pixel delta macOS accelerated.
const trackpad = (deltaY: number, deltaX = 0): WheelSample => ({
  deltaX,
  deltaY,
  deltaMode: 0,
  wheelDeltaX: -3 * deltaX,
  wheelDeltaY: -3 * deltaY
})
const wheel = (notches: number, deltaY: number, shift = false): WheelSample =>
  shift
    ? { deltaX: deltaY, deltaY: 0, deltaMode: 0, wheelDeltaX: notches * 120, wheelDeltaY: 0 }
    : { deltaX: 0, deltaY, deltaMode: 0, wheelDeltaX: 0, wheelDeltaY: notches * 120 }

describe('navigationProps', () => {
  it('keeps today’s controls for the trackpad', () => {
    const expected = {
      panOnScroll: true,
      zoomOnPinch: true,
      selectionOnDrag: true,
      panOnDrag: [1],
      panActivationKeyCode: 'Space',
      selectionKeyCode: null,
      multiSelectionKeyCode: ['Meta', 'Shift']
    }
    expect(navigationProps('trackpad', false)).toEqual(expected)
    expect(navigationProps('trackpad', true)).toEqual(expected)
  })

  it('pans with a left-drag for the mouse, and leaves scrolls and pinches to the trackpad', () => {
    expect(navigationProps('mouse', false)).toEqual({
      panOnScroll: true,
      zoomOnPinch: true,
      selectionOnDrag: false,
      panOnDrag: [0, 1],
      panActivationKeyCode: 'Space',
      selectionKeyCode: null,
      multiSelectionKeyCode: ['Meta', 'Shift'],
      paneClickDistance: 4
    })
  })

  it('draws a selection box with ⇧ held, without making ⇧ a selection key that would catch cards', () => {
    const shifted = navigationProps('mouse', true)
    expect(shifted.selectionOnDrag).toBe(true)
    expect(shifted.panOnDrag).toEqual([1])
    expect(shifted.selectionKeyCode).toBeNull()
    expect(shifted.multiSelectionKeyCode).toEqual(['Meta', 'Shift'])
  })

  it('gives React Flow the same objects each render', () => {
    expect(navigationProps('mouse', false)).toBe(navigationProps('mouse', false))
    expect(navigationProps('trackpad', false)).toBe(navigationProps('mouse', true))
  })
})

describe('isMouseWheel', () => {
  it('reads a notched wheel as a mouse', () => {
    expect(isMouseWheel(wheel(-1, 4.000244140625))).toBe(true)
    expect(isMouseWheel(wheel(1, -4.000244140625))).toBe(true)
    expect(isMouseWheel(wheel(-3, 52.5))).toBe(true)
  })

  it('reads a trackpad’s scroll as a trackpad, in either direction and with sideways drift', () => {
    expect(isMouseWheel(trackpad(7))).toBe(false)
    expect(isMouseWheel(trackpad(-2))).toBe(false)
    expect(isMouseWheel(trackpad(13, 1))).toBe(false)
    expect(isMouseWheel(trackpad(0, -9))).toBe(false)
  })

  it('reads a trackpad delta that lands on a whole notch as a trackpad', () => {
    expect(isMouseWheel(trackpad(40))).toBe(false)
    expect(isMouseWheel(trackpad(-80))).toBe(false)
  })

  it('leaves a sideways turn to pan', () => {
    expect(isMouseWheel(wheel(-1, 4, true))).toBe(false)
  })

  it('reads an event with nothing to go on as a trackpad, which pans as before', () => {
    expect(isMouseWheel({ deltaX: 0, deltaY: 10, deltaMode: 0 })).toBe(false)
    expect(isMouseWheel({ deltaX: 0, deltaY: 0, deltaMode: 0, wheelDeltaX: 0, wheelDeltaY: 0 })).toBe(false)
  })

  it('reads a scroll by lines as a mouse', () => {
    expect(isMouseWheel({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe(true)
  })
})

describe('isMouseWheel with the window zoomed', () => {
  // Chromium divides both fields by the page zoom: at 110% a notch reads −109.
  const zoomed = (e: WheelSample, zoom: number): WheelSample => ({
    ...e,
    deltaY: e.deltaY / zoom,
    wheelDeltaY: Math.trunc((e.wheelDeltaY ?? 0) / zoom)
  })

  it('still reads a notch as a mouse wheel, and zooms a notch’s worth', () => {
    for (const zoom of [0.9, 1.1, 1.25, 1.5, 2]) {
      expect(isMouseWheel(zoomed(wheel(-1, 4.000244140625), zoom), zoom), String(zoom)).toBe(true)
      expect(isMouseWheel(zoomed(wheel(2, -30), zoom), zoom), String(zoom)).toBe(true)
      expect(wheelZoomFactor(zoomed(wheel(1, -4), zoom), zoom), String(zoom)).toBeCloseTo(ZOOM_STEP)
    }
  })

  it('still reads a trackpad as a trackpad, a notch-sized delta included', () => {
    for (const zoom of [0.9, 1.1, 1.25, 1.5, 2]) {
      for (const d of [7, -2, 40, -80]) expect(isMouseWheel(zoomed(trackpad(d), zoom), zoom), `${zoom} ${d}`).toBe(false)
    }
  })
})

describe('shiftTracker', () => {
  const track = () => {
    const changes: boolean[] = []
    return { shift: shiftTracker((held) => changes.push(held)), changes }
  }

  it('follows ⇧ from the keyboard and the pointer', () => {
    const { shift, changes } = track()
    shift.key({ shiftKey: true })
    shift.key({ shiftKey: false })
    shift.pointer({ shiftKey: true, buttons: 0 })
    shift.pointer({ shiftKey: true, buttons: 0 })
    shift.blur()
    expect(changes).toEqual([true, false, true, false])
  })

  it('waits for the button to come up before swapping, so a press ends with the props it began with', () => {
    const { shift, changes } = track()
    shift.key({ shiftKey: true })
    shift.pointer({ shiftKey: true, buttons: 1 })
    shift.key({ shiftKey: false })
    shift.pointer({ shiftKey: false, buttons: 1 })
    expect(changes).toEqual([true])
    shift.pointer({ shiftKey: false, buttons: 0 })
    expect(changes).toEqual([true, false])
  })

  it('doesn’t start a box from ⇧ pressed mid-pan', () => {
    const { shift, changes } = track()
    shift.pointer({ shiftKey: false, buttons: 1 })
    shift.key({ shiftKey: true })
    expect(changes).toEqual([])
    shift.pointer({ shiftKey: true, buttons: 0 })
    expect(changes).toEqual([true])
  })
})

describe('wheelReader', () => {
  it('keeps reading a trackpad gesture as a trackpad, through its momentum', () => {
    const read = wheelReader()
    const events = [trackpad(3), trackpad(12), trackpad(40), trackpad(25), trackpad(9), trackpad(2), trackpad(1)]
    // A notch-shaped event in the middle, as a mouse with an odd delta could send, still pans.
    events.splice(3, 0, wheel(-1, 4))
    expect(events.map((e, i) => read(e, i * 16))).toEqual(events.map(() => false))
  })

  it('keeps zooming through a fast spin', () => {
    const read = wheelReader()
    // A notch whose accelerated delta came out at exactly 40px looks like a trackpad on its own.
    const events = [wheel(-1, 4.000244140625), wheel(-2, 24.5), wheel(-1, 40), wheel(-3, 96.75)]
    expect(events.map((e, i) => read(e, i * 40))).toEqual([true, true, true, true])
  })

  it('reads afresh after a pause', () => {
    const read = wheelReader()
    expect(read(trackpad(10), 0)).toBe(false)
    expect(read(wheel(-1, 4), 16)).toBe(false)
    expect(read(wheel(-1, 4), 16 + GESTURE_GAP_MS + 1)).toBe(true)
    expect(read(trackpad(10), 2 * GESTURE_GAP_MS + 100)).toBe(false)
  })
})

describe('wheelZoomFactor', () => {
  it('zooms one step per notch, in for a scroll up and out for a scroll down', () => {
    expect(wheelZoomFactor(wheel(1, -4))).toBeCloseTo(ZOOM_STEP)
    expect(wheelZoomFactor(wheel(-1, 4))).toBeCloseTo(1 / ZOOM_STEP)
    expect(wheelZoomFactor(wheel(2, -30))).toBeCloseTo(ZOOM_STEP ** 2)
  })

  it('caps a spin that reports many notches at once', () => {
    expect(wheelZoomFactor(wheel(-20, 800))).toBeCloseTo(ZOOM_STEP ** -4)
  })

  it('goes by the direction when there are no notches to count', () => {
    expect(wheelZoomFactor({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toBeCloseTo(1 / ZOOM_STEP)
  })
})

describe('zoomAround', () => {
  it('keeps the point under the pointer where it was on screen', () => {
    const before = { x: 120, y: -40, zoom: 0.8 }
    const at = { x: 300, y: 500 }
    const after = zoomAround(before, at, 1.2)
    expect(after.zoom).toBeCloseTo(0.96)
    expect(at.x * after.zoom + after.x).toBeCloseTo(at.x * before.zoom + before.x)
    expect(at.y * after.zoom + after.y).toBeCloseTo(at.y * before.zoom + before.y)
  })

  it('stays within the board’s zoom limits, and doesn’t move when already at one', () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 1.9 }, { x: 10, y: 10 }, 1.2).zoom).toBe(MAX_ZOOM)
    expect(zoomAround({ x: 0, y: 0, zoom: 0.11 }, { x: 10, y: 10 }, 1 / 1.2).zoom).toBe(MIN_ZOOM)
    expect(zoomAround({ x: 5, y: 7, zoom: MAX_ZOOM }, { x: 100, y: 100 }, 1.2)).toEqual({ x: 5, y: 7, zoom: MAX_ZOOM })
  })
})
