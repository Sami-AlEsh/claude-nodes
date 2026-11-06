import { useRef, type PointerEvent } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PANEL_DEFAULT_W, clampPanelWidth } from '@shared/panel'
import { useApp } from '@renderer/store'
import { ProjectPanel } from './ProjectPanel'

/** Whether the project panel is open, and how wide. Both are settings, so they last across launches. */
export function usePanelPlacement() {
  const open = useApp((s) => s.settings?.panelOpen ?? false)
  const width = useApp((s) => s.settings?.panelWidth ?? PANEL_DEFAULT_W)
  return { open, width }
}

/**
 * The project panel on the board's right. A narrow strip always holds its
 * arrow: folded, that's all there is; open, the panel takes a column of its
 * own beyond the strip and the board gets narrower. Open, the strip is the
 * panel's edge too, and dragging it resizes the panel. Widths come from
 * App's --panel-w and --panel-strip-w, which it sets for the board as well.
 */
export function PanelDock({ projectId }: { projectId: string }) {
  const { open, width } = usePanelPlacement()
  const drag = useRef<{ x: number; width: number } | null>(null)
  const setOpen = useApp((s) => s.setPanelOpen)

  // Dragging shows the new width at once and saves it on release, not on every move.
  const setWidth = (w: number) =>
    useApp.setState((s) => ({ settings: s.settings && { ...s.settings, panelWidth: clampPanelWidth(w) } }))
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!open || e.button !== 0 || (e.target as HTMLElement).closest('button')) return
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
    <>
      <div
        className={clsx('panel-strip', open && 'is-open')}
        role={open ? 'separator' : undefined}
        aria-orientation={open ? 'vertical' : undefined}
        aria-label={open ? 'Resize the project panel' : undefined}
        title={open ? 'Drag to resize the panel, double-click for the default width' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (open && !(e.target as HTMLElement).closest('button')) useApp.getState().updateSettings({ panelWidth: PANEL_DEFAULT_W })
        }}
      >
        <button
          className="panel-strip-btn"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="project-panel"
          aria-label={open ? 'Hide the project panel' : 'Show the project panel'}
          title={open ? 'Hide the project panel' : 'Show the project panel: pull requests, tickets and changes'}
        >
          {open ? <ChevronRight size={14} strokeWidth={2.2} /> : <ChevronLeft size={14} strokeWidth={2.2} />}
        </button>
      </div>
      {open && (
        <aside
          id="project-panel"
          className="panel-dock"
          aria-label="Project panel"
          onKeyDown={(e) => {
            // The board's shortcuts listen on window; keys pressed in the panel are the panel's.
            if (!e.metaKey) e.stopPropagation()
          }}
        >
          <ProjectPanel projectId={projectId} />
        </aside>
      )}
    </>
  )
}
