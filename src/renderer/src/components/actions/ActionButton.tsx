import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent
} from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Globe, Pencil, Play, Plus, Zap } from 'lucide-react'
import type { ProjectAction, SessionCard } from '@shared/types'
import { ContextMenu } from '@renderer/components/ContextMenu'
import { ConfirmDialog, type ConfirmRequest } from '@renderer/components/board/ConfirmDialog'
import { useNow } from '@renderer/components/board/AgentDeck'
import { formatDuration, useApp } from '@renderer/store'
import { ActionDialog } from './ActionDialog'
import { ActionIcon } from './ActionIcon'
import {
  besideStack,
  buttonStatus,
  cardTop,
  hintDetail,
  runLabel,
  runStep,
  runsByAction,
  runState,
  stackItems,
  stepIndex
} from './stack'
import '@renderer/components/projects/ProjectRail.css'
import './actions.css'

/** As wide as the rail's hint and fan, and as far from the stack as they were from the rail. */
const HINT_W = 260
const HINT_GAP = 6
const FAN_GAP = 10

/** Where the highlighted tile is, for its hint or run card beside the stack. */
interface Spot {
  /** The tile's top and middle, in the window. */
  top: number
  mid: number
  hint: { left: number } | { right: number }
  fan: { left: number } | { right: number }
}

/**
 * The project's actions behind a round button beside the prompt bar, the
 * mic's twin. It opens the rail's tiles stacked above it: the project's own
 * actions, then the global ones, then +. Pointing at a tile (or reaching it
 * with the arrow keys) shows the rail's hint beside the stack, or, for an
 * action that is running, its run's card as the rail's fan dealt it; a click
 * opens the run instead of starting another. While the stack is closed, the
 * button's dot says a run is going, or needs you.
 */
