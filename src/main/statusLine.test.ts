import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ownStatusLineEnv, resolveStatusLine, setShowOwnStatusLine, statusLineFiles } from './statusLine'

let configDir = ''
vi.mock('./env', () => ({ envVar: (name: string) => (name === 'CLAUDE_CONFIG_DIR' ? configDir : undefined) }))

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

  it('stops at a status line it can’t run, as Claude Code would show none', () => {
    expect(resolveStatusLine([line('x', 'static'), line('user.sh')])).toBeUndefined()
    expect(resolveStatusLine([line('  '), line('user.sh')])).toBeUndefined()
    expect(resolveStatusLine([line(42), line('user.sh')])).toBeUndefined()
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

  it('adds nothing when the person has no status line', () => {
    setShowOwnStatusLine(true)
    fs.writeFileSync(path.join(configDir, 'settings.json'), '{}')
    expect(ownStatusLineEnv(repo)).toEqual({})
  })
})
