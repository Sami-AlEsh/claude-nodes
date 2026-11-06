import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject
} from 'react'
import clsx from 'clsx'
import { Globe, MoreHorizontal, Pencil, Play, Plus, Zap } from 'lucide-react'
import type { ProjectAction, SessionCard } from '@shared/types'
import { ContextMenu } from '@renderer/components/ContextMenu'
import { ConfirmDialog, type ConfirmRequest } from '@renderer/components/board/ConfirmDialog'
import { useNow } from '@renderer/components/board/AgentDeck'
import { truncate } from '@renderer/components/board/layout'
import { formatDuration, useApp } from '@renderer/store'
import { ActionDialog } from './ActionDialog'
import { ActionIcon } from './ActionIcon'
import { buttonStatus, menuRows, runsByAction, runState, stepIndex } from './menu'
import './actions.css'

const runLabel = { working: 'Working', waiting: 'Needs you' } as const

interface RowMenu {
  x: number
  y: number
  action: ProjectAction
  /** The row's ⋯ when it opened the menu, which then drops from it and toggles it. */
  anchor?: RefObject<HTMLElement | null>
}

/**
 * The project's actions behind a round button beside the prompt bar, the
 * mic's twin. It opens a menu above it: the project's own actions, then the
 * global ones, then New action. A running action's row says what its run is
 * doing, and a click opens the run instead of starting another. While the
 * menu is closed, the button's dot says a run is going, or needs you.
 */
export function ActionButton({
  onRun,
  onOverlayChange
}: {
  onRun: (action: ProjectAction) => void
  /** Whether the menu or one of its dialogs is open, so the board can hold its shortcuts. */
  onOverlayChange: (open: boolean) => void
}) {
  const project = useApp((s) => s.board?.project)
  const globalActions = useApp((s) => s.globalActions)
  const cards = useApp((s) => s.board?.cards)
  const openInWorkspace = useApp((s) => s.openInWorkspace)
  const workspaceOpen = useApp((s) => s.workspaceOpen)
  const runs = useMemo(() => runsByAction(cards), [cards])
  const rows = useMemo(() => menuRows(project?.actions ?? [], globalActions, runs), [project, globalActions, runs])
  /** The rows that take the focus, in order: every action, then New action. */
  const count = rows.filter((r) => r.kind !== 'divider').length

  const [open, setOpen] = useState(false)
  /** The highlighted row, which has the focus: picked by the pointer or the arrow keys, -1 for none. */
  const [active, setActive] = useState(-1)
  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [editing, setEditing] = useState<{ action?: ProjectAction } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /** The row to highlight as the menu opens: the first or last from the keyboard, none from the mouse. */
  const startAt = useRef(-1)
  const menuId = useId()
  const now = useNow(open && runs.size > 0)

  const overlay = Boolean(open || editing || menu || confirm)
  useEffect(() => onOverlayChange(overlay), [overlay, onOverlayChange])
  useEffect(() => () => onOverlayChange(false), [onOverlayChange])

  const items = () => [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const focusItem = (i: number, scroll = true) => {
    setActive(i)
    if (i < 0) listRef.current?.focus({ preventScroll: true })
    else items()[i]?.focus({ preventScroll: !scroll })
  }

  const show = (from: number) => {
    startAt.current = from
    setOpen(true)
  }
  /** Closes the menu, giving the keyboard back to the button when it was the menu's. */
  const close = (refocus: boolean) => {
    setOpen(false)
    setActive(-1)
    if (refocus) buttonRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (open) focusItem(startAt.current)
    // Only as it opens: focusItem is a new function each render.
  }, [open])

  // A click anywhere else closes it, as does the window losing focus (a click into a view's frame, say).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const hit = e.target as Element
      if (listRef.current?.contains(hit) || buttonRef.current?.contains(hit)) return
      // A row's context menu sits over it and closes itself.
      if (hit.closest?.('.ctx-menu')) return
      close(false)
    }
    const onBlur = () => close(false)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [open])

  // The workspace covers the board, and its bar with it.
  useEffect(() => {
    if (workspaceOpen) close(false)
  }, [workspaceOpen])

  const press = (action: ProjectAction) => {
    const run = runs.get(action.id)
    if (run) {
      close(false)
      openInWorkspace(run.sessionId)
    } else {
      close(true)
      onRun(action)
    }
  }
  const edit = (action?: ProjectAction) => {
    close(false)
    setEditing({ action })
  }
  const remove = (action: ProjectAction) => {
    close(false)
    setConfirm({
      title: `Delete “${action.name}”?`,
      message: action.global
        ? 'It’s a global button, so it goes from every project. A run already going keeps going.'
        : 'The button and its prompt are deleted. A run already going keeps going.',
      confirmLabel: 'Delete',
      danger: true,
      resolve: (ok) => {
        setConfirm(null)
        if (ok) useApp.getState().removeAction(project!.id, action.id)
      }
    })
  }

  const onButtonClick = (e: MouseEvent) => {
    if (open) return close(false)
    // From the keyboard (a click with no detail) the first row takes the focus; from the mouse, the
    // menu does, and nothing is highlighted until the pointer or an arrow key picks a row.
    show(e.detail === 0 ? 0 : -1)
  }
  const onButtonKey = (e: KeyboardEvent) => {
    if (open || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    show(e.key === 'ArrowDown' ? 0 : count - 1)
  }
  const onMenuKey = (e: KeyboardEvent) => {
    // The board's own keys, Esc among them, never see what the menu handles.
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
      return
    }
    const next = stepIndex(active < count ? active : -1, e.key, count)
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    focusItem(next)
  }

  const status = buttonStatus(runs.values())
  const label =
    status === 'waiting' ? 'Actions: a run needs you' : status ? `Actions: ${runs.size} running` : 'Actions'

  if (!project) return null

  let index = -1
  return (
    <>
      <div className="action-button-wrap">
        <button
          ref={buttonRef}
          className={clsx('sidekick-orb action-button', open && 'is-open')}
          onClick={onButtonClick}
          onKeyDown={onButtonKey}
          title={label}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
        >
          <Zap size={21} strokeWidth={2} />
          {status && !open && <span className="status-dot action-button-dot" data-status={status} />}
        </button>

        {open && (
          <div
            ref={listRef}
            id={menuId}
            className="action-menu"
            role="menu"
            aria-label="Actions"
            tabIndex={-1}
            onKeyDown={onMenuKey}
            onPointerLeave={() => !menu && focusItem(-1)}
          >
            {rows.map((row) => {
              if (row.kind === 'divider') {
                return <div key={`sep-${row.key}`} className="action-menu-sep" role="separator" />
              }
              const i = ++index
              const hover = () => i !== active && focusItem(i, false)
              if (row.kind === 'new') {
                return (
                  <div key="new" role="none" className={clsx('action-menu-row', i === active && 'is-active')} onPointerMove={hover}>
                    <button role="menuitem" tabIndex={-1} className="action-menu-item" onClick={() => edit()}>
                      <span className="action-tile is-new">
                        <Plus size={17} strokeWidth={2} />
                      </span>
                      <span className="action-menu-text">
                        <span className="action-menu-name">New action</span>
                        <span className="action-menu-detail">Describe a button, and Claude makes it</span>
                      </span>
                    </button>
                  </div>
                )
              }
              const { action, run } = row
              return (
                <ActionRow
                  key={action.id}
                  action={action}
                  run={run}
                  now={now}
                  active={i === active}
                  menuOpen={menu?.action.id === action.id}
                  onHover={hover}
                  onPress={() => press(action)}
                  onMenu={(next) => setMenu(next)}
                />
              )
            })}
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          align={menu.anchor ? 'right' : 'left'}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          items={[
            {
              label: runs.has(menu.action.id) ? 'Show Run' : 'Run',
              icon: <Play size={14} />,
              onSelect: () => press(menu.action)
            },
            { label: 'Edit…', icon: <Pencil size={14} />, onSelect: () => edit(menu.action) },
            'separator',
            { label: 'Delete…', danger: true, onSelect: () => remove(menu.action) }
          ]}
        />
      )}
      {editing && <ActionDialog projectId={project.id} action={editing.action} onClose={() => setEditing(null)} />}
      <ConfirmDialog request={confirm} />
    </>
  )
}

