import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import clsx from 'clsx'
import { PANEL_DEFAULT_W } from '@shared/panel'
import { clampSplit, cycleTab, tabAt } from '@shared/workspace'
import { useApp } from '@renderer/store'
import { ProjectPanel } from '@renderer/components/panel/ProjectPanel'
import { usePanelPlacement } from '@renderer/components/panel/PanelDock'
import { SessionPane } from '@renderer/terminal/SessionPane'
import { PANE_ID, SessionTabs, tabId } from './SessionTabs'
import { SplitHandle } from './SplitHandle'
import './workspace.css'

/**
 * The element's width, kept up to date as it resizes. It's measured before the
 * first paint; `estimate` stands in until then.
 */
function useWidth(ref: RefObject<HTMLElement | null>, estimate: number): number {
  const [width, setWidth] = useState(estimate)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/** A dialog over the workspace, whose keys are its own: Settings, the agents viewer, a transcript, the diff, a confirmation. */
function dialogOpen(): boolean {
  const s = useApp.getState()
  return s.settingsOpen || Boolean(s.agentView || s.previewSessionId || s.diffOpen || s.cancelPaneDialog)
}

/**
 * The project's sessions in the board's place: tabs along the top, the tab
 * showing's terminal in the middle, and the project panel on the right behind
 * a divider. Hidden, the panel takes no room, and its arrow waits at the end
 * of the tabs. Only the tab showing has its
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
  // The row spans the window but for a pinned rail (leftW), until it's measured.
  const { leftW } = usePanelPlacement()
  const row = useWidth(rowRef, window.innerWidth - leftW)
  const width = clampSplit(savedWidth, row)

  // ⌃Tab and ⌃⇧Tab go round the tabs, and ⌘1 to ⌘9 jump to one. ⌘W comes through the menu (App).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Keys pressed in a dialog over the workspace are the dialog's, focused or not.
      const target = e.target as Node | null
      if (target && target !== document.body && !rootRef.current?.contains(target)) return
      if (dialogOpen()) return
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
    <div ref={rootRef} className={clsx('workspace', pinRail && 'beside-rail')}>
      <SessionTabs onShowPanel={panelOpen ? undefined : () => setPanelOpen(true)} />
      <div ref={rowRef} className="ws-row">
        <section className="ws-pane" id={PANE_ID} role="tabpanel" aria-labelledby={active ? tabId(active) : undefined}>
          {active && <SessionPane key={active} sessionId={active} projectId={projectId} />}
        </section>
        {/* Hidden, the panel leaves no column: the terminal runs to the edge, and the tabs hold its arrow. */}
        {panelOpen && (
          <>
            <SplitHandle width={width} row={row} />
            <aside
              id="project-panel"
              className="ws-panel"
              style={{ width }}
              aria-label="Project panel"
              onKeyDown={(e) => {
                // Keys typed in the panel are the panel's, as beside the board; ⌘ ones and the
                // workspace's ⌃Tab still reach the window.
                if (!e.metaKey && !(e.ctrlKey && e.key === 'Tab')) e.stopPropagation()
              }}
            >
              <ProjectPanel projectId={projectId} onHide={() => setPanelOpen(false)} />
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
