// The project panel's lists, by project. The main process keeps each
// project's last answer too, so a panel that opens on a project shows its
// last lists at once, then reads them again.
import { create } from 'zustand'
import type { PullRequestsResult, TicketsResult } from '@shared/types'
import { useApp } from '@renderer/store'
import { errorText } from './panelUi'

interface PanelData {
  prs: Record<string, PullRequestsResult>
  tickets: Record<string, TicketsResult>
  /** Projects whose lists are being read now. */
  loading: Record<string, boolean>
}

export const usePanelData = create<PanelData>(() => ({ prs: {}, tickets: {}, loading: {} }))

/** The project's refresh in flight: one at a time, and a refresh asked for meanwhile is skipped. */
const going = new Map<string, Promise<void>>()

/** When the project's lists were last read, or 0. */
export function fetchedAt(projectId: string): number {
  const { prs, tickets } = usePanelData.getState()
  return Math.min(prs[projectId]?.fetchedAt ?? 0, tickets[projectId]?.fetchedAt ?? 0)
}

function store(projectId: string, prs: PullRequestsResult | null, tickets: TicketsResult | null) {
  usePanelData.setState((s) => ({
    prs: prs ? { ...s.prs, [projectId]: prs } : s.prs,
    tickets: tickets ? { ...s.tickets, [projectId]: tickets } : s.tickets
  }))
}

/** Shows what the main process read last for the project, if this window has nothing yet. */
export async function showLast(projectId: string): Promise<void> {
  const { prs, tickets } = usePanelData.getState()
  if (prs[projectId] && tickets[projectId]) return
  const [lastPrs, lastTickets] = await Promise.all([
    prs[projectId] ? null : window.api.panel.pullRequests(projectId, false),
    tickets[projectId] ? null : window.api.panel.tickets(projectId, false)
  ])
  store(projectId, lastPrs, lastTickets)
}

/**
 * Reads the project's pull requests, tickets and changes again. Each list
 * shows as soon as it's in, so a slow Jira never holds up the PRs.
 */
export function refreshPanel(projectId: string): Promise<void> {
  const running = going.get(projectId)
  if (running) return running
  usePanelData.setState((s) => ({ loading: { ...s.loading, [projectId]: true } }))
  const failed = (err: unknown) => ({
    rows: [],
    problem: { kind: 'error' as const, message: errorText(err) },
    fetchedAt: Date.now()
  })
  const run = Promise.all([
    window.api.panel
      .pullRequests(projectId, true)
      .catch(failed)
      .then((prs) => store(projectId, prs, null)),
    window.api.panel
      .tickets(projectId, true)
      .catch((err) => ({ ...failed(err), sprints: false }))
      .then((tickets) => store(projectId, null, tickets)),
    useApp.getState().refreshGit()
  ])
    .then(() => undefined)
    .finally(() => {
      going.delete(projectId)
      usePanelData.setState((s) => ({ loading: { ...s.loading, [projectId]: false } }))
    })
  going.set(projectId, run)
  return run
}

/** Reads the tickets again on their own, after the project's Jira link or the account changed. */
export async function refreshTickets(projectId: string): Promise<void> {
  const tickets = await window.api.panel.tickets(projectId, true).catch((err: unknown) => ({
    rows: [],
    sprints: false,
    problem: { kind: 'error' as const, message: errorText(err) },
    fetchedAt: Date.now()
  }))
  store(projectId, null, tickets)
}

/** Forgets every project's tickets, after the Jira account changed, so none shows the old account's. */
export function forgetTickets() {
  usePanelData.setState({ tickets: {} })
}
