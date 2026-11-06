import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Check,
  Folder,
  GitBranch,
  LoaderCircle,
  Minimize2,
  Play,
  RotateCcw,
  Square,
  SquareTerminal,
  Trash2
} from 'lucide-react'
import { UsageStats } from '@renderer/components/UsageStats'
import { ConfirmDialog, type ConfirmRequest } from '@renderer/components/board/ConfirmDialog'
import { stopConfirmation, stopSessions, stoppable } from '@renderer/components/board/stopSessions'
import { SessionMic } from '@renderer/components/voice/SessionMic'
import { cardTitle, isTerminal, takeOpened, tildePath, useApp, useCard, wasOpened } from '@renderer/store'
import type { SessionCard } from '@shared/types'
import * as registry from './registry'
import { useAttachedTerminal } from './useAttachedTerminal'
import './terminal.css'

/**
 * The workspace's middle column: a session's terminal under a slim header.
 * Mounted per tab (keyed by session), so switching tabs parks one terminal
 * and attaches the next, which the registry keeps as they were. Opening a
 * session (its card, Enter, a notification) starts it if it isn't running;
 * switching to its tab shows it as it is, and a stopped one waits for Resume.
 */
export function SessionPane({ sessionId, projectId }: { sessionId: string; projectId: string }) {
  const card = useCard(sessionId)
  const kind = card?.kind ?? 'claude'
  const shell = kind === 'terminal'
  const live = Boolean(card?.live)
  // Asked to run: opened just now, or Resume pressed since.
  const [asked, setAsked] = useState(() => wasOpened(sessionId))
  // A terminal already in this window shows its last screen; with none, there's nothing to show until it runs.
  const [hadTerminal] = useState(() => registry.has(sessionId))
  const shows = live || asked || hadTerminal
  const { containerRef, phase, error, reattach } = useAttachedTerminal(sessionId, projectId, kind, {
    enabled: shows,
    resume: live || asked
  })
  // Label the loading state by how the pane was opened, so it doesn't flip
  // mid-load when the status event marks the session live.
  const startedLive = useRef(live)

  const resume = () => {
    startedLive.current = false
    setAsked(true)
    reattach()
  }

  // Opened again while it shows (its card clicked, say), a session that isn't running starts.
  const opens = useApp((s) => s.opens)
  const opensAtMount = useRef(opens)
  const resumeRef = useRef(resume)
  resumeRef.current = resume
  useEffect(() => {
    // The open that mounted the pane is in `asked` already.
    if (opens === opensAtMount.current) return void takeOpened(sessionId)
    if (!takeOpened(sessionId)) return
    const now = useApp.getState().board?.cards.find((c) => c.sessionId === sessionId)
    if (!now?.live && registry.needsOpen(sessionId)) resumeRef.current()
  }, [opens, sessionId])

  return (
    <>
      <PaneHeader
        card={card}
        sessionId={sessionId}
        projectId={projectId}
        canResume={!live && (!shows || phase !== 'loading')}
        onResume={resume}
      />
      <div className="term-body" onPointerDown={() => shows && registry.focus(sessionId)}>
        <div ref={containerRef} className="term-container" />
        {!shows && (
          <div className="term-overlay is-blocking">
            <button className="btn" onClick={resume}>
              {shell ? <SquareTerminal size={13} /> : <Play size={13} />}
              {shell ? 'Start shell' : 'Resume session'}
            </button>
          </div>
        )}
        {shows && phase === 'loading' && (
          <div className="term-overlay" aria-live="polite">
            <div className="term-overlay-pill">
              <LoaderCircle className="term-spin" size={14} />
              {shell ? 'Starting shell…' : startedLive.current ? 'Starting Claude…' : 'Resuming session…'}
            </div>
          </div>
        )}
        {shows && phase === 'error' && (
          <div className="term-overlay is-blocking">
            <div className="term-error">
              <div className="term-error-title">
                {shell ? 'Couldn’t start the shell' : 'Couldn’t start Claude'}
              </div>
              {error && <div className="term-error-detail selectable">{error}</div>}
              <button className="btn btn-primary" onClick={resume}>
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/** What a tab's dot or icon stands for, in words. */
export function statusLabel(card: SessionCard | undefined): string {
  if (!card) return ''
  if (isTerminal(card)) return card.live ? 'Running' : 'Exited'
  if (card.status === 'working') return 'Working'
  if (card.status === 'waiting') return 'Needs you'
  return card.live ? 'Idle' : 'Not running'
}

/**
 * The pane's header: the session's branch, id and usage on the left (the tab
 * above has its title and status), and what can be done to it on the right.
 */
function PaneHeader({
  card,
  sessionId,
  projectId,
  canResume,
  onResume
}: {
  card: SessionCard | undefined
  sessionId: string
  projectId: string
  canResume: boolean
  onResume: () => void
}) {
  const patchCards = useApp((s) => s.patchCards)
  const removeCard = useApp((s) => s.removeCard)
  const leaveWorkspace = useApp((s) => s.leaveWorkspace)
  const repoPath = useApp((s) => s.board?.project.repoPath)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const shell = isTerminal(card)
  const branch = card?.meta?.gitBranch
  const canStop = stoppable(card ? [card] : []).length > 0

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  // While the Stop confirmation is up, ⌘W (and the workspace's tab keys) are its, not the tab's.
  useEffect(() => {
    if (!confirm) return
    const cancel = () => confirm.resolve(false)
    useApp.setState({ cancelPaneDialog: cancel })
    return () => {
      if (useApp.getState().cancelPaneDialog === cancel) useApp.setState({ cancelPaneDialog: null })
    }
  }, [confirm])

  const copyId = () => {
    navigator.clipboard.writeText(sessionId).then(() => setCopied(true), () => {})
  }

  // Its tab goes with it: the next tab shows, or the board after the last.
  const archive = () => patchCards([{ sessionId, archived: true }])

  // The pane stays on the stopped session, with Resume in Stop's place.
  const stop = () => {
    if (!card) return
    const ask = stopConfirmation([card], cardTitle)
    if (!ask) return void stopSessions([card])
    setConfirm({
      ...ask,
      resolve: (ok) => {
        setConfirm(null)
        if (ok) void stopSessions([card])
      }
    })
  }

  // Terminals have nothing to archive: removing one stops its shell, and closes its tab.
  const remove = () => removeCard(sessionId)

  // What's said waits at the prompt, for Return; a session that isn't running resumes to take it.
  const typeIn = (text: string) => {
    registry.typeIn(sessionId, text, { starting: !card?.live })
    if (canResume) onResume()
    registry.focus(sessionId)
  }

  return (
    <header className="term-header">
      <div className="term-meta">
        {shell && repoPath && (
          <span className="term-cwd selectable" title={repoPath}>
            <Folder size={12} />
            <span className="term-cwd-path">{tildePath(repoPath)}</span>
          </span>
        )}
        {branch && (
          <span className="term-branch" title={`On ${branch}`}>
            <GitBranch size={12} />
            {branch}
          </span>
        )}
        {!shell && (
          <button className="term-id" onClick={copyId} title="Copy session ID" aria-label="Copy session ID">
            {copied ? (
              <>
                <Check size={11} /> Copied
              </>
            ) : (
              sessionId.slice(0, 8)
            )}
          </button>
        )}
        {!shell && card && <UsageStats usage={card.usage} live={card.live} />}
      </div>

      <div className="term-actions">
        {!shell && <SessionMic variant="window" projectId={projectId} onText={typeIn} />}
        {canResume &&
          (shell ? (
            <button className="btn" onClick={onResume} title="Start a new shell in the project folder">
              <RotateCcw size={13} />
              Restart
            </button>
          ) : (
            <button className="btn" onClick={onResume}>
              <Play size={13} />
              Resume
            </button>
          ))}
        {canStop && (
          <button className="btn" onClick={stop} title="Stop the session. The card stays, and Resume picks it up.">
            <Square size={12} strokeWidth={2.4} />
            Stop
          </button>
        )}
        {shell ? (
          <button className="btn" onClick={remove} title="Stop the shell and remove this terminal from the board">
            <Trash2 size={13} />
            Remove
          </button>
        ) : card?.viewOf ? null : (
          // A view's brain goes with its view, never to the archive.
          <button className="btn" onClick={archive} title="Stop and move to the archive">
            <Archive size={13} />
            Archive
          </button>
        )}
        <span className="term-divider" />
        <button
          className="btn btn-ghost btn-icon"
          onClick={leaveWorkspace}
          title="Back to the board. The tabs stay, and the session keeps running."
          aria-label="Back to the board"
        >
          <Minimize2 size={15} />
        </button>
      </div>
      <ConfirmDialog request={confirm} />
    </header>
  )
}
