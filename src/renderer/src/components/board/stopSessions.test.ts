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
    const ask = stopConfirmation([card('a'), card('b', { status: 'working' }), card('c')], titleOf)
    expect(ask?.title).toBe('Stop 3 sessions?')
  })
})
