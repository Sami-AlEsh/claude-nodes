// The person's own Claude Code status line, shown in sessions beside Nodus's.
//
// Claude Code takes one status line, and the one in Nodus's `--settings`
// outranks theirs: it sends each session's model, context and cost to the
// host and prints nothing. With "Show my status line" on, a session gets
// their command in NODUS_STATUS_LINE, and Nodus's status line runs it on the
// same JSON after sending it (see hooks.ts).
import fs from 'fs'
import os from 'os'
import path from 'path'
import { envVar } from './env'

let showOwn = false

/** Follows the setting. Sessions started or resumed from now on get it. */
export function setShowOwnStatusLine(show: boolean) {
  showOwn = show
}

/**
 * The status line command from settings files' text, highest precedence
 * first: the first file that sets `statusLine` decides, as Claude Code merges
 * them, and only a `command` one can be run. A missing or unreadable file is
 * skipped.
 */
export function resolveStatusLine(texts: (string | undefined)[]): string | undefined {
  for (const text of texts) {
    if (!text) continue
    let settings: unknown
    try {
      settings = JSON.parse(text)
    } catch {
      continue
    }
    if (!settings || typeof settings !== 'object' || !('statusLine' in settings)) continue
    const line = (settings as { statusLine?: { type?: unknown; command?: unknown } }).statusLine
    return line?.type === 'command' && typeof line.command === 'string' && line.command.trim()
      ? line.command
      : undefined
  }
  return undefined
}

/**
 * The settings files that can set a session's status line, highest first: the
 * repo's local and shared settings, then the user's. Managed settings aren't
 * read: they outrank Nodus's `--settings`, so a status line set there shows
 * by itself already.
 */
export function statusLineFiles(cwd: string, configDir: string): string[] {
  return [
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

/**
 * What a session starting in `cwd` adds to its environment: the person's own
 * status line command while the setting is on and they have one, else nothing.
 */
export function ownStatusLineEnv(cwd: string): Record<string, string> {
  if (!showOwn) return {}
  const configDir = envVar('CLAUDE_CONFIG_DIR') || path.join(os.homedir(), '.claude')
  const command = resolveStatusLine(statusLineFiles(cwd, configDir).map(read))
  return command ? { NODUS_STATUS_LINE: command } : {}
}
