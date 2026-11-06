// The project panel's data, by project: pull requests (github.ts). Each
// project's last answer is kept, so switching tabs, projects or sessions shows
// it at once while a fresh one is read. A read asked for while one is going
// joins it rather than starting another.
import type { Project, PullRequestsResult } from '@shared/types'
import { pullRequests } from './github'

interface Kept {
  last?: PullRequestsResult
  going?: Promise<PullRequestsResult>
}

const prs = new Map<string, Kept>()

/** The last pull requests read for the project (null before the first), or fresh ones. */
export function projectPullRequests(project: Project, fresh: boolean): Promise<PullRequestsResult | null> {
  const entry = prs.get(project.id) ?? {}
  prs.set(project.id, entry)
  if (!fresh) return Promise.resolve(entry.last ?? null)
  if (entry.going) return entry.going
  const going = pullRequests(project.repoPath)
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

/** Drops what's kept for a project that was removed, or whose folder became a repository. */
export function forgetProject(projectId: string) {
  prs.delete(projectId)
}
