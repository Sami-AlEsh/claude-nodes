import { useEffect, type CSSProperties } from 'react'
import clsx from 'clsx'
import { useApp } from './store'
import { TitleBar } from './components/TitleBar'
import { ProjectsView } from './views/ProjectsView'
import { BoardView } from './views/BoardView'
import { TranscriptPreview } from './terminal/TranscriptPreview'
import { AgentViewer } from './terminal/AgentViewer'
import { DiffModal } from './components/git/DiffModal'
import { SettingsDialog } from './components/SettingsDialog'
import { ProjectRail } from './components/projects/ProjectRail'
import { PanelDock, usePanelPlacement } from './components/panel/PanelDock'
import { SessionWorkspace } from './components/workspace/SessionWorkspace'

export function App() {
  const route = useApp((s) => s.route)
  const pinRail = useApp((s) => s.settings?.pinProjectRail ?? false)
  const workspaceOpen = useApp((s) => s.workspaceOpen)
  const panel = usePanelPlacement()

  useEffect(() => {
    useApp.getState().refreshProjects()
    useApp.getState().loadSettings()

    const offStatus = window.api.on.status((sessionId, status, live) => {
      useApp.getState().setStatus(sessionId, status, live)
    })
    const offAgentStatus = window.api.on.agentStatus((sessionId, agentId, status) => {
      useApp.getState().setAgentStatus(sessionId, agentId, status)
    })
    const offUsage = window.api.on.usage((sessionId, usage) => {
      useApp.getState().setUsage(sessionId, usage)
    })

    // Folder badges (in the grid and the project rail) and the title bar's running count show live
    // counts, so refresh stats when statuses change. And when a process exits: SessionEnd reports a
    // session as stopped while its process is still exiting, so the exit itself changes no status.
    let statsTimer: number | undefined
    const refreshStats = () => {
      window.clearTimeout(statsTimer)
      statsTimer = window.setTimeout(() => useApp.getState().refreshProjects(), 250)
    }
    const offStatsRefresh = window.api.on.status(refreshStats)
    const offExitRefresh = window.api.on.ptyExit(refreshStats)

    const offBoard = window.api.on.boardChanged((projectId) => {
      const { route, loadBoard } = useApp.getState()
      if (route.view === 'board' && route.projectId === projectId) loadBoard(projectId)
    })
    // A session added a project with its board tools.
    const offProjects = window.api.on.projectsChanged(() => useApp.getState().refreshProjects())

    // Cmd+W closes the top-most layer and never the window itself: a dialog, then the workspace's
    // tab (the last one goes back to the board), then the board.
    const offMenu = window.api.on.menu((command) => {
      if (command === 'settings') useApp.getState().openSettings()
      if (command !== 'close') return
      const s = useApp.getState()
      if (s.cancelPaneDialog) s.cancelPaneDialog()
      else if (s.settingsOpen) s.closeSettings()
      else if (s.agentView) s.closeAgents()
      else if (s.previewSessionId) s.closePreview()
      else if (s.diffOpen) s.closeDiff()
      else if (s.workspaceOpen && s.workspace.active) s.closeTab(s.workspace.active)
      else if (s.route.view === 'board') s.navigate({ view: 'projects' })
    })

    // A notification the user clicked opens its card, also one clicked while the window was closed.
    const offOpenCard = window.api.on.openCard((request) => useApp.getState().showCard(request))
    window.api.takeOpenRequest().then((request) => request && useApp.getState().showCard(request))

    // Files dropped outside a drop target must not navigate the window to file://.
    const blockDrop = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', blockDrop)
    window.addEventListener('drop', blockDrop)

    return () => {
      window.removeEventListener('dragover', blockDrop)
      window.removeEventListener('drop', blockDrop)
      offStatus()
      offAgentStatus()
      offUsage()
      offStatsRefresh()
      offExitRefresh()
      offBoard()
      offProjects()
      offMenu()
      offOpenCard()
      window.clearTimeout(statsTimer)
    }
  }, [])

  return (
    <div className="app">
      <TitleBar />
      {/*
        On a board, the open project panel takes the window's right: --panel-offset is how much, for
        the board and for what's placed from the board's right edge. Folded, it takes nothing: its
        button floats over the board.
      */}
      <main
        className="app-main"
        style={
          {
            '--panel-w': `${panel.width}px`,
            '--panel-offset': route.view === 'board' && panel.open ? `${panel.width}px` : '0px'
          } as CSSProperties
        }
      >
        {route.view === 'projects' ? (
          <ProjectsView />
        ) : (
          <>
            {/*
              A pinned rail and the project panel take columns of their own, so they never cover the board.
              Under the workspace the board stays mounted, laid out as it was, so its viewport is where it
              was on the way back; it's hidden and inert, so nothing in it takes the pointer, focus or keys.
            */}
            <div
              className={clsx('board-area beside-panel', pinRail && 'beside-rail', workspaceOpen && 'is-covered')}
              inert={workspaceOpen}
            >
              <BoardView key={route.projectId} projectId={route.projectId} />
            </div>
            {/* The workspace has the project panel in a column of its own, in place of the board's strip. */}
            {workspaceOpen ? (
              <SessionWorkspace projectId={route.projectId} pinRail={pinRail} />
            ) : (
              <PanelDock projectId={route.projectId} />
            )}
            <ProjectRail activeId={route.projectId} pinned={pinRail} />
          </>
        )}
      </main>
      <TranscriptPreview />
      <AgentViewer />
      <DiffModal />
      <SettingsDialog />
    </div>
  )
}
