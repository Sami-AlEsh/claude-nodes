// The project panel's settings, shared by the main process (which saves them)
// and the renderer (which drags the width).
import type { AppSettings, PullRequestRow } from './types'

export const PANEL_MIN_W = 280
export const PANEL_MAX_W = 640
export const PANEL_DEFAULT_W = 360

/** The narrowest the board gets for the panel: room for the prompt bar and a column of cards. */
export const BOARD_MIN_W = 480

/** A width in the panel's range, rounded to whole pixels. */
export function clampPanelWidth(width: number): number {
  return Math.round(Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, width)))
}

/**
 * The width the panel gets in a window this wide, with this much taken on
 * the left (the pinned project rail): the saved width, cut down so the board
 * keeps BOARD_MIN_W, but never below PANEL_MIN_W. The saved width stays as it
 * is, so a wider window gives it back.
 */
export function fitPanelWidth(width: number, windowWidth: number, leftW = 0): number {
  const room = Math.floor(windowWidth - leftW - BOARD_MIN_W)
  return clampPanelWidth(Math.min(width, Math.max(PANEL_MIN_W, room)))
}

/** The panel's settings from saved state, with defaults for anything missing or not understood. */
export function normalizePanel(s: Partial<AppSettings>): Pick<AppSettings, 'panelOpen' | 'panelWidth'> {
  const width = typeof s.panelWidth === 'number' && Number.isFinite(s.panelWidth) ? s.panelWidth : PANEL_DEFAULT_W
  return { panelOpen: s.panelOpen === true, panelWidth: clampPanelWidth(width) }
}

/**
 * The open pull request whose branch names a Jira issue, as in NDS-42-fix or
 * feature/nds-42. The key has to stand on its own: NDS-4 doesn't match a
 * branch for NDS-42, and neither does XNDS-42.
 */
export function prForIssue(key: string, prs: PullRequestRow[]): PullRequestRow | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escaped}(?![0-9])`, 'i')
  return prs.find((pr) => pr.state !== 'merged' && pattern.test(pr.headRef))
}
