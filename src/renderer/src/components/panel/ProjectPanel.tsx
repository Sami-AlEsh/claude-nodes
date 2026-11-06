import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  FileDiff,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestDraft,
  Minus,
  RefreshCw,
  SquareKanban,
  TriangleAlert
} from 'lucide-react'
import type { PanelProblem, PullRequestRow, PullRequestsResult, TicketRow, TicketsResult } from '@shared/types'
import { prForIssue } from '@shared/panel'
import { useApp } from '@renderer/store'
import { timeAgo } from '@renderer/components/board/layout'
import { FilePath, StatusIcon, fileTitle } from '@renderer/components/git/DiffModal'
import { branchLabel } from '@renderer/components/git/GitControls'
import { JiraLinkDialog } from './JiraLinkDialog'
import { fetchedAt, refreshPanel, showLast, usePanelData } from './panelData'
import {
  PR_FILTERS,
  TICKET_FILTERS,
  checksLabel,
  codeSpans,
  errorText,
  filterPullRequests,
  filterTickets,
  groupPullRequests,
  groupTickets,
  initials,
  priorityLevel,
  problemCopy,
  pullRequestCount,
  reviewLabel,
  statusTone,
  ticketCount,
  type Group,
  type PanelTab,
  type PriorityLevel,
  type Tone
} from './panelUi'
import './panel.css'

/** How often the lists are read again while the panel shows. */
export const PANEL_REFRESH_MS = 2 * 60_000
/** Showing the panel, or coming back to the window, reads the lists again once they're this old. */
const STALE_MS = 30_000

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'prs', label: 'PRs' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'changes', label: 'Changes' }
]

/** Re-renders every half minute, for “updated 3m ago”. */
function useTick(active: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

const open = (url: string) => {
  if (url) window.open(url, '_blank')
}

/**
 * The project's pull requests, tickets and uncommitted changes, in segments.
 * Self-contained: it reads and refreshes its own lists for `projectId`, so it
 * can sit beside the board or anywhere else. `active` is whether it's showing;
 * nothing is read or polled while it isn't.
 */
export function ProjectPanel({
  projectId,
  active = true,
  onHide
}: {
  projectId: string
  active?: boolean
  onHide?: () => void
}) {
  const tab = useApp((s) => s.panelTab)
  const setTab = useApp((s) => s.setPanelTab)
  const git = useApp((s) => s.git)
  const prs = usePanelData((s) => s.prs[projectId])
  const tickets = usePanelData((s) => s.tickets[projectId])
  const loading = usePanelData((s) => s.loading[projectId] ?? false)
  const now = useTick(active)

  // The last lists at once, then fresh ones if they're old; again every two
  // minutes while the window is in front, and when it comes back to the front.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const refreshIfStale = () => {
      if (Date.now() - fetchedAt(projectId) > STALE_MS) void refreshPanel(projectId)
    }
    void showLast(projectId).finally(() => !cancelled && refreshIfStale())
    const timer = window.setInterval(() => {
      if (document.hasFocus()) void refreshPanel(projectId)
    }, PANEL_REFRESH_MS)
    window.addEventListener('focus', refreshIfStale)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshIfStale)
    }
  }, [projectId, active])

  const counts: Record<PanelTab, number | undefined> = {
    prs: pullRequestCount(prs),
    tickets: ticketCount(tickets),
    changes: git?.files.length
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-seg" role="tablist" aria-label="Project panel">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={clsx('panel-seg-item', tab === t.id && 'is-on')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {counts[t.id] !== undefined && <span className="panel-seg-count">{counts[t.id]}</span>}
            </button>
          ))}
        </div>
        <span className="panel-head-spacer" />
        <button
          className={clsx('btn btn-icon panel-head-btn', loading && 'is-loading')}
          onClick={() => void refreshPanel(projectId)}
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw size={13} strokeWidth={2} />
        </button>
        {onHide && (
          <button className="btn btn-icon panel-head-btn" onClick={onHide} title="Hide the panel" aria-label="Hide the panel">
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {tab === 'prs' && <PullRequestsTab projectId={projectId} result={prs} now={now} />}
      {tab === 'tickets' && <TicketsTab projectId={projectId} result={tickets} prs={prs} now={now} />}
      {tab === 'changes' && <ChangesTab projectId={projectId} prs={prs} />}
    </div>
  )
}

