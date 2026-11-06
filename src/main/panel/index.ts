// The project panel's data, by project: pull requests (github.ts) and tickets
// (jira.ts). Each project's last answer is kept, so switching tabs, projects
// or sessions shows it at once while a fresh one is read. A read asked for
// while one is going joins it rather than starting another.
import type { Project, PullRequestsResult, TicketsResult } from '@shared/types'
import { pullRequests } from './github'
import { tickets } from './jira'

interface Kept<T> {
  last?: T
  going?: Promise<T>
}

const prs = new Map<string, Kept<PullRequestsResult>>()
const issues = new Map<string, Kept<TicketsResult>>()

function read<T>(kept: Map<string, Kept<T>>, projectId: string, fetch: () => Promise<T>): Promise<T> {
  const entry = kept.get(projectId) ?? {}
  kept.set(projectId, entry)
  if (entry.going) return entry.going
  const going = fetch()
    .then((result) => {
      entry.last = result
      return result
    })
    .finally(() => {
      if (entry.going === going) entry.going = undefined
    })
  entry.going = going
  return going
}

/** The last pull requests read for the project (null before the first), or fresh ones. */
export function projectPullRequests(project: Project, fresh: boolean): Promise<PullRequestsResult | null> {
  if (!fresh) return Promise.resolve(prs.get(project.id)?.last ?? null)
  return read(prs, project.id, () => pullRequests(project.repoPath))
}

/** The last tickets read for the project (null before the first), or fresh ones. */
export function projectTickets(project: Project, fresh: boolean): Promise<TicketsResult | null> {
  if (!fresh) return Promise.resolve(issues.get(project.id)?.last ?? null)
  return read(issues, project.id, () => tickets(project))
}

/** Drops kept tickets: the project's after its link changed, or everyone's after the account did. */
export function forgetTickets(projectId?: string) {
  if (projectId) issues.delete(projectId)
  else issues.clear()
}

/** Drops everything kept for a project that was removed, or whose folder became a repository. */
export function forgetProject(projectId: string) {
  prs.delete(projectId)
  issues.delete(projectId)
}
