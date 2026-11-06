// The project panel's PRs tab: the repository's pull requests, from the GitHub
// CLI. `gh` is already signed in wherever it's used, works for GitHub
// Enterprise hosts too, and keeps its token to itself, so there's nothing to
// set up in Nodus. Everything here only reads.
import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { PanelProblem, PullRequestChecks, PullRequestRow, PullRequestsResult } from '@shared/types'
import { envVar, spawnEnv } from '../env'
import { gitStatus } from '../git'

const TIMEOUT_MS = 15_000
/** Each list stops at this many; the panel is for what's going on, not the archive. */
const LIMIT = 50
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const FIELDS = [
  'number',
  'title',
  'url',
  'state',
  'isDraft',
  'author',
  'headRefName',
  'baseRefName',
  'updatedAt',
  'mergedAt',
  'reviewDecision',
  'reviewRequests',
  'statusCheckRollup',
  'comments'
].join(',')
/** gh would send every comment's text: only the count is shown. */
const JQ = 'map(.comments |= length)'

export interface GitRemote {
  name: string
  url: string
}

export interface RemoteRepo {
  /** The git remote it came from, e.g. origin. */
  remote: string
  host: string
  owner: string
  name: string
}

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  /** The program isn't installed (or not on the user's PATH). */
  missing?: boolean
}

function run(bin: string, args: string[], cwd: string): Promise<RunResult> {
  // Never let gh or git stop to ask something: there's no terminal to answer in.
  const env = spawnEnv({
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
    GIT_TERMINAL_PROMPT: '0',
    NO_COLOR: '1'
  })
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { cwd, env, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (!err) return resolve({ code: 0, stdout, stderr })
        const code = (err as { code?: unknown }).code
        if (code === 'ENOENT') return resolve({ code: null, stdout, stderr, missing: true })
        const timedOut = (err as { killed?: boolean }).killed
        resolve({
          code: typeof code === 'number' ? code : null,
          stdout,
          stderr: timedOut ? `${bin} didn’t answer in ${TIMEOUT_MS / 1000} seconds.` : stderr || err.message
        })
      }
    )
  })
}

/**
 * Host, owner and name from a remote's URL, in any of the forms git takes:
 * git@github.com:owner/repo.git, ssh://git@host:22/owner/repo, https://host/owner/repo.
 * Null for a local path.
 */
export function parseRemoteUrl(url: string): { host: string; owner: string; name: string } | null {
  const u = url.trim()
  let host: string
  let repoPath: string
  if (u.includes('://')) {
    try {
      const parsed = new URL(u)
      host = parsed.hostname
      repoPath = decodeURIComponent(parsed.pathname)
    } catch {
      return null
    }
  } else {
    // scp-like syntax; a colon before any slash is what tells it from a path.
    const m = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(u)
    if (!m) return null
    host = m[1]
    repoPath = m[2]
  }
  const parts = repoPath.replace(/\/+$/, '').replace(/\.git$/, '').split('/').filter(Boolean)
  if (!host || parts.length < 2) return null
  // GitHub's SSH-over-HTTPS endpoint is still github.com.
  if (host === 'ssh.github.com') host = 'github.com'
  return { host: host.toLowerCase(), owner: parts[parts.length - 2], name: parts[parts.length - 1] }
}

/** github.com, a GHE.com data-residency host, or an Enterprise host gh is signed in to. */
export function isGithubHost(host: string, ghHosts: readonly string[]): boolean {
  return host === 'github.com' || host.endsWith('.ghe.com') || ghHosts.includes(host)
}

/**
 * The repository the PRs tab lists: the remote `gh repo set-default` picked,
 * else origin, else the first remote on a GitHub host. Unlike gh, which
 * prefers a remote called upstream, the panel follows origin: in a fork you
 * work on, that's where its PRs are.
 */
export function chooseRemote(
  remotes: readonly GitRemote[],
  ghHosts: readonly string[],
  ghDefault?: string
): { repo: RemoteRepo } | { problem: PanelProblem } {
  const parsed = remotes.flatMap((r) => {
    const p = parseRemoteUrl(r.url)
    return p ? [{ remote: r.name, ...p }] : []
  })
  const github = parsed.filter((r) => isGithubHost(r.host, ghHosts))
  const repo =
    github.find((r) => r.remote === ghDefault) ?? github.find((r) => r.remote === 'origin') ?? github[0]
  if (repo) return { repo }
  const other = parsed.find((r) => r.remote === 'origin') ?? parsed[0]
  return {
    problem: { kind: 'no-github-remote', ...(other ? { remote: { name: other.remote, host: other.host } } : {}) }
  }
}

/** `git remote -v` output, one entry per remote. */
export function parseRemotes(output: string): GitRemote[] {
  const out: GitRemote[] = []
  for (const line of output.split('\n')) {
    const m = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line.trim())
    if (m && !out.some((r) => r.name === m[1])) out.push({ name: m[1], url: m[2] })
  }
  return out
}