function Chips<T extends string>({
  options,
  value,
  onPick,
  label
}: {
  options: { id: T; label: string }[]
  value: T
  onPick: (id: T) => void
  label: string
}) {
  return (
    <div className="panel-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          className={clsx('panel-chip', value === o.id && 'is-on')}
          onClick={() => onPick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Footer({ children, link }: { children: ReactNode; link?: { url: string; label: string } }) {
  return (
    <div className="panel-foot">
      <span className="panel-foot-text">{children}</span>
      {link && (
        <a className="panel-foot-link" href={link.url} target="_blank" rel="noreferrer">
          {link.label} ↗
        </a>
      )}
    </div>
  )
}

function Groups<T>({ groups, render, empty }: { groups: Group<T>[]; render: (row: T) => ReactNode; empty: string }) {
  if (groups.length === 0) return <div className="panel-none">{empty}</div>
  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className="panel-group" aria-label={g.title}>
          <h4 className="panel-group-title">
            {g.title} · {g.rows.length}
          </h4>
          {g.rows.map(render)}
        </section>
      ))}
    </>
  )
}

function Tag({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className="panel-tag" data-tone={tone} title={title}>
      {children}
    </span>
  )
}

function Avatar({ name, title }: { name: string; title?: string }) {
  return (
    <span className="panel-avatar" title={title ?? name} aria-label={title ?? name}>
      {initials(name)}
    </span>
  )
}

function Loading({ what }: { what: string }) {
  return <div className="panel-none">Loading {what}…</div>
}

/* ───────────── PRs ───────────── */

function PullRequestsTab({
  projectId,
  result,
  now
}: {
  projectId: string
  result: PullRequestsResult | undefined
  now: number
}) {
  const filter = useApp((s) => s.prFilter)
  const setFilter = useApp((s) => s.setPrFilter)
  if (!result) return <Loading what="pull requests" />
  if (result.problem) return <Problem projectId={projectId} problem={result.problem} />

  const groups = groupPullRequests(filterPullRequests(result.rows, filter))
  return (
    <>
      <Chips options={PR_FILTERS} value={filter} onPick={setFilter} label="Show pull requests" />
      <div className="panel-list">
        <Groups
          groups={groups}
          empty={filter === 'all' ? 'No open pull requests, and none merged this week.' : 'None match this filter.'}
          render={(pr) => <PullRequestItem key={pr.number} pr={pr} now={now} />}
        />
      </div>
      <Footer link={result.repo && { url: `${result.repo.url}/pulls`, label: 'GitHub' }}>
        {result.repo?.nameWithOwner} · updated {timeAgo(result.fetchedAt, now)}
      </Footer>
    </>
  )
}

function PullRequestIcon({ state }: { state: PullRequestRow['state'] }) {
  const props = { size: 16, strokeWidth: 1.8, className: 'panel-row-icon', 'data-state': state, 'aria-hidden': true }
  if (state === 'merged') return <GitMerge {...props} />
  if (state === 'draft') return <GitPullRequestDraft {...props} />
  return <GitPullRequest {...props} />
}

function PullRequestItem({ pr, now }: { pr: PullRequestRow; now: number }) {
  const checks = pr.checks && checksLabel(pr.checks)
  const review = pr.review && reviewLabel(pr.review)
  const who = pr.author.name ?? pr.author.login
  return (
    <button className="panel-row" onClick={() => open(pr.url)} title={`Open #${pr.number} on GitHub`}>
      <PullRequestIcon state={pr.state} />
      <span className="panel-row-main">
        <span className="panel-row-title">{pr.title}</span>
        <span className="panel-row-sub">
          <span>#{pr.number}</span>
          {pr.state !== 'merged' && pr.headRef && (
            <span className="panel-branch" title={`${pr.headRef} → ${pr.baseRef}`}>
              {pr.headRef} → {pr.baseRef}
            </span>
          )}
          {pr.state === 'draft' && <Tag tone="neutral">draft</Tag>}
          {pr.state === 'merged' && <Tag tone="merged">merged</Tag>}
          {checks && <Tag tone={checks.tone}>{checks.text}</Tag>}
          {review && <Tag tone={review.tone}>{review.text}</Tag>}
          {pr.state !== 'merged' && (
            <Avatar name={who} title={pr.author.bot ? `${pr.author.login} (bot)` : `${who} (${pr.author.login})`} />
          )}
          {pr.comments > 0 && <span>{pr.comments === 1 ? '1 comment' : `${pr.comments} comments`}</span>}
          <span>{timeAgo(pr.state === 'merged' ? (pr.mergedAt ?? pr.updatedAt) : pr.updatedAt, now)}</span>
        </span>
      </span>
    </button>
  )
}

