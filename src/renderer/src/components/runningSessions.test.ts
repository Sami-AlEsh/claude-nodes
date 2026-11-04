import { describe, expect, it } from 'vitest'
import type { Project, ProjectStats, RunningCounts } from '@shared/types'
import { runningByProject, runningTotal } from './runningSessions'

const project = (id: string, name: string): Project => ({
  id,
  name,
  repoPath: `/repos/${name}`,
  color: 'blue',
  createdAt: 0
})

const stats = (running: Partial<RunningCounts>): ProjectStats => ({
  total: 0,
  active: 0,
  working: 0,
  waiting: 0,
  running: { sessions: 0, background: 0, terminals: 0, ...running }
})

describe('runningTotal', () => {
  it('counts Claude sessions in every project, hidden ones too, but not shells', () => {
    expect(runningTotal({ a: stats({ sessions: 2, terminals: 3 }), b: stats({ background: 1 }) })).toBe(3)
  })

  it('is zero with nothing running', () => {
    expect(runningTotal({})).toBe(0)
    expect(runningTotal({ a: stats({ terminals: 1 }) })).toBe(0)
  })
})

describe('runningByProject', () => {
  const projects = [project('a', 'nodus'), project('b', 'mumz-ui'), project('c', 'idle')]
  const names = (rows: { name: string; count: number }[]) => rows.map((r) => `${r.name} (${r.count})`)

  it('gives each project with Claude sessions running and its count, in project order', () => {
    const rows = runningByProject(projects, {
      b: stats({ sessions: 1 }),
      a: stats({ sessions: 2, terminals: 1 }),
      c: stats({})
    })
    expect(names(rows)).toEqual(['nodus (2)', 'mumz-ui (1)'])
  })

  it('counts a project’s hidden sessions with its cards', () => {
    expect(names(runningByProject(projects, { a: stats({ sessions: 1, background: 2 }) }))).toEqual(['nodus (3)'])
  })

  it('leaves out a project that’s only running shells', () => {
    const rows = runningByProject(projects, { a: stats({ terminals: 2 }), b: stats({ sessions: 1 }) })
    expect(names(rows)).toEqual(['mumz-ui (1)'])
  })
})