/** The hosts gh is signed in to: the top-level keys of its hosts.yml. */
export function parseGhHosts(yaml: string): string[] {
  const hosts: string[] = []
  for (const line of yaml.split('\n')) {
    const m = /^([^\s#:][^:]*):\s*$/.exec(line)
    if (m) hosts.push(m[1].trim().toLowerCase())
  }
  return hosts
}

function ghHosts(): string[] {
  const dir =
    envVar('GH_CONFIG_DIR') ||
    path.join(envVar('XDG_CONFIG_HOME') || path.join(os.homedir(), '.config'), 'gh')
  try {
    return parseGhHosts(fs.readFileSync(path.join(dir, 'hosts.yml'), 'utf8'))
  } catch {
    return []
  }
}

const FAILED = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR'])

/**
 * Totals of a PR's checks on its latest commit. A check run again shows up
 * twice in gh's rollup: the latest run of each counts. Undefined when there
 * are none.
 */
export function checksOf(rollup: unknown): PullRequestChecks | undefined {
  if (!Array.isArray(rollup)) return undefined
  const latest = new Map<string, { at: number; outcome: 'passed' | 'failed' | 'pending' }>()
  for (const item of rollup) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    let key: string
    let outcome: 'passed' | 'failed' | 'pending'
    if (c.__typename === 'StatusContext') {
      key = `status:${String(c.context)}`
      const state = String(c.state).toUpperCase()
      outcome = state === 'SUCCESS' ? 'passed' : FAILED.has(state) ? 'failed' : 'pending'
    } else {
      key = `check:${String(c.workflowName ?? '')}/${String(c.name)}`
      const conclusion = String(c.conclusion ?? '').toUpperCase()
      outcome =
        String(c.status).toUpperCase() !== 'COMPLETED' ? 'pending' : FAILED.has(conclusion) ? 'failed' : 'passed'
    }
    const at = Date.parse(String(c.completedAt ?? c.startedAt ?? '')) || 0
    const prev = latest.get(key)
    if (!prev || at >= prev.at) latest.set(key, { at, outcome })
  }
  if (latest.size === 0) return undefined
  const checks: PullRequestChecks = { total: latest.size, passed: 0, failed: 0, pending: 0 }
  for (const { outcome } of latest.values()) checks[outcome]++
  return checks
}

/** What a PR's reviews say, from gh's reviewDecision (empty without branch protection) and who's asked to review. */
export function reviewOf(decision: unknown, requests: unknown): PullRequestRow['review'] {
  if (decision === 'APPROVED') return 'approved'
  if (decision === 'CHANGES_REQUESTED') return 'changes-requested'
  if (decision === 'REVIEW_REQUIRED') return 'review-requested'
  return Array.isArray(requests) && requests.length > 0 ? 'review-requested' : undefined
}

function authorOf(raw: unknown): PullRequestRow['author'] {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  // gh names apps app/<name>.
  const login = typeof a.login === 'string' && a.login ? a.login.replace(/^app\//, '') : 'ghost'
  const bot = a.is_bot === true || String(a.login).startsWith('app/') || undefined
  const name = typeof a.name === 'string' && a.name.trim() ? a.name.trim() : undefined
  return { login, ...(name ? { name } : {}), ...(bot ? { bot } : {}) }
}

const same = (a: string | undefined, b: string | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase())

/**
 * Rows from `gh pr list --json` output. `me` is the signed-in login, for
 * Mine; `reviewMe` the PRs whose review is asked of them or their teams.
 * Closed, unmerged PRs are left out.
 */
export function parsePullRequests(
  raw: unknown,
  ctx: { me?: string; reviewMe?: ReadonlySet<number> } = {}
): PullRequestRow[] {
  if (!Array.isArray(raw)) return []
  const rows: PullRequestRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const pr = item as Record<string, unknown>
    if (typeof pr.number !== 'number' || !Number.isInteger(pr.number)) continue
    const stateName = String(pr.state ?? 'OPEN').toUpperCase()
    if (stateName === 'CLOSED') continue
    const merged = stateName === 'MERGED'
    const author = authorOf(pr.author)
    const requests = Array.isArray(pr.reviewRequests) ? pr.reviewRequests : []
    const requestedMe = requests.some(
      (r) => r && typeof r === 'object' && same((r as { login?: string }).login, ctx.me)
    )
    const mergedAt = merged ? Date.parse(String(pr.mergedAt ?? '')) || undefined : undefined
    const comments = Array.isArray(pr.comments) ? pr.comments.length : typeof pr.comments === 'number' ? pr.comments : 0
    rows.push({
      number: pr.number,
      title: typeof pr.title === 'string' ? pr.title : `#${pr.number}`,
      url: typeof pr.url === 'string' ? pr.url : '',
      state: merged ? 'merged' : pr.isDraft === true ? 'draft' : 'open',
      headRef: typeof pr.headRefName === 'string' ? pr.headRefName : '',
      baseRef: typeof pr.baseRefName === 'string' ? pr.baseRefName : '',
      author,
      // A merged PR's checks and reviews are history.
      ...(merged ? {} : { checks: checksOf(pr.statusCheckRollup), review: reviewOf(pr.reviewDecision, requests) }),
      mine: same(author.login, ctx.me),
      needsMyReview: !merged && (requestedMe || Boolean(ctx.reviewMe?.has(pr.number))),
      comments,
      updatedAt: Date.parse(String(pr.updatedAt ?? '')) || mergedAt || 0,
      ...(mergedAt ? { mergedAt } : {})
    })
  }
  return rows
}

/** Newest first: open and draft PRs by when they last changed, merged ones by when they merged. */
export function sortPullRequests(rows: PullRequestRow[]): PullRequestRow[] {
  const at = (r: PullRequestRow) => (r.state === 'merged' ? (r.mergedAt ?? r.updatedAt) : r.updatedAt)
  return [...rows].sort((a, b) => at(b) - at(a))
}

/** Whether gh failed because it isn't signed in, from what it printed. */
export function looksLoggedOut(stderr: string): boolean {
  return /gh auth login|not logged in|authentication required|HTTP 401|bad credentials/i.test(stderr)
}

/** The first line gh printed about a failure, for the panel to show. */
function ghError(res: RunResult): string {
  const line = res.stderr
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean)
  return line || `gh exited with code ${res.code ?? 'unknown'}`
}

