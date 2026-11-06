import { describe, expect, it } from 'vitest'
import type { Point } from '@shared/geometry'
import { mouseControls, rightClick, rightClicks } from './navigation'

describe('mouseControls', () => {
  it('keeps today’s controls with the keyboard', () => {
    expect(mouseControls('withKeyboard')).toEqual({
      panOnScroll: true,
      zoomOnPinch: true,
      selectionOnDrag: true,
      panOnDrag: [1],
      panActivationKeyCode: 'Space',
      selectionKeyCode: null,
      multiSelectionKeyCode: ['Meta', 'Shift']
    })
  })

  it('pans with the right button for the mouse alone, and leaves the left button its selection box', () => {
    expect(mouseControls('mouseOnly')).toEqual({
      panOnScroll: true,
      zoomOnPinch: true,
      selectionOnDrag: true,
      panOnDrag: [1, 2],
      panActivationKeyCode: 'Space',
      selectionKeyCode: null,
      multiSelectionKeyCode: ['Meta', 'Shift']
    })
  })

  it('gives React Flow the same objects from one render to the next', () => {
    expect(mouseControls('mouseOnly')).toBe(mouseControls('mouseOnly'))
    expect(mouseControls('withKeyboard')).toBe(mouseControls('withKeyboard'))
  })
})

describe('rightClick', () => {
  const press = { x: 100, y: 100 }

  it('counts a release where the press was, or a few pixels off, as a click', () => {
    expect(rightClick(press, press)).toBe(true)
    expect(rightClick(press, { x: 102, y: 101 })).toBe(true)
    expect(rightClick(press, { x: 100, y: 96.5 })).toBe(true)
  })

  it('counts 4 pixels or more as a pan', () => {
    expect(rightClick(press, { x: 104, y: 100 })).toBe(false)
    expect(rightClick(press, { x: 103, y: 103 })).toBe(false)
    expect(rightClick(press, { x: 40, y: 180 })).toBe(false)
  })
})

describe('rightClicks', () => {
  const track = () => {
    const clicks: Point[] = []
    return { right: rightClicks((at) => clicks.push(at)), clicks }
  }
  const at = (x: number, y: number) => ({ clientX: x, clientY: y })
  // `buttons` defaults to the pressed button alone (bit 1 left, 2 right, 4 middle).
  const down = (x: number, y: number, button = 2, ctrlKey = false, buttons = [1, 4, 2][button]) => ({
    button,
    buttons,
    ctrlKey,
    ...at(x, y)
  })
  const held = (x: number, y: number, buttons = 2) => ({ buttons, ...at(x, y) })
  const up = (x: number, y: number, button = 2) => ({ button, ...at(x, y) })

  it('opens on a right-click on the canvas, at the press', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), true)
    right.up(up(300, 200))
    expect(clicks).toEqual([{ x: 300, y: 200 }])
  })

  it('opens after a long press that didn’t move, since only the release decides', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), true)
    right.move(held(300, 200))
    right.move(held(300, 200))
    right.up(up(300, 200))
    expect(clicks).toEqual([{ x: 300, y: 200 }])
  })

  it('opens at the press after a small wobble', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), true)
    right.move(held(302, 201))
    right.move(held(298, 199))
    right.up(up(301, 202))
    expect(clicks).toEqual([{ x: 300, y: 200 }])
  })

  it('opens nothing after a drag, even one that comes back to where it started', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), true)
    right.move(held(360, 240))
    right.up(up(360, 240))
    right.down(down(300, 200), true)
    right.move(held(308, 200))
    right.move(held(300, 200))
    right.up(up(300, 200))
    expect(clicks).toEqual([])
  })

  it('leaves presses on cards and other buttons alone', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), false)
    right.up(up(300, 200))
    right.down(down(300, 200, 0), true)
    right.up(up(300, 200, 0))
    right.down(down(300, 200, 1), true)
    right.up(up(300, 200, 1))
    expect(clicks).toEqual([])
  })

  it('counts ⌃-click as a right-click, as macOS does', () => {
    const { right, clicks } = track()
    right.down(down(300, 200, 0, true), true)
    right.move(held(301, 200, 1))
    right.up(up(301, 200, 0))
    right.down(down(300, 200, 0, true), true)
    right.move(held(340, 240, 1))
    right.up(up(340, 240, 0))
    expect(clicks).toEqual([{ x: 300, y: 200 }])
  })

  it('opens nothing for a right press made while the left button is down, as when drawing a selection box', () => {
    const { right, clicks } = track()
    right.down(down(300, 200, 2, false, 3), true)
    right.up(up(300, 200))
    right.down(down(300, 200, 0, true, 3), true)
    right.up(up(300, 200, 0))
    expect(clicks).toEqual([])
  })

  it('opens nothing when the button that comes up isn’t the one that went down', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), true)
    right.up(up(300, 200, 0))
    right.down(down(300, 200, 0, true), true)
    right.up(up(300, 200, 2))
    expect(clicks).toEqual([])
  })

  it('opens nothing when another button joins the press, or the press is cut short', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), true)
    right.move(held(300, 200, 3))
    right.up(up(300, 200))
    right.down(down(300, 200), true)
    right.cancel()
    right.up(up(300, 200))
    expect(clicks).toEqual([])
  })

  it('starts afresh with each press', () => {
    const { right, clicks } = track()
    right.down(down(300, 200), true)
    right.move(held(400, 200))
    right.up(up(400, 200))
    right.down(down(400, 200), true)
    right.up(up(400, 200))
    expect(clicks).toEqual([{ x: 400, y: 200 }])
  })
})