/* ───────────── Tickets ───────────── */

function TicketsTab({
  projectId,
  result,
  prs,
  now
}: {
  projectId: string
  result: TicketsResult | undefined
  prs: PullRequestsResult | undefined
  now: number
}) {
  const filter = useApp((s) => s.ticketFilter)
  const setFilter = useApp((s) => s.setTicketFilter)
  const [linking, setLinking] = useState(false)
  if (!result) return <Loading what="tickets" />

  const dialog = linking && <JiraLinkDialog projectId={projectId} onClose={() => setLinking(false)} />
  if (result.problem) {
    return (
      <>
        <Problem projectId={projectId} problem={result.problem} onLink={() => setLinking(true)} linked={result.project?.key} />
        {dialog}
      </>
    )
  }

  // Without a Sprint field there's nothing for This sprint to go by.
  const options = result.sprints ? TICKET_FILTERS : TICKET_FILTERS.filter((f) => f.id !== 'sprint')
  const current = options.some((o) => o.id === filter) ? filter : 'all'
  const groups = groupTickets(filterTickets(result.rows, current))
  const openPrs = prs?.rows ?? []
  return (
    <>
      <Chips options={options} value={current} onPick={setFilter} label="Show tickets" />
      <div className="panel-list">
        <Groups
          groups={groups}
          empty={current === 'all' ? 'Nothing to do or in progress, and nothing done this week.' : 'None match this filter.'}
          render={(t) => <TicketItem key={t.key} ticket={t} pr={prForIssue(t.key, openPrs)} />}
        />
      </div>
      <Footer link={result.project && { url: result.project.url, label: 'Jira' }}>
        <button className="panel-foot-key" onClick={() => setLinking(true)} title="Link another Jira project">
          {result.project?.key}
        </button>{' '}
        · updated {timeAgo(result.fetchedAt, now)}
      </Footer>
      {dialog}
    </>
  )
}

const PRIORITY_ICON: Record<PriorityLevel, typeof ArrowUp> = {
  highest: ChevronsUp,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
  lowest: ChevronsDown
}

function PriorityIcon({ name }: { name?: string }) {
  const level = priorityLevel(name)
  if (!level) return <span className="panel-priority" title={name ? `${name} priority` : 'No priority'} />
  const Icon = PRIORITY_ICON[level]
  return (
    <span className="panel-priority" data-level={level} title={`${name} priority`}>
      <Icon size={14} strokeWidth={2.2} aria-label={`${name} priority`} />
    </span>
  )
}