/** Signed-in logins by host. Only successes are kept, so signing in later is picked up. */
const viewers = new Map<string, string>()

async function viewer(host: string, cwd: string): Promise<string | undefined> {
  const known = viewers.get(host)
  if (known) return known
  const res = await run('gh', ['api', 'user', '--hostname', host, '--jq', '.login'], cwd)
  const login = res.code === 0 ? res.stdout.trim() : ''
  if (login) viewers.set(host, login)
  return login || undefined
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** The project folder's pull requests, or why there are none to show. */
export async function pullRequests(repoPath: string, now = Date.now()): Promise<PullRequestsResult> {
  const fail = (problem: PanelProblem, repo?: PullRequestsResult['repo']): PullRequestsResult => ({
    ...(repo ? { repo } : {}),
    rows: [],
    problem,
    fetchedAt: now
  })

  if (!(await gitStatus(repoPath).catch(() => null))) return fail({ kind: 'no-repo' })

  const [remotesOut, defaultsOut] = await Promise.all([
    run('git', ['remote', '-v'], repoPath),
    // `gh repo set-default` marks its pick in the repository's config.
    run('git', ['config', '--get-regexp', '^remote\\..*\\.gh-resolved$'], repoPath)
  ])
  const ghDefault = /^remote\.(.+)\.gh-resolved\s/m.exec(defaultsOut.stdout)?.[1]
  const chosen = chooseRemote(parseRemotes(remotesOut.stdout), ghHosts(), ghDefault)
  if ('problem' in chosen) return fail(chosen.problem)

  const { host, owner, name } = chosen.repo
  const repo = {
    nameWithOwner: `${owner}/${name}`,
    url: `https://${host}/${owner}/${name}`,
    host
  }
  const target = host === 'github.com' ? repo.nameWithOwner : `${host}/${repo.nameWithOwner}`
  const list = (...args: string[]) => ['pr', 'list', '-R', target, '--limit', String(LIMIT), ...args]
  const since = new Date(now - WEEK_MS).toISOString().slice(0, 10)

  const [open, merged, reviewMe, me] = await Promise.all([
    run('gh', list('--state', 'open', '--json', FIELDS, '--jq', JQ), repoPath),
    run('gh', list('--state', 'merged', '--search', `merged:>=${since}`, '--json', FIELDS, '--jq', JQ), repoPath),
    // Covers review asked of a team the user is in, which reviewRequests can't tell.
    run('gh', list('--state', 'open', '--search', 'review-requested:@me', '--json', 'number', '--jq', 'map(.number)'), repoPath),
    viewer(host, repoPath)
  ])

  if (open.missing) return fail({ kind: 'gh-missing' }, repo)
  for (const res of [open, merged]) {
    if (res.code === 0) continue
    if (looksLoggedOut(res.stderr)) return fail({ kind: 'gh-logged-out', host }, repo)
    const auth = await run('gh', ['auth', 'status', '--hostname', host], repoPath)
    return fail(auth.code === 0 ? { kind: 'error', message: ghError(res) } : { kind: 'gh-logged-out', host }, repo)
  }

  const reviewNumbers = parseJson(reviewMe.stdout)
  const ctx = {
    me,
    reviewMe: new Set(Array.isArray(reviewNumbers) ? reviewNumbers.filter((n) => typeof n === 'number') : [])
  }
  const rows = [...parsePullRequests(parseJson(open.stdout), ctx), ...parsePullRequests(parseJson(merged.stdout), ctx)]
  return { repo, rows: sortPullRequests(rows), fetchedAt: now }
}
