import { useState } from 'react'
import { SquareTerminal } from 'lucide-react'
import { useApp } from '@renderer/store'
import { runningByProject, runningTotal } from './runningSessions'

/**
 * How many Claude sessions the app is running, in every project, hidden ones
 * included. Sessions started in other terminals aren't the app's, so never count.
 * Pointing at it shows how many run in each project.
 */
export function RunningCount() {
  const stats = useApp((s) => s.stats)
  const projects = useApp((s) => s.projects)
  const [pointing, setPointing] = useState(false)
  const total = runningTotal(stats)
  if (total === 0) return null

  return (
    // no-drag: the title bar is a drag region, which would swallow the pointer.
    <div
      className="titlebar-running no-drag"
      onPointerEnter={() => setPointing(true)}
      onPointerLeave={() => setPointing(false)}
    >
      <SquareTerminal size={13} strokeWidth={2} />
      {total} running
      {pointing && (
        <div className="titlebar-running-card" role="tooltip">
          {runningByProject(projects, stats).map((row) => (
            <span key={row.id} className="titlebar-running-row">
              {row.name} ({row.count})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
