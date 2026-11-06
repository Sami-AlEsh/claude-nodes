// The project panel's lists, by project. The main process keeps each
// project's last answer too, so a panel that opens on a project shows its
// last lists at once, then reads them again.
import { create } from 'zustand'
import type { PullRequestsResult } from '@shared/types'
import { useApp } from '@renderer/store'
import { errorText } from './panelUi'

interface PanelData {
  prs: Record<string, PullRequestsResult>
  /** Projects whose lists are being read now. */
  loading: Record<string, boolean>
}

export const usePanelData = create<PanelData>(() => ({ prs: {}, loading: {} }))

/** The project's refresh in flight: one at a time, and a refresh asked for meanwhile is skipped. */
const going = new Map<string, Promise<void>>()

/** When the project's pull requests were last read, or 0. */
export function fetchedAt(projectId: string): number {
  return usePanelData.getState().prs[projectId]?.fetchedAt ?? 0
}

function store(projectId: string, prs: PullRequestsResult | null) {
  if (prs) usePanelData.setState((s) => ({ prs: { ...s.prs, [projectId]: prs } }))
}

/** Shows what the main process read last for the project, if this window has nothing yet. */
export async function showLast(projectId: string): Promise<void> {
  if (usePanelData.getState().prs[projectId]) return
  store(projectId, await window.api.panel.pullRequests(projectId, false))
}

/** Reads the project's pull requests and changes again. */
export function refreshPanel(projectId: string): Promise<void> {
  const running = going.get(projectId)
  if (running) return running
  usePanelData.setState((s) => ({ loading: { ...s.loading, [projectId]: true } }))
  const run = Promise.all([
    window.api.panel
      .pullRequests(projectId, true)
      .catch((err: unknown) => ({
        rows: [],
        problem: { kind: 'error' as const, message: errorText(err) },
        fetchedAt: Date.now()
      }))
      .then((prs) => store(projectId, prs)),
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
