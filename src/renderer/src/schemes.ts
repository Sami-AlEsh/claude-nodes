// Puts the colour schemes picked in Settings on the board, and on the views'
// pages already open. The colours themselves come from @shared/schemes.
import { schemeCss, viewCss, type Schemes } from '@shared/schemes'
import { setViewTheme } from './components/board/viewRelay'
import { useApp } from './store'

let shown = ''

function show(schemes: Schemes) {
  const key = `${schemes.darkScheme}/${schemes.lightScheme}`
  if (key === shown) return
  shown = key
  let style = document.getElementById('color-schemes')
  if (!style) {
    style = document.createElement('style')
    style.id = 'color-schemes'
    document.head.appendChild(style)
  }
  style.textContent = schemeCss(schemes)
  setViewTheme(viewCss(schemes))
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
