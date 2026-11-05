import { describe, expect, it } from 'vitest'
import { mouseControls, shiftTracker } from './navigation'

describe('mouseControls', () => {
  it('keeps today’s controls with the keyboard', () => {
    const expected = {
      panOnScroll: true,
      zoomOnPinch: true,
      selectionOnDrag: true,
      panOnDrag: [1],
      panActivationKeyCode: 'Space',
      selectionKeyCode: null,
      multiSelectionKeyCode: ['Meta', 'Shift']
    }
    expect(mouseControls('withKeyboard', false)).toEqual(expected)
    expect(mouseControls('withKeyboard', true)).toEqual(expected)
  })

  it('pans with a left-drag for the mouse alone, and leaves scrolling and zooming as they were', () => {
    expect(mouseControls('mouseOnly', false)).toEqual({
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
    const shifted = mouseControls('mouseOnly', true)
    expect(shifted.selectionOnDrag).toBe(true)
    expect(shifted.panOnDrag).toEqual([1])
    expect(shifted.selectionKeyCode).toBeNull()
    expect(shifted.multiSelectionKeyCode).toEqual(['Meta', 'Shift'])
  })

  it('gives React Flow the same objects from one render to the next', () => {
    expect(mouseControls('mouseOnly', false)).toBe(mouseControls('mouseOnly', false))
    expect(mouseControls('withKeyboard', false)).toBe(mouseControls('mouseOnly', true))
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
