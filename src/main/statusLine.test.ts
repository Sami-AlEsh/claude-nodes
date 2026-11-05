import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localSettingsDir, ownStatusLineEnv, resolveStatusLine, setShowOwnStatusLine, statusLineFiles } from './statusLine'

let configDir = ''
vi.mock('./env', () => ({
  envVar: (name: string) => (name === 'CLAUDE_CONFIG_DIR' ? configDir : undefined),
  spawnEnv: (extra: Record<string, string> = {}) => ({ ...process.env, ...extra })
}))

const line = (command: unknown, type = 'command') => JSON.stringify({ statusLine: { type, command } })

describe('resolveStatusLine', () => {
  it('takes the first file that sets a status line', () => {
    expect(resolveStatusLine([undefined, line('repo.sh'), line('user.sh')])).toBe('repo.sh')
    expect(resolveStatusLine([undefined, undefined, line('user.sh')])).toBe('user.sh')
  })

  it('skips files that set other things, are missing or aren’t JSON', () => {
    expect(resolveStatusLine([JSON.stringify({ model: 'opus' }), '{ not json', undefined, line('user.sh')])).toBe(
      'user.sh'
    )
  })

  it('skips a status line Claude Code would reject, so a lower one applies', () => {
    expect(resolveStatusLine([line('x', 'static'), line('user.sh')])).toBe('user.sh')
    expect(resolveStatusLine([line(42), line('user.sh')])).toBe('user.sh')
    expect(resolveStatusLine([JSON.stringify({ statusLine: { padding: 2 } }), line('user.sh')])).toBe('user.sh')
    expect(resolveStatusLine([JSON.stringify({ statusLine: null }), line('user.sh')])).toBe('user.sh')
  })

  it('stops at an empty command, which shows nothing', () => {
    expect(resolveStatusLine([line('  '), line('user.sh')])).toBeUndefined()
  })

  it('finds none when nothing sets one', () => {
    expect(resolveStatusLine([undefined, '{}'])).toBeUndefined()
  })
})

describe('statusLineFiles', () => {
  it('lists the repo’s local, then shared, then the user’s settings', () => {
    expect(statusLineFiles('/repo', '/home/.claude')).toEqual([
      '/repo/.claude/settings.local.json',
      '/repo/.claude/settings.json',
      '/home/.claude/settings.json'
    ])
  })

  it('puts the root’s local settings over the older ones in the session’s folder', () => {
    expect(statusLineFiles('/repo/app', '/home/.claude', '/repo')).toEqual([
      '/repo/.claude/settings.local.json',
      '/repo/app/.claude/settings.local.json',
      '/repo/app/.claude/settings.json',
      '/home/.claude/settings.json'
    ])
  })
})

describe('localSettingsDir', () => {
  const mine = () => true

  it('uses the repository’s root', () => {
    expect(localSettingsDir('/repo/app', '/repo', '/home', mine)).toBe('/repo')
    expect(localSettingsDir('/repo', '/repo', '/home', mine)).toBe('/repo')
  })

  it('stays in the session’s folder outside a repository, at a home-folder root, or a root that isn’t theirs', () => {
    expect(localSettingsDir('/tmp/x', undefined, '/home', mine)).toBe('/tmp/x')
    expect(localSettingsDir('/home/notes', '/home', '/home', mine)).toBe('/home/notes')
    expect(localSettingsDir('/repo/app', '/repo', '/home', () => false)).toBe('/repo/app')
  })
})

describe('ownStatusLineEnv', () => {
  let repo = ''

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'nodus-repo-'))
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodus-claude-'))
    fs.writeFileSync(path.join(configDir, 'settings.json'), line('sh ~/.claude/statusline.sh'))
  })

  afterEach(() => {
    setShowOwnStatusLine(false)
    fs.rmSync(repo, { recursive: true, force: true })
    fs.rmSync(configDir, { recursive: true, force: true })
  })

  it('adds nothing while the setting is off', () => {
    expect(ownStatusLineEnv(repo)).toEqual({})
  })

  it('passes on the person’s status line while it’s on', () => {
    setShowOwnStatusLine(true)
    expect(ownStatusLineEnv(repo)).toEqual({ NODUS_STATUS_LINE: 'sh ~/.claude/statusline.sh' })
  })

  it('prefers the repo’s own status line', () => {
    setShowOwnStatusLine(true)
    fs.mkdirSync(path.join(repo, '.claude'))
    fs.writeFileSync(path.join(repo, '.claude', 'settings.json'), line('./repo-line.sh'))
    expect(ownStatusLineEnv(repo)).toEqual({ NODUS_STATUS_LINE: './repo-line.sh' })
  })

  describe('in a git repository', () => {
    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'ignore' })
    const local = (dir: string, command: string) => {
      fs.mkdirSync(path.join(dir, '.claude'), { recursive: true })
      fs.writeFileSync(path.join(dir, '.claude', 'settings.local.json'), line(command))
    }

    beforeEach(() => {
      setShowOwnStatusLine(true)
      git(repo, 'init', '-q')
      git(repo, 'commit', '-q', '--allow-empty', '-m', 'init')
      fs.mkdirSync(path.join(repo, 'app'))
    })

    it('reads local settings from the root for a session in a subfolder', () => {
      local(repo, './root-line.sh')
      expect(ownStatusLineEnv(path.join(repo, 'app'))).toEqual({ NODUS_STATUS_LINE: './root-line.sh' })
    })

    it('lets the root’s local settings outrank the older ones in the subfolder', () => {
      local(path.join(repo, 'app'), './app-line.sh')
      expect(ownStatusLineEnv(path.join(repo, 'app'))).toEqual({ NODUS_STATUS_LINE: './app-line.sh' })
      local(repo, './root-line.sh')
      expect(ownStatusLineEnv(path.join(repo, 'app'))).toEqual({ NODUS_STATUS_LINE: './root-line.sh' })
    })

    it('reads local settings from the main checkout for a worktree', () => {
      local(repo, './main-line.sh')
      const worktree = path.join(repo, 'wt')
      git(repo, 'worktree', 'add', '-q', worktree)
      expect(ownStatusLineEnv(worktree)).toEqual({ NODUS_STATUS_LINE: './main-line.sh' })
    })
  })

  it('adds nothing when the person has no status line', () => {
    setShowOwnStatusLine(true)
    fs.writeFileSync(path.join(configDir, 'settings.json'), '{}')
    expect(ownStatusLineEnv(repo)).toEqual({})
  })
})