export function ActionButton({
  onRun,
  onOverlayChange
}: {
  /** Starts a run; resolves once its card is on the board. */
  onRun: (action: ProjectAction) => Promise<void>
  /** Whether the stack or one of its dialogs is open, so the board can hold its shortcuts. */
  onOverlayChange: (open: boolean) => void
}) {
  const project = useApp((s) => s.board?.project)
  const globalActions = useApp((s) => s.globalActions)
  const cards = useApp((s) => s.board?.cards)
  const openInWorkspace = useApp((s) => s.openInWorkspace)
  const workspaceOpen = useApp((s) => s.workspaceOpen)
  const runs = useMemo(() => runsByAction(cards), [cards])
  const items = useMemo(() => stackItems(project?.actions ?? [], globalActions, runs), [project, globalActions, runs])
  /** The tiles, in order, which the keyboard moves between: every action, then +. */
  const tiles = useMemo(() => items.filter((i) => i.kind !== 'divider'), [items])
  const count = tiles.length

  const [open, setOpen] = useState(false)
  /** The highlighted tile, which has the focus and the hint: picked by the pointer or the arrow keys, -1 for none. */
  const [active, setActive] = useState(-1)
  const [spot, setSpot] = useState<Spot | null>(null)
  /** Bumped as the stack scrolls, so the hint keeps to its tile. */
  const [scrolled, setScrolled] = useState(0)
  /** A tile's context menu; `keyboard` when Shift+F10 or → opened it, which then hands the keyboard back to the tile. */
  const [menu, setMenu] = useState<{ x: number; y: number; action: ProjectAction; keyboard?: boolean } | null>(null)
  const [editing, setEditing] = useState<{ action?: ProjectAction } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  /** The tile to highlight as the stack opens: the first or last from the keyboard, none from the mouse. */
  const startAt = useRef(-1)
  /**
   * Actions whose run is being started. Their card comes only once the session
   * has been made, so till then another press would start a second run.
   */
  const starting = useRef(new Set<string>())
  const stackId = useId()
  const now = useNow(open && runs.size > 0)

  const overlay = Boolean(open || editing || menu || confirm)
  useEffect(() => onOverlayChange(overlay), [overlay, onOverlayChange])
  useEffect(() => () => onOverlayChange(false), [onOverlayChange])

  const tileEls = () => [...(stackRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const focusTile = (i: number, scroll = true) => {
    setActive(i)
    if (i < 0) stackRef.current?.focus({ preventScroll: true })
    else tileEls()[i]?.focus({ preventScroll: !scroll })
  }

  const show = (from: number) => {
    startAt.current = from
    setOpen(true)
  }
  /**
   * Closes the stack, and a tile's context menu with it, giving the keyboard
   * back to the button when it was the stack's. The menu can't be left to close
   * itself on a click away: closing the stack re-renders it mid-click, which
   * swaps its listener out before that click reaches it.
   */
  const close = (refocus: boolean) => {
    setOpen(false)
    setActive(-1)
    setMenu(null)
    if (refocus) buttonRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (open) focusTile(startAt.current)
    // Only as it opens: focusTile is a new function each render.
  }, [open])

  // The highlighted tile's hint goes beside the stack, level with the tile. None while its context menu is up.
  const current = active >= 0 && active < count ? tiles[active] : undefined
  useLayoutEffect(() => {
    const tile = active >= 0 ? tileEls()[active] : undefined
    const stack = stackRef.current
    if (!open || !tile || !stack || menu) return setSpot(null)
    const t = tile.getBoundingClientRect()
    const s = stack.getBoundingClientRect()
    setSpot({
      top: t.top,
      mid: t.top + t.height / 2,
      hint: besideStack(s, window.innerWidth, HINT_W, HINT_GAP),
      fan: besideStack(s, window.innerWidth, HINT_W, FAN_GAP)
    })
    // tileEls reads the stack as it is now.
  }, [open, active, menu, scrolled, items])

  // A click anywhere else closes it, as does the window losing focus (a click into a view's frame, say).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const hit = e.target as Element
      if (stackRef.current?.contains(hit) || buttonRef.current?.contains(hit)) return
      // A tile's context menu sits over it and closes itself.
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
      return
    }
    close(true)
    if (starting.current.has(action.id)) return
    starting.current.add(action.id)
    void onRun(action).finally(() => starting.current.delete(action.id))
  }
  const edit = (action?: ProjectAction) => {
    close(false)
    setEditing({ action })
  }
  /** After a dialog of the stack, the keyboard goes back to the button that opened it. */
  const refocus = () => buttonRef.current?.focus()
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
        refocus()
        if (ok) useApp.getState().removeAction(project!.id, action.id)
      }
    })
  }

  const onButtonClick = (e: MouseEvent) => {
    if (open) return close(false)
    // From the keyboard (a click with no detail) the top tile takes the focus; from the mouse, the
    // stack does, and nothing is highlighted until the pointer or an arrow key picks a tile.
    show(e.detail === 0 ? 0 : -1)
  }
  const onButtonKey = (e: KeyboardEvent) => {
    if (open || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    // Up goes into the stack from below, to the + right above the button.
    show(e.key === 'ArrowDown' ? 0 : count - 1)
  }
  const onStackKey = (e: KeyboardEvent) => {
    // The board's own keys, Esc among them, never see what the stack handles.
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
      return
    }
    // Shift+F10, the menu key or → opens the highlighted action's context menu, beside the stack at its tile.
    const tile = active >= 0 && active < count ? tiles[active] : undefined
    if (tile?.kind === 'action' && (e.key === 'ContextMenu' || e.key === 'ArrowRight' || (e.key === 'F10' && e.shiftKey))) {
      e.preventDefault()
      e.stopPropagation()
      const t = tileEls()[active].getBoundingClientRect()
      const s = stackRef.current!.getBoundingClientRect()
      setMenu({ x: s.right + HINT_GAP, y: t.top, action: tile.action, keyboard: true })
      return
    }
    const next = stepIndex(active < count ? active : -1, e.key, count)
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    focusTile(next)
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
          aria-controls={open ? stackId : undefined}
        >
          <Zap size={21} strokeWidth={2} />
          {status && !open && <span className="status-dot action-button-dot" data-status={status} />}
        </button>

        {open && (
          <div
            ref={stackRef}
            id={stackId}
            className="rail is-open action-stack"
            role="menu"
            aria-label="Actions"
            tabIndex={-1}
            onKeyDown={onStackKey}
            onPointerLeave={() => !menu && focusTile(-1)}
            onScroll={() => setScrolled((n) => n + 1)}
          >
            {items.map((item) => {
              if (item.kind === 'divider') return <div key={`sep-${item.key}`} className="rail-sep" role="separator" />
              const i = ++index
              const hover = () => i !== active && focusTile(i, false)
              if (item.kind === 'new') {
                return (
                  <button
                    key="new"
                    role="menuitem"
                    tabIndex={-1}
                    className={clsx('rail-item rail-add', i === active && 'is-current')}
                    aria-label="New Action"
                    onClick={() => edit()}
                    onPointerMove={hover}
                  >
                    <Plus size={18} strokeWidth={2} />
                  </button>
                )
              }
              const { action, run } = item
              return (
                <button
                  key={action.id}
                  role="menuitem"
                  tabIndex={-1}
                  className={clsx('rail-item', run && 'is-running', i === active && 'is-current')}
                  aria-label={action.name}
                  onClick={() => press(action)}
                  onPointerMove={hover}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, action })
                  }}
                >
                  <span className="action-tile">
                    <ActionIcon name={action.icon} size={17} />
                    {action.global && (
                      <span className="action-global" aria-hidden="true">
                        <Globe size={9} strokeWidth={2.4} />
                      </span>
                    )}
                  </span>
                  {run && <span className="status-dot rail-dot" data-status={runState(run)} />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* In the window's own layer: the bar's transform would trap fixed positioning. */}
      {spot &&
        current &&
        createPortal(
          current.kind === 'action' && current.run ? (
            <RunCard action={current.action} card={current.run} now={now} tileTop={spot.top} place={spot.fan} />
          ) : (
            <div
              className={clsx('rail-hint', 'right' in spot.hint && 'is-flipped')}
              style={{ top: spot.mid, ...spot.hint }}
              role="tooltip"
            >
              <span className="rail-hint-name">{current.kind === 'action' ? current.action.name : 'New Action'}</span>
              <span className="rail-hint-detail">
                {current.kind === 'action' ? hintDetail(current.action) : 'Describe a button, and Claude makes it'}
              </span>
            </div>
          ),
          document.body
        )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          keyboard={menu.keyboard}
          onClose={() => {
            setMenu(null)
            if (menu.keyboard) tileEls()[active]?.focus()
          }}
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
      {editing && (
        <ActionDialog
          projectId={project.id}
          action={editing.action}
          onClose={() => {
            setEditing(null)
            refocus()
          }}
        />
      )}
      <ConfirmDialog request={confirm} />
    </>
  )
}

/**
 * A running action's session, as the rail's fan dealt it out beside its
 * button: what it's doing, whether it needs you, and for how long. It shows
 * while its tile is highlighted, and the tile's click opens it.
 */
function RunCard({
  action,
  card,
  now,
  tileTop,
  place
}: {
  action: ProjectAction
  card: SessionCard
  now: number
  tileTop: number
  place: { left: number } | { right: number }
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number | null>(null)

  // Level with its tile, kept inside the window.
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setTop(cardTop(tileTop, el.offsetHeight, window.innerHeight))
  }, [tileTop, card.status, card.meta?.lastAssistantText])

  return (
    <div
      ref={ref}
      className={clsx('action-fan', 'right' in place && 'is-flipped')}
      style={{ top: top ?? undefined, visibility: top === null ? 'hidden' : undefined, ...place }}
      role="tooltip"
    >
      <div className="fan-card" data-status={card.status} style={{ '--i': 0 } as CSSProperties}>
        <span className="fan-card-head">
          <span className="status-dot is-small" data-status={card.status} />
          <span className="fan-card-name">{action.name}</span>
        </span>
        <span className="fan-card-step">
          <span className="fan-card-detail">{runStep(card)}</span>
        </span>
        <span className="fan-card-meta">
          <span className="fan-card-status" data-status={card.status}>
            {runLabel[card.status]}
          </span>
          <span>{formatDuration(now - card.createdAt)}</span>
        </span>
      </div>
    </div>
  )
}