function TicketItem({ ticket, pr }: { ticket: TicketRow; pr?: PullRequestRow }) {
  return (
    <button className="panel-row" onClick={() => open(ticket.url)} title={`Open ${ticket.key} in Jira`}>
      <PriorityIcon name={ticket.priority} />
      <span className="panel-row-main">
        <span className="panel-row-title">{ticket.summary}</span>
        <span className="panel-row-sub">
          <span className="panel-key">{ticket.key}</span>
          <Tag tone={statusTone(ticket)}>{ticket.status}</Tag>
          {ticket.type && <span>{ticket.type}</span>}
          {ticket.assignee && <Avatar name={ticket.assignee.name} />}
          {pr && <span title={pr.title}>PR #{pr.number}</span>}
        </span>
      </span>
    </button>
  )
}

/* ───────────── Changes ───────────── */

function ChangesTab({ projectId, prs }: { projectId: string; prs: PullRequestsResult | undefined }) {
  const git = useApp((s) => s.git)
  const openDiff = useApp((s) => s.openDiff)
  if (!git) {
    // The status is null both before it's read and when there's no repository; the PRs tab's answer tells them apart.
    return prs?.problem?.kind === 'no-repo' ? (
      <Problem projectId={projectId} problem={prs.problem} what="changes" />
    ) : (
      <Loading what="changes" />
    )
  }
  const count = git.files.length
  return (
    <>
      <div className="panel-list">
        {count === 0 ? (
          <EmptyState icon={<FileDiff size={22} strokeWidth={1.6} />} title="No local changes">
            <p>
              There are no uncommitted changes on <code className="panel-code">{branchLabel(git)}</code>.
            </p>
          </EmptyState>
        ) : (
          <section className="panel-group" aria-label="Changed files">
            <h4 className="panel-group-title">
              {count === 1 ? '1 changed file' : `${count} changed files`}
            </h4>
            {git.files.map((f) => (
              <button
                key={`${f.status}:${f.path}`}
                className="diff-file panel-file"
                onClick={() => openDiff(f.path)}
                title={`${fileTitle(f)}\nClick to see its diff`}
              >
                <FilePath path={f.path} />
                <StatusIcon status={f.status} />
              </button>
            ))}
          </section>
        )}
      </div>
      <div className="panel-foot">
        <span className="panel-foot-text">
          <GitBranch size={12} strokeWidth={2.2} /> {branchLabel(git)}
        </span>
        {count > 0 && (
          <button className="panel-foot-link" onClick={() => openDiff()}>
            Open Changes
          </button>
        )}
      </div>
    </>
  )
}

/* ───────────── Empty states ───────────── */

function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="panel-empty">
      <div className="panel-empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="panel-empty-title">{title}</h3>
      {children}
    </div>
  )
}

function Prose({ text }: { text: string }) {
  return (
    <p>
      {codeSpans(text).map((piece, i) =>
        piece.code ? (
          <code key={i} className="panel-code">
            {piece.text}
          </code>
        ) : (
          piece.text
        )
      )}
    </p>
  )
}

function problemIcon(problem: PanelProblem) {
  switch (problem.kind) {
    case 'no-repo':
    case 'no-github-remote':
      return <GitBranch size={22} strokeWidth={1.6} />
    case 'gh-missing':
    case 'gh-logged-out':
      return <GitPullRequest size={22} strokeWidth={1.6} />
    case 'jira-no-account':
    case 'jira-not-linked':
    case 'jira-auth':
      return <SquareKanban size={22} strokeWidth={1.6} />
    default:
      return <TriangleAlert size={22} strokeWidth={1.6} />
  }
}

/** What to do next when a tab has nothing to list: a line on why, and a button or command that fixes it. */
function Problem({
  projectId,
  problem,
  what,
  onLink,
  linked
}: {
  projectId: string
  problem: PanelProblem
  what?: string
  onLink?: () => void
  /** The Jira project a failed tickets read was for. */
  linked?: string
}) {
  const copy = problemCopy(problem, what)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const init = async () => {
    setBusy(true)
    setError(null)
    try {
      await window.api.panel.gitInit(projectId)
      await refreshPanel(projectId)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const settings = () => useApp.getState().openSettings('integrations')
  let action: ReactNode = null
  if (problem.kind === 'no-repo') {
    action = (
      <button className="btn" onClick={() => void init()} disabled={busy}>
        {busy ? 'Initialising…' : 'Initialise a repository'}
      </button>
    )
  } else if (problem.kind === 'jira-not-linked') {
    action = (
      <button className="btn btn-primary" onClick={onLink}>
        Link a Jira project
      </button>
    )
  } else if (problem.kind === 'jira-no-account' || problem.kind === 'jira-auth') {
    action = (
      <button className="btn btn-primary" onClick={settings}>
        {problem.kind === 'jira-auth' ? 'Sign in again' : 'Open Settings › Integrations'}
      </button>
    )
  } else if (problem.kind === 'error') {
    action = (
      <span className="panel-empty-actions">
        <button className="btn" onClick={() => void refreshPanel(projectId)}>
          Try again
        </button>
        {linked && onLink && (
          <button className="btn" onClick={onLink}>
            Link another project
          </button>
        )}
      </span>
    )
  }

  return (
    <EmptyState icon={problemIcon(problem)} title={copy.title}>
      <Prose text={copy.body} />
      {copy.command && <code className="panel-command selectable">{copy.command}</code>}
      {action}
      {error && <p className="panel-error">{error}</p>}
    </EmptyState>
  )
}
