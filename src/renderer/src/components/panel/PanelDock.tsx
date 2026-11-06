import { useRef, type PointerEvent } from 'react'
import clsx from 'clsx'
import { PANEL_DEFAULT_W, clampPanelWidth } from '@shared/panel'
import { useApp } from '@renderer/store'
import { ProjectPanel } from './ProjectPanel'

/** Whether the project panel is out, and whether it's pinned in a column of its own. */
export function usePanelPlacement() {
  const pinned = useApp((s) => s.settings?.pinProjectPanel ?? false)
  const open = useApp((s) => s.panelOpen ?? s.settings?.pinProjectPanel ?? false)
  const width = useApp((s) => s.settings?.panelWidth ?? PANEL_DEFAULT_W)
  return { pinned, open, width }
}

/**
 * The project panel on the board's right. The title bar's button slides it in
 * over the board, until it's hidden again. Pinned (in Settings), it stays out
 * in a column of its own beside the board. Its left edge drags to resize it.
 * Its width comes from --panel-w, which App sets for the board beside it too.
 */
export function PanelDock({ projectId }: { projectId: string }) {
  const { pinned, open, width } = usePanelPlacement()
  const drag = useRef<{ x: number; width: number } | null>(null)

  // Dragging shows the new width at once and saves it on release, not on every move.
  const setWidth = (w: number) =>
    useApp.setState((s) => ({ settings: s.settings && { ...s.settings, panelWidth: clampPanelWidth(w) } }))
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setWidth(drag.current.width + drag.current.x - e.clientX)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    const w = useApp.getState().settings?.panelWidth
    if (w) useApp.getState().updateSettings({ panelWidth: w })
  }

  return (
    <aside
      className={clsx('panel-dock', open && 'is-open', pinned && 'is-pinned')}
      aria-label="Project panel"
      inert={!open}
      onKeyDown={(e) => {
        // The board's shortcuts listen on window; keys pressed in the panel are the panel's.
        if (!e.metaKey) e.stopPropagation()
        if (e.key === 'Escape' && !pinned) useApp.getState().setPanelOpen(false)
      }}
    >
      <div
        className="panel-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the panel"
        title="Drag to resize, double-click for the default width"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => useApp.getState().updateSettings({ panelWidth: PANEL_DEFAULT_W })}
      />
      <ProjectPanel projectId={projectId} active={open} onHide={() => useApp.getState().setPanelOpen(false)} />
    </aside>
  )
}
