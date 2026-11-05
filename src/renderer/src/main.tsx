import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import '@xterm/xterm/css/xterm.css'
import './styles/fonts.css'
import './styles/global.css'
import './styles/app.css'
import { App } from './App'
import { followSchemes } from './schemes'
import { followTerminalFont, loadBundledFonts } from './terminal/font'

followSchemes()
followTerminalFont()

// The terminal's fonts first: xterm measures its font when a terminal is
// created, and terminals are created synchronously once the app is drawn.
void loadBundledFonts().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
)
