// Stops sessions nobody has used for a while, when Settings asks for it, to
// free the memory a `claude` process and its MCP servers hold. A stopped card
// resumes when it's opened. Only while the app is open: after a relaunch,
// sessions that went idle meanwhile stop at once, judged by their replayed hooks.
import type { SessionStatus } from '@shared/types'
import { getStatus, lastHookTime } from './hooks'
import { isLive, kill, liveSessionIds } from './pty'
import { getBoard, projectIdForSession } from './store'

let limitMs: number | null = null
const timers = new Map<string, NodeJS.Timeout>()
/** When the user last typed into each session. */
const lastTyped = new Map<string, number>()
/** When each session was first seen running, for one with no hook yet. */
const firstSeen = new Map<string, number>()

/** Ordinary session cards only: shells may be running commands, brains and action runs end by themselves. */
function eligible(sessionId: string): boolean {
  const projectId = projectIdForSession(sessionId)
  const node = projectId ? getBoard(projectId).nodes[sessionId] : undefined
  return Boolean(node && node.kind !== 'terminal' && !node.viewOf && !node.runOf)
}

function lastUsed(sessionId: string): number {
  const hook = lastHookTime(sessionId) ?? firstSeen.get(sessionId) ?? Date.now()
  return Math.max(hook, lastTyped.get(sessionId) ?? 0)
}

function forget(sessionId: string) {
  clearTimeout(timers.get(sessionId))
  timers.delete(sessionId)
  lastTyped.delete(sessionId)
  firstSeen.delete(sessionId)
}

function arm(sessionId: string) {
  if (limitMs === null) return
  const wait = Math.max(0, limitMs - (Date.now() - lastUsed(sessionId)))
  timers.set(
    sessionId,
    setTimeout(() => {
      timers.delete(sessionId)
      if (limitMs === null || !isLive(sessionId) || getStatus(sessionId) !== 'done') return
      // Typed into meanwhile: wait out the rest from then.
      if (Date.now() - lastUsed(sessionId) >= limitMs) void kill(sessionId)
      else arm(sessionId)
    }, wait)
  )
}

/** A session's status changed. One that's done and running waits out the limit, then stops. */
export function idleStatus(sessionId: string, status: SessionStatus, live: boolean) {
  clearTimeout(timers.get(sessionId))
  timers.delete(sessionId)
  if (!live) return forget(sessionId)
  if (!firstSeen.has(sessionId)) firstSeen.set(sessionId, Date.now())
  if (limitMs !== null && status === 'done' && eligible(sessionId)) arm(sessionId)
}

/** The user typed into a session, so it isn't idle. */
export function idleInput(sessionId: string) {
  lastTyped.set(sessionId, Date.now())
}

/** Applies the setting, to the sessions already running too. */
export function setIdleLimit(minutes: number | null) {
  limitMs = minutes === null ? null : minutes * 60_000
  for (const sessionId of liveSessionIds()) idleStatus(sessionId, getStatus(sessionId), true)
}
