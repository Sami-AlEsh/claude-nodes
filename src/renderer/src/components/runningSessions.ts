// The title bar's count of the Claude sessions the app is running, in every project.
import type { ProjectStats, Project, RunningCounts } from '@shared/types'

/** Claude processes, hidden ones included. Shells aren't counted. */
const claude = (r: RunningCounts) => r.sessions + r.background

/** Claude sessions running across projects. */
export function runningTotal(stats: Record<string, ProjectStats>): number {
  let total = 0
  for (const s of Object.values(stats)) total += claude(s.running)
  return total
}

/** Each project with Claude sessions running, and how many, in project order. */
export function runningByProject(
  projects: Project[],
  stats: Record<string, ProjectStats>
): { id: string; name: string; count: number }[] {
  const rows: { id: string; name: string; count: number }[] = []
  for (const project of projects) {
    const running = stats[project.id]?.running
    const count = running ? claude(running) : 0
    if (count > 0) rows.push({ id: project.id, name: project.name, count })
  }
  return rows
}
