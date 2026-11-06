import { describe, expect, it } from 'vitest'
import type { ProjectAction, SessionCard } from '@shared/types'
import { buttonStatus, menuRows, runsByAction, runState, stepIndex, type MenuRow } from './menu'

const card = (sessionId: string, patch: Partial<SessionCard> = {}): SessionCard => ({
  sessionId,
  x: 0,
  y: 0,
  archived: false,
  createdAt: 0,
  status: 'working',
  live: true,
  ...patch
})

const action = (id: string, patch: Partial<ProjectAction> = {}): ProjectAction => ({
  id,
  name: id,
  icon: 'zap',
  description: '',
  prompt: '',
  createdAt: 0,
  ...patch
})

/** A row as a word, to compare whole menus at a glance. */
const shape = (row: MenuRow) =>
  row.kind === 'action' ? `${row.action.id}${row.run ? `:${row.run.sessionId}` : ''}` : row.kind === 'divider' ? '—' : '+'

describe('runsByAction', () => {
  it('keeps each run by the action it runs, leaving out other sessions and archived runs', () => {
    const runs = runsByAction([
      card('s1', { runOf: 'deploy' }),
      card('s2'),
      card('s3', { runOf: 'test', archived: true }),
      card('s4', { runOf: 'lint', status: 'waiting' })
    ])
    expect([...runs].map(([id, c]) => [id, c.sessionId])).toEqual([
      ['deploy', 's1'],
      ['lint', 's4']
    ])
  })

  it('is empty without a board', () => {
    expect(runsByAction(undefined).size).toBe(0)
  })
})

describe('runState', () => {
  it('needs you only while the run waits on you, and is working otherwise', () => {
    expect(runState(card('a', { status: 'waiting' }))).toBe('waiting')
    expect(runState(card('a', { status: 'working' }))).toBe('working')
    // A finished turn shows until the run leaves.
    expect(runState(card('a', { status: 'done' }))).toBe('working')
  })
})

describe('buttonStatus', () => {
  it('has no dot without a run', () => {
    expect(buttonStatus([])).toBeUndefined()
  })

  it('is orange while runs are going, and red as soon as one needs you', () => {
    expect(buttonStatus([card('a'), card('b', { status: 'done' })])).toBe('working')
    expect(buttonStatus([card('a'), card('b', { status: 'waiting' })])).toBe('waiting')
  })
})

describe('menuRows', () => {
  const none = new Map<string, SessionCard>()

  it('lists the project’s actions, then the global ones, then New action, with dividers between', () => {
    const rows = menuRows([action('a'), action('b')], [action('g', { global: true })], none)
    expect(rows.map(shape)).toEqual(['a', 'b', '—', 'g', '—', '+'])
  })

  it('offers only New action to a project with none', () => {
    expect(menuRows([], [], none).map(shape)).toEqual(['+'])
  })

  it('has no empty group, nor a divider for one', () => {
    expect(menuRows([action('a')], [], none).map(shape)).toEqual(['a', '—', '+'])
    expect(menuRows([], [action('g', { global: true })], none).map(shape)).toEqual(['g', '—', '+'])
  })

  it('puts each action’s run on its row', () => {
    const runs = runsByAction([card('s1', { runOf: 'b' }), card('s2', { runOf: 'g' })])
    const rows = menuRows([action('a'), action('b')], [action('g', { global: true })], runs)
    expect(rows.map(shape)).toEqual(['a', 'b:s1', '—', 'g:s2', '—', '+'])
  })

  it('gives each divider its own key', () => {
    const rows = menuRows([action('a')], [action('g', { global: true })], none)
    const keys = rows.flatMap((r) => (r.kind === 'divider' ? [r.key] : []))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('stepIndex', () => {
  it('moves down and up, wrapping around the ends', () => {
    expect(stepIndex(0, 'ArrowDown', 3)).toBe(1)
    expect(stepIndex(2, 'ArrowDown', 3)).toBe(0)
    expect(stepIndex(1, 'ArrowUp', 3)).toBe(0)
    expect(stepIndex(0, 'ArrowUp', 3)).toBe(2)
  })

  it('starts from the top going down, or the bottom going up, with nothing focused', () => {
    expect(stepIndex(-1, 'ArrowDown', 3)).toBe(0)
    expect(stepIndex(-1, 'ArrowUp', 3)).toBe(2)
  })

  it('jumps to the ends with Home and End', () => {
    expect(stepIndex(1, 'Home', 3)).toBe(0)
    expect(stepIndex(1, 'End', 3)).toBe(2)
  })

  it('leaves other keys, and an empty menu, alone', () => {
    expect(stepIndex(0, 'Enter', 3)).toBeNull()
    expect(stepIndex(0, 'ArrowDown', 0)).toBeNull()
  })
})
