import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { PANEL_DEFAULT_W, PANEL_MIN_W } from '@shared/panel'
import { clampSplit, splitMax } from '@shared/workspace'
import { useApp } from '@renderer/store'

/** How far an arrow key moves the divider; with ⇧, four times that. */
const STEP = 16

/**
 * The divider between the workspace's terminal and the project panel. Dragging
 * it resizes the panel, from the panel's minimum to half the row; double-click
 * puts the default width back, and the arrow keys nudge it. The width is the
 * panel's own setting, so the board's panel opens as wide.
 */
export function SplitHandle({ width, row }: { width: number; row: number }) {
  const drag = useRef<{ x: number; width: number } | null>(null)

  // Dragging shows the new width at once and saves it on release, not on every move.
  const show = (w: number) =>
    useApp.setState((s) => ({ settings: s.settings && { ...s.settings, panelWidth: clampSplit(w, row) } }))
  const save = (w: number) => useApp.getState().updateSettings({ panelWidth: clampSplit(w, row) })

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) show(drag.current.width + drag.current.x - e.clientX)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    save(useApp.getState().settings?.panelWidth ?? width)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 4 * STEP : STEP
    if (e.key === 'ArrowLeft') save(width + step)
    else if (e.key === 'ArrowRight') save(width - step)
    else return
    e.preventDefault()
  }

  return (
    <div
      className="ws-split"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the project panel"
      aria-controls="project-panel"
      aria-valuenow={width}
      aria-valuemin={PANEL_MIN_W}
      aria-valuemax={splitMax(row)}
      tabIndex={0}
      title="Drag to resize the panel, double-click for the default width"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => save(PANEL_DEFAULT_W)}
      onKeyDown={onKeyDown}
    >
      <span className="ws-split-grip" />
    </div>
  )
}
