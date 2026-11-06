import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checksOf,
  chooseRemote,
  isGithubHost,
  looksLoggedOut,
  parseGhHosts,
  parsePullRequests,
  parseRemotes,
  parseRemoteUrl,
  pullRequests,
  reviewOf,
  sortPullRequests
} from './github'

// A fake gh, first on a PATH without the real one, and gh's config in a folder
// of the test's own. Hoisted, so env.ts reads this environment when it loads.
const fake = vi.hoisted(() => {
  const fsh = require('fs') as typeof import('fs')
  const osh = require('os') as typeof import('os')
  const pathh = require('path') as typeof import('path')
  const dir = fsh.mkdtempSync(pathh.join(osh.tmpdir(), 'nodus-fake-gh-'))
  process.env.PATH = `${dir}/bin:/usr/bin:/bin`
  process.env.GH_CONFIG_DIR = pathh.join(dir, 'config')
  process.env.FAKE_GH = dir
  process.env.GIT_CONFIG_GLOBAL = '/dev/null'
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  return { dir }
})

afterAll(() => fs.rmSync(fake.dir, { recursive: true, force: true }))

const NOW = Date.parse('2026-11-06T12:00:00Z')

/** gh pr list --json output as it comes, comments already counted by --jq. */
const OPEN = [
  {
    number: 15,
    title: 'Open a list of running sessions from the title bar’s count',
    url: 'https://github.com/Sami-AlEsh/nodus/pull/15',
    state: 'OPEN',
    isDraft: false,
    author: { id: 'U1', is_bot: false, login: 'Sami-AlEsh', name: 'Sami AlEsh' },
    headRefName: 'running-sessions-panel',
    baseRefName: 'main',
    updatedAt: '2026-11-05T12:00:00Z',
    mergedAt: null,
    reviewDecision: 'CHANGES_REQUESTED',
    reviewRequests: [],
    statusCheckRollup: [
      { __typename: 'CheckRun', name: 'check', workflowName: 'CI', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2026-11-05T10:00:00Z', completedAt: '2026-11-05T10:05:00Z' },
      { __typename: 'CheckRun', name: 'lint', workflowName: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS', startedAt: '2026-11-05T10:00:00Z', completedAt: '2026-11-05T10:01:00Z' },
      { __typename: 'StatusContext', context: 'pages', state: 'SUCCESS' }
    ],
    comments: 4
  },
  {
    number: 16,
    title: 'Build and release Nodus for Windows',
    url: 'https://github.com/Sami-AlEsh/nodus/pull/16',
    state: 'OPEN',
    isDraft: true,
    author: { id: 'B1', is_bot: true, login: 'app/dependabot', name: '' },
    headRefName: 'windows-build',
    baseRefName: 'main',
    updatedAt: '2026-11-03T12:00:00Z',
    reviewDecision: '',
    reviewRequests: [{ __typename: 'User', login: 'sami-alesh' }],
    statusCheckRollup: [],
    comments: 0
  }
]

const MERGED = [
  {
    number: 12,
    title: 'Ship JetBrains Mono as the terminal font',
    url: 'https://github.com/Sami-AlEsh/nodus/pull/12',
    state: 'MERGED',
    isDraft: false,
    author: { login: 'Sami-AlEsh', name: 'Sami AlEsh', is_bot: false },
    headRefName: 'terminal-font',
    baseRefName: 'main',
    updatedAt: '2026-11-05T21:13:47Z',
    mergedAt: '2026-11-05T21:13:47Z',
    reviewDecision: '',
    reviewRequests: [],
    statusCheckRollup: [{ __typename: 'CheckRun', name: 'check', status: 'COMPLETED', conclusion: 'CANCELLED' }],
    comments: [{ body: 'Thanks' }, { body: 'Merged' }]
  },
  { number: 9, title: 'Closed without merging', state: 'CLOSED', author: { login: 'x' } }
]

describe('parseRemoteUrl', () => {
  it('reads every form of remote git takes', () => {
    const repo = { host: 'github.com', owner: 'Sami-AlEsh', name: 'nodus' }
    expect(parseRemoteUrl('git@github.com:Sami-AlEsh/nodus.git')).toEqual(repo)
    expect(parseRemoteUrl('https://github.com/Sami-AlEsh/nodus')).toEqual(repo)
    expect(parseRemoteUrl('https://token@github.com/Sami-AlEsh/nodus.git/')).toEqual(repo)
    expect(parseRemoteUrl('ssh://git@ssh.github.com:443/Sami-AlEsh/nodus.git')).toEqual(repo)
    expect(parseRemoteUrl('git@GHE.example.com:team/app.git')).toEqual({ host: 'ghe.example.com', owner: 'team', name: 'app' })
  })

  it('gives null for a local path or a URL with no repository in it', () => {
    expect(parseRemoteUrl('/Users/sami/repos/nodus')).toBeNull()
    expect(parseRemoteUrl('../nodus.git')).toBeNull()
    expect(parseRemoteUrl('https://github.com/')).toBeNull()
  })
})

describe('chooseRemote', () => {
  const fork = { name: 'origin', url: 'git@github.com:Sami-AlEsh/nodus.git' }
  const upstream = { name: 'upstream', url: 'https://github.com/saleem-hadad/nodus.git' }

  it('follows origin, even when there is an upstream', () => {
    expect(chooseRemote([upstream, fork], [])).toEqual({
      repo: { remote: 'origin', host: 'github.com', owner: 'Sami-AlEsh', name: 'nodus' }
    })
  })

  it('follows the remote gh repo set-default picked', () => {
    expect(chooseRemote([upstream, fork], [], 'upstream')).toMatchObject({ repo: { owner: 'saleem-hadad' } })
  })

  it('takes the first GitHub remote when origin is elsewhere', () => {
    const gitlab = { name: 'origin', url: 'git@gitlab.com:team/app.git' }
    expect(chooseRemote([gitlab, upstream], [])).toMatchObject({ repo: { remote: 'upstream' } })
  })

  it('knows Enterprise hosts gh is signed in to', () => {
    const ghe = { name: 'origin', url: 'git@ghe.example.com:team/app.git' }
    expect(chooseRemote([ghe], [])).toEqual({
      problem: { kind: 'no-github-remote', remote: { name: 'origin', host: 'ghe.example.com' } }
    })
    expect(chooseRemote([ghe], ['ghe.example.com'])).toMatchObject({ repo: { host: 'ghe.example.com' } })
    expect(isGithubHost('acme.ghe.com', [])).toBe(true)
  })

  it('says where a GitLab or Bitbucket remote points, or that there is none', () => {
    expect(chooseRemote([{ name: 'origin', url: 'git@bitbucket.org:team/app.git' }], [])).toEqual({
      problem: { kind: 'no-github-remote', remote: { name: 'origin', host: 'bitbucket.org' } }
    })
    expect(chooseRemote([], [])).toEqual({ problem: { kind: 'no-github-remote' } })
  })
})

describe('git and gh output', () => {
  it('lists each remote once from git remote -v', () => {
    const out = 'origin\tgit@github.com:a/b.git (fetch)\norigin\tgit@github.com:a/b.git (push)\nupstream\thttps://github.com/c/b.git (fetch)\n'
    expect(parseRemotes(out)).toEqual([
      { name: 'origin', url: 'git@github.com:a/b.git' },
      { name: 'upstream', url: 'https://github.com/c/b.git' }
    ])
  })

  it('reads the hosts gh is signed in to from its hosts.yml', () => {
    const yaml = 'github.com:\n    git_protocol: ssh\n    users:\n        Sami-AlEsh:\n    user: Sami-AlEsh\nGHE.example.com:\n    user: sami\n'
    expect(parseGhHosts(yaml)).toEqual(['github.com', 'ghe.example.com'])
  })

  it('tells a signed-out gh from other failures', () => {
    expect(looksLoggedOut('To get started with GitHub CLI, please run:  gh auth login')).toBe(true)
    expect(looksLoggedOut('HTTP 401: Bad credentials (https://api.github.com/graphql)')).toBe(true)
    expect(looksLoggedOut('GraphQL: Could not resolve to a Repository with the name x/y.')).toBe(false)
  })
})

describe('checksOf', () => {
  it('counts the latest run of each check', () => {
    const rerun = [
      { __typename: 'CheckRun', name: 'check', workflowName: 'CI', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: '2026-11-05T10:00:00Z' },
      { __typename: 'CheckRun', name: 'check', workflowName: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: '2026-11-05T11:00:00Z' }
    ]
    expect(checksOf(rerun)).toEqual({ total: 1, passed: 1, failed: 0, pending: 0 })
  })

  it('reads check runs and status contexts, counting skipped as passed and cancelled as failed', () => {
    const rollup = [
      { __typename: 'CheckRun', name: 'a', status: 'COMPLETED', conclusion: 'SKIPPED' },
      { __typename: 'CheckRun', name: 'b', status: 'IN_PROGRESS', conclusion: '' },
      { __typename: 'CheckRun', name: 'c', status: 'COMPLETED', conclusion: 'CANCELLED' },
      { __typename: 'StatusContext', context: 'ci/x', state: 'PENDING' },
      { __typename: 'StatusContext', context: 'ci/y', state: 'ERROR' }
    ]
    expect(checksOf(rollup)).toEqual({ total: 5, passed: 1, failed: 2, pending: 2 })
  })

  it('is undefined for a PR with no checks', () => {
    expect(checksOf([])).toBeUndefined()
    expect(checksOf(null)).toBeUndefined()
  })
})

describe('reviewOf', () => {
  it('reads the review decision, and asks for review when one is requested without branch protection', () => {
    expect(reviewOf('APPROVED', [])).toBe('approved')
    expect(reviewOf('CHANGES_REQUESTED', [])).toBe('changes-requested')
    expect(reviewOf('REVIEW_REQUIRED', [])).toBe('review-requested')
    expect(reviewOf('', [{ login: 'a' }])).toBe('review-requested')
    expect(reviewOf('', [])).toBeUndefined()
  })
})

describe('parsePullRequests', () => {
  const rows = parsePullRequests([...OPEN, ...MERGED], { me: 'Sami-AlEsh', reviewMe: new Set([15]) })

  it('makes a row of each open, draft and merged PR, leaving closed ones out', () => {
    expect(rows.map((r) => [r.number, r.state])).toEqual([
      [15, 'open'],
      [16, 'draft'],
      [12, 'merged']
    ])
  })

  it('works out checks, review state, mine and comments', () => {
    expect(rows[0]).toMatchObject({
      checks: { total: 3, passed: 2, failed: 1, pending: 0 },
      review: 'changes-requested',
      mine: true,
      needsMyReview: true,
      comments: 4,
      headRef: 'running-sessions-panel',
      baseRef: 'main',
      updatedAt: Date.parse('2026-11-05T12:00:00Z')
    })
  })

  it('names a bot by its app, and counts a review asked of me by login', () => {
    expect(rows[1].author).toEqual({ login: 'dependabot', bot: true })
    expect(rows[1]).toMatchObject({ mine: false, needsMyReview: true, review: 'review-requested', checks: undefined })
  })

  it('leaves a merged PR’s checks and reviews out, and counts comments sent whole', () => {
    expect(rows[2]).toMatchObject({ mergedAt: Date.parse('2026-11-05T21:13:47Z'), comments: 2, needsMyReview: false })
    expect(rows[2].checks).toBeUndefined()
    expect(rows[2].review).toBeUndefined()
  })

  it('skips what isn’t a PR', () => {
    expect(parsePullRequests(null)).toEqual([])
    expect(parsePullRequests([null, { title: 'no number' }])).toEqual([])
  })

  it('sorts newest first, merged PRs by when they merged', () => {
    expect(sortPullRequests(rows).map((r) => r.number)).toEqual([12, 15, 16])
  })
})

describe('pullRequests', () => {
  let repo: string
  const bin = path.join(fake.dir, 'bin')
  const flag = (name: string, on: boolean) => {
    const file = path.join(fake.dir, name)
    if (on) fs.writeFileSync(file, '')
    else fs.rmSync(file, { force: true })
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  const installGh = () => {
    fs.mkdirSync(bin, { recursive: true })
    fs.writeFileSync(path.join(fake.dir, 'open.json'), JSON.stringify(OPEN))
    fs.writeFileSync(path.join(fake.dir, 'merged.json'), JSON.stringify(MERGED))
    fs.writeFileSync(
      path.join(bin, 'gh'),
      `#!/bin/sh
echo "$*" >> "$FAKE_GH/calls"
signed_in() { [ -f "$FAKE_GH/logged-in" ]; }
case "$*" in
  "auth status"*) signed_in && exit 0; echo "You are not logged into any GitHub hosts." >&2; exit 1 ;;
  "api user"*) signed_in && echo "Sami-AlEsh" && exit 0; exit 1 ;;
esac
if ! signed_in; then echo "To get started with GitHub CLI, please run:  gh auth login" >&2; exit 4; fi
[ -f "$FAKE_GH/broken" ] && { echo "GraphQL: Could not resolve to a Repository with the name 'Sami-AlEsh/nodus'." >&2; exit 1; }
case "$*" in
  *review-requested*) echo "[16]" ;;
  *"--state merged"*) cat "$FAKE_GH/merged.json" ;;
  *"--state open"*) cat "$FAKE_GH/open.json" ;;
esac
`,
      { mode: 0o755 }
    )
  }

  beforeEach(() => {
    repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nodus-panel-repo-')))
    fs.rmSync(path.join(fake.dir, 'calls'), { force: true })
    flag('logged-in', true)
    flag('broken', false)
    installGh()
  })

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true })
  })

  it('says a folder without a repository has none', async () => {
    expect((await pullRequests(repo, NOW)).problem).toEqual({ kind: 'no-repo' })
  })

  it('says a repository without a GitHub remote has none, and where its remote points', async () => {
    git('init', '-q')
    expect((await pullRequests(repo, NOW)).problem).toEqual({ kind: 'no-github-remote' })
    git('remote', 'add', 'origin', 'git@gitlab.com:team/app.git')
    expect((await pullRequests(repo, NOW)).problem).toEqual({
      kind: 'no-github-remote',
      remote: { name: 'origin', host: 'gitlab.com' }
    })
  })

  it('says when gh isn’t installed', async () => {
    git('init', '-q')
    git('remote', 'add', 'origin', 'git@github.com:Sami-AlEsh/nodus.git')
    fs.rmSync(path.join(bin, 'gh'))
    const result = await pullRequests(repo, NOW)
    expect(result.problem).toEqual({ kind: 'gh-missing' })
    expect(result.repo?.nameWithOwner).toBe('Sami-AlEsh/nodus')
  })

  it('says when gh isn’t signed in', async () => {
    git('init', '-q')
    git('remote', 'add', 'origin', 'git@github.com:Sami-AlEsh/nodus.git')
    flag('logged-in', false)
    expect((await pullRequests(repo, NOW)).problem).toEqual({ kind: 'gh-logged-out', host: 'github.com' })
  })

  it('passes on what gh said when it failed for another reason', async () => {
    git('init', '-q')
    git('remote', 'add', 'origin', 'git@github.com:Sami-AlEsh/nodus.git')
    flag('broken', true)
    expect((await pullRequests(repo, NOW)).problem).toEqual({
      kind: 'error',
      message: "GraphQL: Could not resolve to a Repository with the name 'Sami-AlEsh/nodus'."
    })
  })

  it('lists the repository’s open PRs and the week’s merged ones, from origin', async () => {
    git('init', '-q')
    git('remote', 'add', 'upstream', 'https://github.com/saleem-hadad/nodus.git')
    git('remote', 'add', 'origin', 'git@github.com:Sami-AlEsh/nodus.git')
    const result = await pullRequests(repo, NOW)
    expect(result.problem).toBeUndefined()
    expect(result.repo).toEqual({ nameWithOwner: 'Sami-AlEsh/nodus', url: 'https://github.com/Sami-AlEsh/nodus', host: 'github.com' })
    expect(result.rows.map((r) => r.number)).toEqual([12, 15, 16])
    expect(result.rows.find((r) => r.number === 16)?.needsMyReview).toBe(true)
    const calls = fs.readFileSync(path.join(fake.dir, 'calls'), 'utf8')
    expect(calls).toContain('pr list -R Sami-AlEsh/nodus --limit 50 --state open')
    expect(calls).toContain('--state merged --search merged:>=2026-10-30')
  })
})
