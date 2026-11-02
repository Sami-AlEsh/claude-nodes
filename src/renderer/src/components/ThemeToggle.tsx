import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useApp } from '@renderer/store'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Whether the app is drawn dark right now. nativeTheme drives the renderer's
 * prefers-color-scheme, so this follows the theme setting, and the macOS
 * appearance while the setting is System.
 */
function useDarkColors(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = () => setDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return dark
}

/** Flips the app between light and dark from the title bar. Settings still offers System. */
export function ThemeToggle() {
  const dark = useDarkColors()
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      className="btn btn-ghost btn-icon titlebar-theme"
      onClick={() => useApp.getState().updateSettings({ theme: dark ? 'light' : 'dark' })}
      title={label}
      aria-label={label}
    >
      {dark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </button>
  )
}
