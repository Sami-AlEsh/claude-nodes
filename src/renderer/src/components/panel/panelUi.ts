// What the project panel shows, worked out from the lists the main process
// sends: filters, groups, counts and labels. Kept apart from the components
// so it can be tested without a DOM.
import type {
  PanelProblem,
  PullRequestChecks,
  PullRequestRow,
  PullRequestsResult,
  TicketRow,
  TicketsResult
} from '@shared/types'

export type PanelTab = 'prs' | 'tickets' | 'changes'
export type PrFilter = 'all' | 'mine' | 'review' | 'failing'
export type TicketFilter = 'all' | 'mine' | 'sprint'

export const PR_FILTERS: { id: PrFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'review', label: 'Needs my review' },
  { id: 'failing', label: 'Failing' }
]

export const TICKET_FILTERS: { id: TicketFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'sprint', label: 'This sprint' }
]

export interface Group<T> {
  id: string
  title: string
  rows: T[]
}

export function filterPullRequests(rows: PullRequestRow[], filter: PrFilter): PullRequestRow[] {
  switch (filter) {
    case 'mine':
      return rows.filter((r) => r.mine)
    case 'review':
      return rows.filter((r) => r.needsMyReview)
    case 'failing':
      return rows.filter((r) => r.state !== 'merged' && (r.checks?.failed ?? 0) > 0)
    default:
      return rows
  }
}

/** Open, Draft and Merged this week, in the order they come (newest first), leaving out empty groups. */
export function groupPullRequests(rows: PullRequestRow[]): Group<PullRequestRow>[] {
  const groups: Group<PullRequestRow>[] = [
    { id: 'open', title: 'Open', rows: rows.filter((r) => r.state === 'open') },
    { id: 'draft', title: 'Draft', rows: rows.filter((r) => r.state === 'draft') },
    { id: 'merged', title: 'Merged this week', rows: rows.filter((r) => r.state === 'merged') }
  ]
  return groups.filter((g) => g.rows.length > 0)
}

/** The PRs segment's count: those still open, drafts included. Undefined until there's a list. */
export function pullRequestCount(result: PullRequestsResult | null | undefined): number | undefined {
  if (!result || result.problem) return undefined
  return result.rows.filter((r) => r.state !== 'merged').length
}

export type Tone = 'passed' | 'failed' | 'pending' | 'neutral' | 'accent' | 'review' | 'merged'

/** A PR's checks as its tag says them: all passed, how many failed, or how many are still running. */
export function checksLabel(checks: PullRequestChecks): { text: string; tone: Tone } {
  const n = checks.total
  const noun = n === 1 ? 'check' : 'checks'
  if (checks.failed > 0) return { text: `✗ ${checks.failed} of ${n} ${noun}`, tone: 'failed' }
  if (checks.pending > 0) return { text: `${checks.pending} of ${n} ${noun} running`, tone: 'pending' }
  return { text: `✓ ${n} ${noun}`, tone: 'passed' }
}

export function reviewLabel(review: NonNullable<PullRequestRow['review']>): { text: string; tone: Tone } {
  if (review === 'approved') return { text: 'approved', tone: 'passed' }
  if (review === 'changes-requested') return { text: 'changes requested', tone: 'failed' }
  // Branch protection wants a review, but nobody is asked yet.
  if (review === 'review-required') return { text: 'needs review', tone: 'neutral' }
  return { text: 'review requested', tone: 'pending' }
}

export function filterTickets(rows: TicketRow[], filter: TicketFilter): TicketRow[] {
  if (filter === 'mine') return rows.filter((r) => r.mine)
  if (filter === 'sprint') return rows.filter((r) => r.inActiveSprint)
  return rows
}

/**
 * Work in flight first, one group per status (In Progress, In Review…), then
 * what's to do, by status too, then everything done this week in one group.
 * Statuses in a category go alphabetically, so groups stay put between refreshes.
 */
export function groupTickets(rows: TicketRow[]): Group<TicketRow>[] {
  const byStatus = (category: TicketRow['category']) => {
    const names = [...new Set(rows.filter((r) => r.category === category).map((r) => r.status))]
    return names
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        id: `${category}:${name}`,
        title: name,
        rows: rows.filter((r) => r.category === category && r.status === name)
      }))
  }
  const done = rows.filter((r) => r.category === 'done')
  return [
    ...byStatus('in-progress'),
    ...byStatus('todo'),
    ...(done.length ? [{ id: 'done', title: 'Done this week', rows: done }] : [])
  ]
}

