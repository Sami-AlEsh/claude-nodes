import { describe, expect, it } from 'vitest'
import type { ProjectAction, SessionCard } from '@shared/types'
import {
  besideStack,
  buttonStatus,
  cardTop,
  hintDetail,
  runLabel,
  runStep,
  runsByAction,
  runState,
  stackItems,
  stepIndex,
  type StackItem
} from './stack'

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

/** An item as a word, to compare whole stacks at a glance. */
const shape = (item: StackItem) =>
  item.kind === 'action' ? `${item.action.id}${item.run ? `:${item.run.sessionId}` : ''}` : item.kind === 'divider' ? '—' : '+'

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

  it('reads as the rail’s fan said it, finishing included', () => {
    expect([runLabel.working, runLabel.waiting, runLabel.done]).toEqual(['Working', 'Needs you', 'Finishing'])
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

describe('stackItems', () => {
  const none = new Map<string, SessionCard>()

  it('stacks the project’s actions, then the global ones, each block closed by a divider, then +', () => {
    const items = stackItems([action('a'), action('b')], [action('g', { global: true })], none)
    expect(items.map(shape)).toEqual(['a', 'b', '—', 'g', '—', '+'])
  })

  it('is only + for a project with none', () => {
    expect(stackItems([], [], none).map(shape)).toEqual(['+'])
  })

  it('has no empty block, nor a divider for one', () => {
    expect(stackItems([action('a')], [], none).map(shape)).toEqual(['a', '—', '+'])
    expect(stackItems([], [action('g', { global: true })], none).map(shape)).toEqual(['g', '—', '+'])
  })

  it('puts each action’s run on its tile', () => {
    const runs = runsByAction([card('s1', { runOf: 'b' }), card('s2', { runOf: 'g' })])
    const items = stackItems([action('a'), action('b')], [action('g', { global: true })], runs)
    expect(items.map(shape)).toEqual(['a', 'b:s1', '—', 'g:s2', '—', '+'])
  })

  it('gives each divider its own key', () => {
    const items = stackItems([action('a')], [action('g', { global: true })], none)
    const keys = items.flatMap((i) => (i.kind === 'divider' ? [i.key] : []))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('hintDetail', () => {
  it('says what the action does, and that a global one is in every project', () => {
    expect(hintDetail(action('a', { description: 'Run the tests' }))).toBe('Run the tests')
    expect(hintDetail(action('g', { description: 'Tidy branches', global: true }))).toBe('Every project · Tidy branches')
  })

  it('says how to edit one with no description, and cuts a long one short', () => {
    expect(hintDetail(action('a'))).toBe('Right-click to edit')
    const long = hintDetail(action('a', { description: 'x'.repeat(200) }))
    expect(long).toHaveLength(80)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('runStep', () => {
  it('asks for you while the run waits, and otherwise gives what Claude last said', () => {
    expect(runStep(card('a', { status: 'waiting', meta: { lastAssistantText: 'Which?' } as SessionCard['meta'] }))).toBe(
      'It needs you. Open it to answer'
    )
    expect(runStep(card('a', { meta: { lastAssistantText: 'Running the tests' } as SessionCard['meta'] }))).toBe(
      'Running the tests'
    )
  })

  it('is starting before Claude has said anything', () => {
    expect(runStep(card('a'))).toBe('Starting…')
  })
})

describe('besideStack', () => {
  it('goes on the stack’s right when it fits there', () => {
    expect(besideStack({ left: 900, right: 952 }, 1440, 260, 6)).toEqual({ left: 958 })
  })

  it('goes on its left when the window is too narrow on the right', () => {
    expect(besideStack({ left: 1200, right: 1252 }, 1440, 260, 6)).toEqual({ right: 246 })
  })
})

describe('cardTop', () => {
  it('lines up with its tile', () => {
    expect(cardTop(400, 90, 920)).toBe(396)
  })

  it('stays inside the window', () => {
    expect(cardTop(880, 90, 920)).toBe(822)
    expect(cardTop(2, 90, 920)).toBe(8)
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

  it('leaves other keys, and an empty stack, alone', () => {
    expect(stepIndex(0, 'Enter', 3)).toBeNull()
    expect(stepIndex(0, 'ArrowDown', 0)).toBeNull()
  })
})
