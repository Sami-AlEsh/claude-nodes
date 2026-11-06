// The session workspace's tabs, shared by the main process (which saves them
// with the board and drops gone sessions on load) and the renderer (which
// opens, switches and closes them), and the split beside its terminal.
import { PANEL_MAX_W, PANEL_MIN_W } from './panel'
import type { WorkspaceTabs } from './types'

export const NO_TABS: WorkspaceTabs = { tabs: [], active: null }

/**
 * Saved tabs as this version understands them: session ids, each once, that
 * `keep` still finds; the active one among them, or the first.
 */
export function normalizeWorkspace(raw: unknown, keep: (sessionId: string) => boolean): WorkspaceTabs {
  const w = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkspaceTabs>
  const ids = Array.isArray(w.tabs) ? w.tabs.filter((id): id is string => typeof id === 'string' && id !== '') : []
  const tabs = [...new Set(ids)].filter(keep)
  const active = typeof w.active === 'string' && tabs.includes(w.active) ? w.active : (tabs[0] ?? null)
  return { tabs, active }
}

/** Opens a session in the workspace: a new tab at the end, or the one it already has, and shows it. */
export function openTab(ws: WorkspaceTabs, sessionId: string): WorkspaceTabs {
  return { tabs: ws.tabs.includes(sessionId) ? ws.tabs : [...ws.tabs, sessionId], active: sessionId }
}

/** Shows a tab that's already open; anything else is left as it is. */
export function activateTab(ws: WorkspaceTabs, sessionId: string): WorkspaceTabs {
  return ws.tabs.includes(sessionId) && ws.active !== sessionId ? { ...ws, active: sessionId } : ws
}

/**
 * Takes tabs off the strip. When the one showing goes, the tab to its right
 * shows instead, or the one to its left at the end of the strip, as in a browser.
 */
export function closeTabs(ws: WorkspaceTabs, sessionIds: Iterable<string>): WorkspaceTabs {
  const gone = new Set(sessionIds)
  if (!ws.tabs.some((id) => gone.has(id))) return ws
  const tabs = ws.tabs.filter((id) => !gone.has(id))
  if (ws.active === null || !gone.has(ws.active)) return { tabs, active: ws.active }
  const at = ws.tabs.indexOf(ws.active)
  const right = ws.tabs.slice(at + 1).find((id) => !gone.has(id))
  const left = ws.tabs.slice(0, at).reverse().find((id) => !gone.has(id))
  return { tabs, active: right ?? left ?? null }
}

export function closeTab(ws: WorkspaceTabs, sessionId: string): WorkspaceTabs {
  return closeTabs(ws, [sessionId])
}

/**
 * The tabs a fresh read of the board closes: those of sessions it shows in the
 * archive, or doesn't have. A read asked for before a tab opened can't speak
 * for it, since the session may be newer than the read, or back from the
 * archive since, so its tab stays. `openedAt` is how many reads had been asked
 * for when each tab opened, and `read` this read's number in that count.
 */
export function closedByRead(
  tabs: string[],
  onBoard: (sessionId: string) => { archived?: boolean } | undefined,
  openedAt: (sessionId: string) => number,
  read: number
): string[] {
  return tabs.filter((id) => {
    if (openedAt(id) >= read) return false
    const card = onBoard(id)
    return !card || Boolean(card.archived)
  })
}

/** The tab `delta` places from the one showing, wrapping around the strip (⌃Tab and ⌃⇧Tab). */
export function cycleTab(ws: WorkspaceTabs, delta: number): string | null {
  if (ws.tabs.length === 0) return null
  const at = ws.active === null ? -1 : ws.tabs.indexOf(ws.active)
  const n = ws.tabs.length
  if (at < 0) return ws.tabs[delta < 0 ? n - 1 : 0]
  return ws.tabs[(((at + delta) % n) + n) % n]
}

/** The tab ⌘1 to ⌘8 jump to, counting from 1; ⌘9 is always the last, as in a browser. */
export function tabAt(ws: WorkspaceTabs, digit: number): string | null {
  if (!Number.isInteger(digit) || digit < 1 || digit > 9 || ws.tabs.length === 0) return null
  return digit === 9 ? ws.tabs[ws.tabs.length - 1] : (ws.tabs[digit - 1] ?? null)
}

/**
 * The widest the project panel gets beside the workspace's terminal: its own
 * maximum, or half the row, so the terminal keeps the other half; never under
 * its minimum. `row` is the width of the terminal and the panel together, 0
 * while unmeasured.
 */
export function splitMax(row: number): number {
  const half = row > 0 ? Math.floor(row / 2) : PANEL_MAX_W
  return Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, half))
}

/** The project panel's width beside the workspace's terminal, between its minimum and splitMax. */
export function clampSplit(width: number, row: number): number {
  const w = Number.isFinite(width) ? width : PANEL_MIN_W
  return Math.round(Math.min(splitMax(row), Math.max(PANEL_MIN_W, w)))
}
