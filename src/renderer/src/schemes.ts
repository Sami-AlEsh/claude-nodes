// Puts the colour scheme picked in Settings on the board, on the views'
// pages already open, and on the terminals. The colours themselves come
// from @shared/schemes.
import { schemeCss, terminalTheme, viewCss, type Schemes } from '@shared/schemes'
import { setViewTheme } from './components/board/viewRelay'
import { setTerminalTheme } from './terminal/registry'
import { useApp } from './store'

let shown = ''

function show(schemes: Schemes) {
  if (schemes.darkScheme === shown) return
  shown = schemes.darkScheme
  let style = document.getElementById('color-schemes')
  if (!style) {
    style = document.createElement('style')
    style.id = 'color-schemes'
    document.head.appendChild(style)
  }
  style.textContent = schemeCss(schemes)
  setViewTheme(viewCss(schemes))
  setTerminalTheme(terminalTheme(schemes.darkScheme))
}

/**
 * Shows the saved schemes before anything is drawn, so the window opens in
 * them without a flash of Nodus's own colours, then follows Settings.
 */
export function followSchemes() {
  show(window.api.settings.getSync())
  useApp.subscribe((state) => {
    if (state.settings) show(state.settings)
  })
}
