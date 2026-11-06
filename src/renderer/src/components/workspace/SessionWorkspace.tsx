import { useEffect, useRef, useState, type RefObject } from 'react'
import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import { PANEL_DEFAULT_W } from '@shared/panel'
import { clampSplit, cycleTab, tabAt } from '@shared/workspace'
import { useApp } from '@renderer/store'
import { ProjectPanel } from '@renderer/components/panel/ProjectPanel'
import { SessionPane } from '@renderer/terminal/SessionPane'
import { PANE_ID, SessionTabs, tabId } from './SessionTabs'
import { SplitHandle } from './SplitHandle'
import './workspace.css'

/** The element's width, kept up to date as it resizes; 0 until it's measured. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * The project's sessions in the board's place: tabs along the top, the tab
 * showing's terminal in the middle, and the project panel on the right behind
 * a divider, or folded to a strip at the edge. Only the tab showing has its
 * terminal attached; the registry parks the others, still running.
 */
export function SessionWorkspace({ projectId, pinRail }: { projectId: string; pinRail: boolean }) {
  const active = useApp((s) => s.workspace.active)
  const setPanelOpen = useApp((s) => s.setPanelOpen)
  // The panel's own settings, shared with the board: open there is open here, and as wide as
  // the row allows (the board's room doesn't matter here, only the terminal's).
  const panelOpen = useApp((s) => s.settings?.panelOpen ?? false)
  const savedWidth = useApp((s) => s.settings?.panelWidth ?? PANEL_DEFAULT_W)
  const rootRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const row = useWidth(rowRef)
  const width = clampSplit(savedWidth, row)

  // ⌃Tab and ⌃⇧Tab go round the tabs, and ⌘1 to ⌘9 jump to one. ⌘W comes through the menu (App).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Keys pressed in a dialog over the workspace are the dialog's.
      const target = e.target as Node | null
      if (target && target !== document.body && !rootRef.current?.contains(target)) return
      const s = useApp.getState()
      let next: string | null
      if (e.key === 'Tab' && e.ctrlKey && !e.metaKey && !e.altKey) next = cycleTab(s.workspace, e.shiftKey ? -1 : 1)
      else if (e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) next = tabAt(s.workspace, Number(e.key))
      else return
      e.preventDefault()
      if (next) s.activateTab(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={rootRef} className={clsx('workspace', pinRail && 'beside-rail')} data-panel-open={panelOpen || undefined}>
      <SessionTabs />
      <div ref={rowRef} className="ws-row">
        <section className="ws-pane" id={PANE_ID} role="tabpanel" aria-labelledby={active ? tabId(active) : undefined}>
          {active && <SessionPane key={active} sessionId={active} projectId={projectId} />}
        </section>
        {panelOpen ? (
          <>
            <SplitHandle width={width} row={row} />
            <aside id="project-panel" className="ws-panel" style={{ width }} aria-label="Project panel">
              <ProjectPanel projectId={projectId} onHide={() => setPanelOpen(false)} />
            </aside>
          </>
        ) : (
          <div className="ws-strip">
            <button
              className="panel-strip-btn"
              onClick={() => setPanelOpen(true)}
              aria-expanded={false}
              aria-controls="project-panel"
              aria-label="Show the project panel"
              title="Show the project panel: pull requests, tickets and changes"
            >
              <ChevronLeft size={14} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