/** The Tickets segment's count: those not done yet. Undefined until there's a list. */
export function ticketCount(result: TicketsResult | null | undefined): number | undefined {
  if (!result || result.problem) return undefined
  return result.rows.filter((r) => r.category !== 'done').length
}

/** A status tag's colour: grey to do, blue in progress, purple in review, green done. */
export function statusTone(row: TicketRow): Tone {
  if (row.category === 'done') return 'passed'
  if (row.category === 'todo') return 'neutral'
  return /review|qa|test/i.test(row.status) ? 'review' : 'accent'
}

export type PriorityLevel = 'highest' | 'high' | 'medium' | 'low' | 'lowest'

/** Jira's five built-in priorities by name; a custom one has no arrow. */
export function priorityLevel(name: string | undefined): PriorityLevel | undefined {
  const n = name?.trim().toLowerCase()
  if (n === 'highest' || n === 'blocker' || n === 'critical') return 'highest'
  if (n === 'high' || n === 'major') return 'high'
  if (n === 'medium') return 'medium'
  if (n === 'low' || n === 'minor') return 'low'
  if (n === 'lowest' || n === 'trivial') return 'lowest'
  return undefined
}

/** Two letters for an avatar: Sami AlEsh → SA, sami-alesh → SA, dependabot → DE. */
export function initials(name: string): string {
  const words = name
    .replace(/\[bot\]$/i, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}

/**
 * What an empty state says: a title, a line on what to do (with commands in
 * backticks, drawn in the terminal's font), and a command to copy when
 * there's no button that does it.
 */
export interface ProblemCopy {
  title: string
  body: string
  command?: string
}

/** `what` is what the tab would list, for the empty state of a folder with no repository. */
export function problemCopy(problem: PanelProblem, what = 'pull requests'): ProblemCopy {
  switch (problem.kind) {
    case 'no-repo':
      return {
        title: 'No git repository here',
        body: `This folder isn’t a repository, so there are no ${what} to show. Start one with \`git init\`, or point the project at a folder that has one.`
      }
    case 'no-github-remote':
      return problem.remote
        ? {
            title: 'Not on GitHub',
            body: `${problem.remote.name} points at ${problem.remote.host}. Pull requests show for repositories on GitHub.`
          }
        : {
            title: 'No GitHub remote',
            body: 'This repository has no remote yet. Add one on GitHub to see its pull requests here.',
            command: 'git remote add origin git@github.com:owner/repo.git'
          }
    case 'gh-missing':
      return {
        title: 'The GitHub CLI isn’t installed',
        body: 'Pull requests come from gh. Install it, sign in, then refresh.',
        command: 'brew install gh && gh auth login'
      }
    case 'gh-logged-out':
      return {
        title: 'Not signed in to GitHub',
        body: `The GitHub CLI isn’t signed in to ${problem.host}. Sign in in a terminal, then refresh.`,
        command: problem.host === 'github.com' ? 'gh auth login' : `gh auth login --hostname ${problem.host}`
      }
    case 'unreachable':
      return {
        title: `Couldn’t reach ${problem.host}`,
        body: 'The GitHub CLI couldn’t connect. Check your connection, then refresh.'
      }
    case 'jira-no-account':
      return {
        title: 'Connect Jira',
        body: 'Sign in to Jira Cloud in Settings › Integrations, then link this folder to one of its projects.'
      }
    case 'jira-not-linked':
      return {
        title: 'Not linked to Jira',
        body: 'Pick the Jira project whose tickets belong to this folder, and they’ll show here with their statuses.'
      }
    case 'jira-auth':
      return {
        title: 'Sign in to Jira again',
        body: `${hostOf(problem.site)} turned down the saved API token. It may have expired or been revoked.`
      }
    case 'error':
      return { title: 'Couldn’t load this list', body: problem.message }
  }
}

/** Text split on backticks: every odd piece is code. */
export function codeSpans(text: string): { text: string; code: boolean }[] {
  return text
    .split('`')
    .map((piece, i) => ({ text: piece, code: i % 2 === 1 }))
    .filter((p) => p.text !== '')
}

/** An error's message, without the wrapping Electron adds to errors thrown in the main process. */
export function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function hostOf(site: string): string {
  try {
    return new URL(site).host
  } catch {
    return site
  }
}
