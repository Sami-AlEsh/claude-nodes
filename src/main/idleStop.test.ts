import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardNode, SessionStatus } from '@shared/types'
import { idleInput, idleStatus, setIdleLimit } from './idleStop'

// What the idle rule looks at: which sessions run, their status, their last hook and their cards.
const world = vi.hoisted(() => ({
  live: new Set<string>(),
  status: new Map<string, SessionStatus>(),
  hookAt: new Map<string, number>(),
  nodes: {} as Record<string, Partial<BoardNode>>,
  kill: vi.fn((_id: string) => Promise.resolve())
}))

vi.mock('./hooks', () => ({
  getStatus: (id: string) => world.status.get(id) ?? 'done',
  lastHookTime: (id: string) => world.hookAt.get(id)
}))
vi.mock('./pty', () => ({
  isLive: (id: string) => world.live.has(id),
  liveSessionIds: () => [...world.live],
  kill: world.kill
}))
vi.mock('./store', () => ({
  projectIdForSession: (id: string) => (world.nodes[id] ? 'project' : null),
  getBoard: () => ({ nodes: world.nodes })
}))

const MIN = 60_000
let next = 0

/** A running session card whose turn ended `ago` ms back, as the status machine reports it. */
function session(node: Partial<BoardNode> = {}, ago = 0) {
  const id = `session-${++next}`
  world.nodes[id] = { sessionId: id, ...node }
  world.live.add(id)
  world.status.set(id, 'done')
  world.hookAt.set(id, Date.now() - ago)
  idleStatus(id, 'done', true)
  return id
}

beforeEach(() => {
  vi.useFakeTimers()
  world.kill.mockClear()
  setIdleLimit(15)
})

afterEach(() => {
  setIdleLimit(null)
  for (const id of world.live) idleStatus(id, 'done', false)
  world.live.clear()
  world.status.clear()
  world.hookAt.clear()
  world.nodes = {}
  vi.useRealTimers()
})

describe('stopping idle sessions', () => {
  it('stops a session once it has sat idle for the chosen time', () => {
    const id = session()
    vi.advanceTimersByTime(15 * MIN - 1)
    expect(world.kill).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(world.kill).toHaveBeenCalledWith(id)
  })

  it('stops nothing while the setting is off', () => {
    setIdleLimit(null)
    session()
    vi.advanceTimersByTime(180 * MIN)
    expect(world.kill).not.toHaveBeenCalled()
  })

  it('waits again from when the user last typed', () => {
    const id = session()
    vi.advanceTimersByTime(10 * MIN)
    idleInput(id)
    vi.advanceTimersByTime(5 * MIN)
    expect(world.kill).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10 * MIN)
    expect(world.kill).toHaveBeenCalledWith(id)
  })

  it('leaves a session alone while it works or waits for the user', () => {
    const working = session()
    world.status.set(working, 'working')
    idleStatus(working, 'working', true)
    const waiting = session()
    world.status.set(waiting, 'waiting')
    idleStatus(waiting, 'waiting', true)
    vi.advanceTimersByTime(60 * MIN)
    expect(world.kill).not.toHaveBeenCalled()
  })

  it('never stops terminals, views’ brains or action runs', () => {
    session({ kind: 'terminal' })
    session({ viewOf: 'view-1' })
    session({ runOf: 'action-1' })
    vi.advanceTimersByTime(60 * MIN)
    expect(world.kill).not.toHaveBeenCalled()
  })

  it('stops at once a session that went idle while the app was closed', () => {
    const id = session({}, 40 * MIN)
    vi.advanceTimersByTime(0)
    expect(world.kill).toHaveBeenCalledWith(id)
  })

  it('waits the full time again once a stopped session is resumed', () => {
    const id = session({}, 40 * MIN)
    vi.advanceTimersByTime(0)
    expect(world.kill).toHaveBeenCalledTimes(1)
    // Stopped, then resumed: a new process, which has had no hook yet.
    idleStatus(id, 'done', false)
    world.hookAt.delete(id)
    idleStatus(id, 'done', true)
    vi.advanceTimersByTime(15 * MIN - 1)
    expect(world.kill).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(world.kill).toHaveBeenCalledTimes(2)
  })

  it('applies a new setting to sessions already running, from when they were last used', () => {
    setIdleLimit(null)
    const id = session()
    vi.advanceTimersByTime(20 * MIN)
    setIdleLimit(15)
    vi.advanceTimersByTime(0)
    expect(world.kill).toHaveBeenCalledWith(id)
  })

  it('cancels when the setting is turned off', () => {
    session()
    vi.advanceTimersByTime(10 * MIN)
    setIdleLimit(null)
    vi.advanceTimersByTime(60 * MIN)
    expect(world.kill).not.toHaveBeenCalled()
  })
})
