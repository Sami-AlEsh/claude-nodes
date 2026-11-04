import { describe, expect, it } from 'vitest'
import type { SessionCard } from '@shared/types'
import { stopConfirmation, stoppable } from './stopSessions'

const card = (sessionId: string, patch: Partial<SessionCard> = {}): SessionCard => ({
  sessionId,
  x: 0,
  y: 0,
  archived: false,
  createdAt: 0,
  status: 'done',
  live: true,
  ...patch
})

const titleOf = (c: SessionCard) => c.title ?? c.sessionId

describe('stoppable', () => {
  it('keeps the Claude sessions that are running', () => {
    const cards = [card('a'), card('b', { live: false }), card('c', { kind: 'terminal' }), card('d', { kind: 'claude' })]
    expect(stoppable(cards).map((c) => c.sessionId)).toEqual(['a', 'd'])
  })

  it('leaves out action runs, which have no card to keep', () => {
    expect(stoppable([card('a', { runOf: 'deploy' }), card('b', { viewOf: 'stats' })]).map((c) => c.sessionId)).toEqual(['b'])
  })
})

describe('stopConfirmation', () => {
  it('doesn’t ask when every session is between turns', () => {
    expect(stopConfirmation([card('a'), card('b')], titleOf)).toBeNull()
  })

  it('asks for a session that’s working, by name', () => {
    const ask = stopConfirmation([card('a', { status: 'working', title: 'Fix login' })], titleOf)
    expect(ask).toMatchObject({ title: 'Stop a running session?', confirmLabel: 'Stop', danger: true })
    expect(ask?.message).toContain('“Fix login” is still working')
  })

  it('says when a session is waiting for you', () => {
    expect(stopConfirmation([card('a', { status: 'waiting' })], titleOf)?.message).toContain('waiting for you')
  })

  it('asks once for several, when any of them is mid-turn', () => {
    const ask = stopConfirmation([card('a'), card('b', { status: 'working' }), card('c', { status: 'working' })], titleOf)
    expect(ask?.title).toBe('Stop 3 sessions?')
    expect(ask?.message).toContain('Some of these sessions are still working')
  })

  it('names the one session among several that’s mid-turn', () => {
    const ask = stopConfirmation([card('a'), card('b', { status: 'waiting', title: 'Fix login' }), card('c')], titleOf)
    expect(ask?.title).toBe('Stop 3 sessions?')
    expect(ask?.message).toContain('“Fix login” is still waiting for you')
    expect(ask?.message).toContain('The transcripts stay')
  })
})
