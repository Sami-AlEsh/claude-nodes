import { describe, expect, it } from 'vitest'
import type { PanelProblem, PullRequestRow } from '@shared/types'
import {
  checksLabel,
  codeSpans,
  errorText,
  filterPullRequests,
  groupPullRequests,
  initials,
  problemCopy,
  pullRequestCount,
  reviewLabel
} from './panelUi'

const pr = (number: number, patch: Partial<PullRequestRow> = {}): PullRequestRow => ({
  number,
  title: `PR ${number}`,
  url: '',
  state: 'open',
  headRef: `branch-${number}`,
  baseRef: 'main',
  author: { login: 'octocat' },
  mine: false,
  needsMyReview: false,
  comments: 0,
  updatedAt: 0,
  ...patch
})

describe('pull requests', () => {
  const rows = [
    pr(15, { mine: true, checks: { total: 3, passed: 2, failed: 1, pending: 0 } }),
    pr(16, { state: 'draft', needsMyReview: true }),
    pr(14, { checks: { total: 1, passed: 1, failed: 0, pending: 0 } }),
    pr(12, { state: 'merged', mine: true })
  ]

  it('groups Open, Draft and Merged this week, leaving out empty groups', () => {
    expect(groupPullRequests(rows).map((g) => [g.title, g.rows.map((r) => r.number)])).toEqual([
      ['Open', [15, 14]],
      ['Draft', [16]],
      ['Merged this week', [12]]
    ])
    expect(groupPullRequests([rows[1]]).map((g) => g.id)).toEqual(['draft'])
  })

  it('filters to mine, those needing my review, and those failing', () => {
    expect(filterPullRequests(rows, 'all')).toHaveLength(4)
    expect(filterPullRequests(rows, 'mine').map((r) => r.number)).toEqual([15, 12])
    expect(filterPullRequests(rows, 'review').map((r) => r.number)).toEqual([16])
    expect(filterPullRequests(rows, 'failing').map((r) => r.number)).toEqual([15])
  })

  it('counts the ones still open on the segment, once there is a list', () => {
    expect(pullRequestCount({ rows, fetchedAt: 0 })).toBe(3)
    expect(pullRequestCount(undefined)).toBeUndefined()
    expect(pullRequestCount({ rows: [], problem: { kind: 'no-repo' }, fetchedAt: 0 })).toBeUndefined()
  })

  it('says how the checks went', () => {
    expect(checksLabel({ total: 3, passed: 3, failed: 0, pending: 0 })).toEqual({ text: '✓ 3 checks', tone: 'passed' })
    expect(checksLabel({ total: 3, passed: 1, failed: 1, pending: 1 })).toEqual({ text: '✗ 1 of 3 checks', tone: 'failed' })
    expect(checksLabel({ total: 1, passed: 0, failed: 0, pending: 1 })).toEqual({ text: '1 of 1 check running', tone: 'pending' })
  })

  it('says the review state', () => {
    expect(reviewLabel('approved').text).toBe('approved')
    expect(reviewLabel('changes-requested')).toEqual({ text: 'changes requested', tone: 'failed' })
    expect(reviewLabel('review-requested')).toEqual({ text: 'review requested', tone: 'pending' })
    expect(reviewLabel('review-required')).toEqual({ text: 'needs review', tone: 'neutral' })
  })
})

describe('labels', () => {
  it('makes two-letter avatars', () => {
    expect(initials('Sami AlEsh')).toBe('SA')
    expect(initials('sami-alesh')).toBe('SA')
    expect(initials('dependabot[bot]')).toBe('DE')
    expect(initials('')).toBe('?')
  })

  it('has a title and a next step for every empty state', () => {
    const problems: PanelProblem[] = [
      { kind: 'no-repo' },
      { kind: 'no-github-remote' },
      { kind: 'no-github-remote', remote: { name: 'origin', host: 'gitlab.com' } },
      { kind: 'gh-missing' },
      { kind: 'gh-logged-out', host: 'github.com' },
      { kind: 'unreachable', host: 'github.com' },
      { kind: 'error', message: 'Boom' }
    ]
    for (const p of problems) {
      const copy = problemCopy(p)
      expect(copy.title, p.kind).not.toBe('')
      expect(copy.body, p.kind).not.toBe('')
    }
    expect(problemCopy({ kind: 'no-github-remote', remote: { name: 'origin', host: 'gitlab.com' } }).body).toContain(
      'origin points at gitlab.com'
    )
    expect(problemCopy({ kind: 'gh-logged-out', host: 'ghe.example.com' }).command).toBe(
      'gh auth login --hostname ghe.example.com'
    )
    expect(problemCopy({ kind: 'no-repo' }, 'changes').body).toContain('no changes to show')
    const unreachable = problemCopy({ kind: 'unreachable', host: 'github.com' })
    expect(unreachable.title).toBe('Couldn’t reach github.com')
    expect(`${unreachable.body} ${unreachable.command ?? ''}`).not.toMatch(/sign|login/i)
  })

  it('marks commands in backticks as code', () => {
    expect(codeSpans('Start one with `git init`, then refresh.')).toEqual([
      { text: 'Start one with ', code: false },
      { text: 'git init', code: true },
      { text: ', then refresh.', code: false }
    ])
  })

  it('takes off the wrapping errors from the main process come in', () => {
    expect(errorText(new Error("Error invoking remote method 'panel:git-init': Error: git init failed"))).toBe('git init failed')
  })
})
