import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import type { MenuCommand } from '@shared/api'
import type { AppSettings } from '@shared/types'
import { stopAll } from './pty'
import { getState } from './store'
import { check } from './updater'

const REPO_URL = 'https://github.com/saleem-hadad/nodus'
const FOCUS_ITEM_ID = 'focus-mode'
const FOCUS_SEP_ID = 'focus-mode-sep'

/**
 * Matches View › Focus Mode to the settings: there only while focus is offered
 * in Settings (disabled too, so its shortcut can't fire), ticked while it's on.
 */
export function syncFocusMenu({ focusFeature, focusMode }: AppSettings) {
  const menu = Menu.getApplicationMenu()
  const item = menu?.getMenuItemById(FOCUS_ITEM_ID)
  const sep = menu?.getMenuItemById(FOCUS_SEP_ID)
  if (item) {
    item.visible = focusFeature
    item.enabled = focusFeature
    item.checked = focusMode
  }
  if (sep) sep.visible = focusFeature
}

/** A new GitHub issue with the app and macOS versions filled in. */
function bugReportUrl(): string {
  const body = [
    '**What happened?**',
    '',
    '',
    '**What did you expect to happen?**',
    '',
    '',
    '**Steps to reproduce**',
    '',
    '',
    '---',
    `Nodus ${app.getVersion()} · macOS ${process.getSystemVersion()} · ${process.arch}`
  ].join('\n')
  return `${REPO_URL}/issues/new?${new URLSearchParams({ body })}`
}

/**
 * Application menu. File-menu shortcuts are forwarded to the renderer as menu
 * commands so they work even while a terminal has focus; Cmd+W never closes
 * the window.
 */
export function installMenu(send: (command: MenuCommand) => void) {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        // Settings shows how the check goes, and the download after it.
        {
          label: 'Check for Updates…',
          click: () => {
            send('settings')
            void check(true)
          }
        },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        // Quitting leaves sessions running in the session host.
        { role: 'quit' },
        {
          label: 'Quit and Stop Sessions',
          accelerator: 'Alt+CmdOrCtrl+Q',
          click: () => void stopAll().finally(() => app.quit())
        }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Session', accelerator: 'CmdOrCtrl+N', click: () => send('new-session') },
        { label: 'New Terminal', accelerator: 'CmdOrCtrl+T', click: () => send('new-terminal') },
        { label: 'New Project…', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('new-project') },
        { type: 'separator' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', click: () => send('close') }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        // The board takes ⌘K itself, so a focused terminal can keep it for clearing.
        {
          label: 'Search Sessions…',
          accelerator: 'CmdOrCtrl+K',
          registerAccelerator: false,
          click: () => send('search')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          id: FOCUS_ITEM_ID,
          label: 'Focus Mode',
          type: 'checkbox',
          checked: getState().settings.focusMode,
          visible: getState().settings.focusFeature,
          enabled: getState().settings.focusFeature,
          accelerator: 'CmdOrCtrl+Shift+F',
          // The tick follows the setting the window saves, so undo the one macOS already toggled.
          click: (item) => {
            item.checked = getState().settings.focusMode
            send('toggle-focus')
          }
        },
        { id: FOCUS_SEP_ID, type: 'separator', visible: getState().settings.focusFeature },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'windowMenu'
    },
    {
      role: 'help',
      submenu: [
        { label: 'Star on GitHub', click: () => void shell.openExternal(REPO_URL) },
        { label: 'Report a Bug…', click: () => void shell.openExternal(bugReportUrl()) }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