/** One action in the menu: its tile, name and what it does, or what its run is doing; ⋯ for its menu. */
function ActionRow({
  action,
  run,
  now,
  active,
  menuOpen,
  onHover,
  onPress,
  onMenu
}: {
  action: ProjectAction
  run: SessionCard | undefined
  now: number
  active: boolean
  menuOpen: boolean
  onHover: () => void
  onPress: () => void
  onMenu: (menu: RowMenu | null) => void
}) {
  const more = useRef<HTMLButtonElement>(null)
  const state = run && runState(run)
  const step = !run
    ? undefined
    : run.status === 'waiting'
      ? 'It needs you. Open it to answer'
      : run.meta?.lastAssistantText
        ? truncate(run.meta.lastAssistantText, 140)
        : 'Starting…'

  return (
    <div
      role="none"
      className={clsx('action-menu-row', active && 'is-active', menuOpen && 'has-menu')}
      data-run={state}
      onPointerMove={onHover}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu({ x: e.clientX, y: e.clientY, action })
      }}
    >
      <button
        role="menuitem"
        tabIndex={-1}
        className="action-menu-item"
        onClick={onPress}
        title={run ? `Open ${action.name}` : action.description || undefined}
      >
        <span className="action-tile">
          <ActionIcon name={action.icon} size={17} />
          {action.global && (
            <span className="action-global" title="In every project">
              <Globe size={9} strokeWidth={2.4} />
            </span>
          )}
        </span>
        <span className="action-menu-text">
          <span className="action-menu-name">{action.name}</span>
          {run && state ? (
            <>
              <span className="action-menu-run" data-status={state}>
                <span className="status-dot is-small" data-status={state} />
                {runLabel[state]} · {formatDuration(now - run.createdAt)}
              </span>
              <span className="action-menu-detail is-step">{step}</span>
            </>
          ) : (
            <span className="action-menu-detail">{action.description || 'Right-click to edit'}</span>
          )}
        </span>
      </button>
      <button
        ref={more}
        className="action-menu-more"
        tabIndex={-1}
        aria-label={`More for ${action.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          if (menuOpen) return onMenu(null)
          const r = more.current!.getBoundingClientRect()
          onMenu({ x: r.right, y: r.bottom + 4, action, anchor: more })
        }}
      >
        <MoreHorizontal size={15} strokeWidth={2} />
      </button>
    </div>
  )
}
