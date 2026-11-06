import { useEffect, type MouseEvent } from 'react'
import clsx from 'clsx'
import { ChevronLeft, LayoutDashboard, Plus, SquareTerminal, X } from 'lucide-react'
import { ActionIcon } from '@renderer/components/actions/ActionIcon'
import { newSession } from '@renderer/components/board/boardCommands'
import * as registry from '@renderer/terminal/registry'
import { statusLabel } from '@renderer/terminal/SessionPane'
import { cardTitle, isTerminal, useApp, useCard } from '@renderer/store'

export const tabId = (sessionId: string) => `ws-tab-${sessionId}`
export const PANE_ID = 'ws-pane'

// Pressing a tab or its × leaves the keyboard where it was, in the terminal.
const keepFocus = (e: MouseEvent) => e.preventDefault()

/**
 * The sessions opened in the workspace, a tab each, and a + for a new one.
 * Each tab has its session's status dot (a shell's icon), its title and a ×.
 * With the project panel hidden, `onShowPanel` puts its arrow at the strip's
 * right end, where the panel's header has the › that hides it.
 */
export function SessionTabs({ onShowPanel }: { onShowPanel?: () => void }) {
  const workspace = useApp((s) => s.workspace)

  // The tab showing stays in view as tabs open and switch.
  useEffect(() => {
    if (workspace.active) document.getElementById(tabId(workspace.active))?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [workspace.active])

  return (
    <div className="ws-tabs">
      <div className="ws-tablist" role="tablist" aria-label="Open sessions">
        {workspace.tabs.map((id) => (
          <SessionTab key={id} sessionId={id} active={id === workspace.active} />
        ))}
      </div>
      <button className="ws-tab-new" onMouseDown={keepFocus} onClick={newSession} title="New session (⌘N)" aria-label="New session">
        <Plus size={15} strokeWidth={2} />
      </button>
      {onShowPanel && (
        <button
          className="btn btn-icon ws-show-panel"
          onMouseDown={keepFocus}
          onClick={onShowPanel}
          aria-expanded={false}
          aria-label="Show the project panel"
          title="Show the project panel"
        >
          <ChevronLeft size={15} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

function SessionTab({ sessionId, active }: { sessionId: string; active: boolean }) {
  const card = useCard(sessionId)
  const activateTab = useApp((s) => s.activateTab)
  const closeTab = useApp((s) => s.closeTab)
  // A run shows its action's icon, as its button in the actions rail does.
  const runIcon = useApp((s) =>
    card?.runOf ? [...(s.board?.project.actions ?? []), ...s.globalActions].find((a) => a.id === card.runOf)?.icon : undefined
  )
  const shell = isTerminal(card)
  const title = cardTitle(card)
  const status = statusLabel(card)

  const show = () => {
    activateTab(sessionId)
    // Switching focuses the new tab's terminal as it attaches; this one is already there.
    if (active) registry.focus(sessionId)
  }

  // The tab is a button, straight in the tablist. Its × is part of it, hidden from assistive
  // tech (which closes a tab with ⌘W); a click on the × closes the tab without showing it.
  return (
    <button
      role="tab"
      id={tabId(sessionId)}
      className={clsx('ws-tab', active && 'is-active')}
      aria-selected={active}
      aria-controls={PANE_ID}
      tabIndex={active ? 0 : -1}
      title={status ? `${title} · ${status}` : title}
      onMouseDown={keepFocus}
      onClick={show}
      // A middle click closes a tab, as in a browser.
      onAuxClick={(e) => {
        if (e.button !== 1) return
        e.preventDefault()
        closeTab(sessionId)
      }}
    >
      {shell ? (
        <SquareTerminal size={13} strokeWidth={2} className="term-shell-icon" data-live={card?.live} />
      ) : (
        <span className="status-dot" data-status={card?.status ?? 'done'} data-stopped={!card?.live} />
      )}
      {card?.viewOf && <LayoutDashboard size={12} strokeWidth={2} className="ws-tab-kind" aria-label="View’s brain" />}
      {card?.runOf && (
        <span className="ws-tab-kind" aria-label="Action run">
          <ActionIcon name={runIcon ?? ''} size={12} />
        </span>
      )}
      <span className="ws-tab-title">{title}</span>
      <span
        className="ws-tab-close"
        aria-hidden="true"
        title={shell ? 'Close the tab (⌘W). The shell keeps running.' : 'Close the tab (⌘W). The session keeps running.'}
        onClick={(e) => {
          e.stopPropagation()
          closeTab(sessionId)
        }}
      >
        <X size={12} strokeWidth={2.2} />
      </span>
    </button>
  )
}
