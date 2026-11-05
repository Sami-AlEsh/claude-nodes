// The person's own Claude Code status line, shown in sessions beside Nodus's.
//
// Claude Code takes one status line, and the one in Nodus's `--settings`
// outranks theirs: it sends each session's model, context and cost to the
// host and prints nothing. With "Show my status line" on, a session gets
// their command in NODUS_STATUS_LINE, and Nodus's status line runs it on the
// same JSON after sending it (see hooks.ts).
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { envVar, spawnEnv } from './env'

let showOwn = false

/** Follows the setting. Sessions started or resumed from now on get it. */
export function setShowOwnStatusLine(show: boolean) {
  showOwn = show
}

/**
 * The `statusLine` a settings file's text sets, if Claude Code would accept
 * it: its schema needs `type: 'command'` and a string `command`. Claude Code
 * skips one that doesn't fit with a settings error, so a lower file's applies.
 */
function statusLineIn(text: string | undefined): { command: string } | undefined {
  if (!text) return undefined
  let settings: unknown
  try {
    settings = JSON.parse(text)
  } catch {
    return undefined
  }
  const line = (settings as { statusLine?: { type?: unknown; command?: unknown } } | null)?.statusLine
  return line?.type === 'command' && typeof line.command === 'string' ? { command: line.command } : undefined
}

/**
 * The status line command from settings files' text, highest precedence
 * first. The first file with a valid `statusLine` decides, as its `command`
 * outranks the lower files' when Claude Code merges them. An empty command
 * shows nothing. A missing or unreadable file is skipped.
 */
export function resolveStatusLine(texts: (string | undefined)[]): string | undefined {
  for (const text of texts) {
    const line = statusLineIn(text)
    if (line) return line.command.trim() ? line.command : undefined
  }
  return undefined
}

/**
 * Where Claude Code reads `.claude/settings.local.json` for a session in
 * `cwd`: the root of its repository (the main checkout's, for a worktree),
 * so a session started in a subfolder or a worktree shares the file. It stays
 * in `cwd` outside a repository, when the root is the home folder (whose
 * `.claude` is the user's own) and when the root isn't the person's. All
 * paths are real paths.
 */
export function localSettingsDir(
  cwd: string,
  root: string | undefined,
  home: string,
  ownedByMe: (dir: string) => boolean
): string {
  if (!root || root === cwd || root === home || !ownedByMe(root)) return cwd
  return root
}

/**
 * The settings files that can set a session's status line, highest first:
 * the local settings, the repo's shared settings, then the user's. A local
 * file in `cwd`, when that isn't where local settings live, is Claude Code's
 * older place for it, still read under the current one. Managed settings
 * aren't read: they outrank Nodus's `--settings`, so a status line set there
 * shows by itself already.
 */
export function statusLineFiles(cwd: string, configDir: string, localDir = cwd): string[] {
  return [
    ...(localDir !== cwd ? [path.join(localDir, '.claude', 'settings.local.json')] : []),
    path.join(cwd, '.claude', 'settings.local.json'),
    path.join(cwd, '.claude', 'settings.json'),
    path.join(configDir, 'settings.json')
  ]
}

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

function realPath(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    return p
  }
}

/** The repository's root as Claude Code finds it: a worktree's is its main checkout's. */
function gitRoot(cwd: string): string | undefined {
  try {
    const [commonDir, topLevel] = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'],
      { cwd, env: spawnEnv({ GIT_TERMINAL_PROMPT: '0' }), encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
    )
      .trim()
      .split('\n')
    return realPath(path.basename(commonDir) === '.git' ? path.dirname(commonDir) : topLevel)
  } catch {
    return undefined
  }
}

/** Claude Code only reads local settings from a root that, with its `.git` and any `.claude`, is the person's. */
function ownedByMe(root: string): boolean {
  const uid = process.geteuid?.()
  try {
    if (fs.statSync(root).uid !== uid || fs.lstatSync(path.join(root, '.git')).uid !== uid) return false
    const claude = fs.lstatSync(path.join(root, '.claude'), { throwIfNoEntry: false })
    return !claude || claude.uid === uid
  } catch {
    return false
  }
}

/**
 * What a session starting in `cwd` adds to its environment: the person's own
 * status line command while the setting is on and they have one, else nothing.
 */
export function ownStatusLineEnv(cwd: string): Record<string, string> {
  if (!showOwn) return {}
  const configDir = envVar('CLAUDE_CONFIG_DIR') || path.join(os.homedir(), '.claude')
  const dir = realPath(cwd)
  const localDir = localSettingsDir(dir, gitRoot(dir), realPath(os.homedir()), ownedByMe)
  const command = resolveStatusLine(statusLineFiles(dir, configDir, localDir).map(read))
  return command ? { NODUS_STATUS_LINE: command } : {}
}
