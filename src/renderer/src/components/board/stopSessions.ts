// Stopping a session ends its Claude process, and the MCP servers it started,
// but keeps its card: opening the card resumes the session.
import type { SessionCard } from '@shared/types'
import type { ConfirmRequest } from './ConfirmDialog'

/**
 * The Claude sessions among `cards` with a process to stop. Terminals are
 * removed instead, and an action run has no card to keep: it leaves the board
 * once its process ends.
 */
export function stoppable(cards: SessionCard[]): SessionCard[] {
  return cards.filter((c) => c.live && c.kind !== 'terminal' && !c.runOf)
}

/** What to ask before stopping `cards`, or null when none is mid-turn, so nothing is cut off. */
export function stopConfirmation(
  cards: SessionCard[],
  titleOf: (card: SessionCard) => string
): Omit<ConfirmRequest, 'resolve'> | null {
  const busy = cards.filter((c) => c.status !== 'done')
  if (busy.length === 0) return null
  if (cards.length === 1) {
    const doing = busy[0].status === 'waiting' ? 'waiting for you' : 'working'
    return {
      title: 'Stop a running session?',
      message: `“${titleOf(busy[0])}” is still ${doing}. Stopping it cuts off this turn. The transcript stays, so you can resume it.`,
      confirmLabel: 'Stop',
      danger: true
    }
  }
  return {
    title: `Stop ${cards.length} sessions?`,
    message: 'Some of these sessions are still working. Stopping them cuts off their turns. The transcripts stay, so you can resume them.',
    confirmLabel: 'Stop',
    danger: true
  }
}

/** Stops each session's process, waiting until they've exited. */
export async function stopSessions(cards: SessionCard[]): Promise<void> {
  await Promise.all(cards.map((c) => window.api.sessions.kill(c.sessionId)))
}
