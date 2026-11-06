import { describe, expect, it } from 'vitest'
import { PANEL_MAX_W, PANEL_MIN_W } from './panel'
import type { WorkspaceTabs } from './types'
import {
  NO_TABS,
  activateTab,
  clampSplit,
  closeTab,
  closeTabs,
  cycleTab,
  normalizeWorkspace,
  openTab,
  splitMax,
  tabAt
} from './workspace'

const ws = (tabs: string[], active: string | null = tabs[0] ?? null): WorkspaceTabs => ({ tabs, active })
const all = () => true

describe('opening tabs', () => {
  it('adds a session at the end of the strip and shows it', () => {
    expect(openTab(NO_TABS, 'a')).toEqual(ws(['a'], 'a'))
    expect(openTab(ws(['a', 'b'], 'a'), 'c')).toEqual(ws(['a', 'b', 'c'], 'c'))
  })

  it('shows the tab a session already has rather than opening another', () => {
    expect(openTab(ws(['a', 'b', 'c'], 'c'), 'a')).toEqual(ws(['a', 'b', 'c'], 'a'))
  })

  it('switches only to a tab that is open', () => {
    const before = ws(['a', 'b'], 'a')
    expect(activateTab(before, 'b')).toEqual(ws(['a', 'b'], 'b'))
    expect(activateTab(before, 'x')).toBe(before)
    expect(activateTab(before, 'a')).toBe(before)
  })
})

describe('closing tabs', () => {
  it('shows the tab to the right of the one closed, or the one to its left at the end', () => {
    expect(closeTab(ws(['a', 'b', 'c'], 'b'), 'b')).toEqual(ws(['a', 'c'], 'c'))
    expect(closeTab(ws(['a', 'b', 'c'], 'c'), 'c')).toEqual(ws(['a', 'b'], 'b'))
  })

  it('keeps showing the same tab when another one closes', () => {
    expect(closeTab(ws(['a', 'b', 'c'], 'a'), 'c')).toEqual(ws(['a', 'b'], 'a'))
  })

  it('leaves nothing showing once the last tab closes', () => {
    expect(closeTab(ws(['a'], 'a'), 'a')).toEqual(NO_TABS)
  })

  it('skips over the other tabs closing at the same time', () => {
    expect(closeTabs(ws(['a', 'b', 'c', 'd'], 'b'), ['b', 'c'])).toEqual(ws(['a', 'd'], 'd'))
    expect(closeTabs(ws(['a', 'b', 'c', 'd'], 'c'), ['c', 'd'])).toEqual(ws(['a', 'b'], 'b'))
  })

  it('returns the same tabs when none of them closes', () => {
    const before = ws(['a', 'b'], 'a')
    expect(closeTabs(before, ['x'])).toBe(before)
  })
})

describe('moving between tabs', () => {
  const three = ws(['a', 'b', 'c'], 'b')

  it('goes to the next or previous tab, wrapping around the strip', () => {
    expect(cycleTab(three, 1)).toBe('c')
    expect(cycleTab(three, -1)).toBe('a')
    expect(cycleTab(ws(['a', 'b', 'c'], 'c'), 1)).toBe('a')
    expect(cycleTab(ws(['a', 'b', 'c'], 'a'), -1)).toBe('c')
  })

  it('has nowhere to go without tabs', () => {
    expect(cycleTab(NO_TABS, 1)).toBeNull()
  })

  it('jumps to a tab by its number, and to the last with 9', () => {
    expect(tabAt(three, 1)).toBe('a')
    expect(tabAt(three, 3)).toBe('c')
    expect(tabAt(three, 4)).toBeNull()
    expect(tabAt(three, 9)).toBe('c')
    expect(tabAt(three, 0)).toBeNull()
    expect(tabAt(NO_TABS, 9)).toBeNull()
  })
})

describe('saved tabs', () => {
  it('drops the tabs of sessions that are gone, and anything that isn’t a session id', () => {
    const exists = (id: string) => id !== 'gone'
    expect(normalizeWorkspace({ tabs: ['a', 'gone', 'b', 7, '', null], active: 'b' }, exists)).toEqual(ws(['a', 'b'], 'b'))
  })

  it('opens each session once', () => {
    expect(normalizeWorkspace({ tabs: ['a', 'b', 'a'], active: 'a' }, all)).toEqual(ws(['a', 'b'], 'a'))
  })

  it('shows the first tab when the one showing is gone or was never saved', () => {
    expect(normalizeWorkspace({ tabs: ['a', 'b'], active: 'gone' }, all)).toEqual(ws(['a', 'b'], 'a'))
    expect(normalizeWorkspace({ tabs: ['a', 'b'] }, all)).toEqual(ws(['a', 'b'], 'a'))
  })

  it('starts with no tabs from nothing saved, or something it doesn’t understand', () => {
    expect(normalizeWorkspace(undefined, all)).toEqual(NO_TABS)
    expect(normalizeWorkspace('tabs', all)).toEqual(NO_TABS)
    expect(normalizeWorkspace({ tabs: 'a', active: 'a' }, all)).toEqual(NO_TABS)
  })
})

describe('the split beside the terminal', () => {
  it('keeps the panel within its own range when the row is wide', () => {
    expect(clampSplit(100, 2000)).toBe(PANEL_MIN_W)
    expect(clampSplit(5000, 2000)).toBe(PANEL_MAX_W)
    expect(clampSplit(400.4, 2000)).toBe(400)
  })

  it('leaves the terminal at least half the row', () => {
    expect(clampSplit(600, 1000)).toBe(500)
    expect(clampSplit(450, 1000)).toBe(450)
  })

  it('never goes under the panel’s minimum, even in a narrow row', () => {
    expect(clampSplit(400, 400)).toBe(PANEL_MIN_W)
  })

  it('uses the panel’s own range until the row is measured', () => {
    expect(clampSplit(5000, 0)).toBe(PANEL_MAX_W)
    expect(clampSplit(Number.NaN, 0)).toBe(PANEL_MIN_W)
  })

  it('says how wide the panel can get in a row, for the divider’s range', () => {
    expect(splitMax(2000)).toBe(PANEL_MAX_W)
    expect(splitMax(1001)).toBe(500)
    expect(splitMax(400)).toBe(PANEL_MIN_W)
    expect(splitMax(0)).toBe(PANEL_MAX_W)
  })
})
