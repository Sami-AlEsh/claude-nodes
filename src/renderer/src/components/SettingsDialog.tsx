import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, X } from 'lucide-react'
import clsx from 'clsx'
import type { AppSettings, JiraAccountInfo, MouseMode, ThemePreference, UpdateStatus, VoiceKeySource } from '@shared/types'
import { DARK_SCHEMES, schemeColors, schemeTile, type Mode, type SchemeTile } from '@shared/schemes'
import {
  DEFAULT_TERMINAL_FONT,
  DEFAULT_TERMINAL_FONT_SIZE,
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  terminalFontFamily
} from '@shared/terminalFont'
import { useApp } from '@renderer/store'
import { installedFonts } from '@renderer/terminal/font'
import { forgetTickets, refreshTickets } from './panel/panelData'
import { errorText } from './panel/panelUi'
import { Modal } from './Modal'
import { MouseDemo } from './MouseDemo'
import { useUpdateStatus } from './UpdateButton'
import './SettingsDialog.css'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

/** Settings › Board › Mouse: what the demo above doesn't show of each choice. */
const MOUSE_MODES: { value: MouseMode; label: string; hint: string }[] = [
  {
    value: 'withKeyboard',
    label: 'Keyboard + mouse',
    hint: 'Scrolling the wheel pans, and middle-drag pans too.'
  },
  {
    value: 'mouseOnly',
    label: 'Mouse only',
    hint: 'Right-click still opens the menu; scrolling and middle-drag still pan.'
  }
]

/** App-wide preferences, opened with Cmd+, (Nodus › Settings…). */
export function SettingsDialog() {
  const open = useApp((s) => s.settingsOpen)
  const close = useApp((s) => s.closeSettings)

  return (
    // The panel handles Escape itself, so the key never reaches the views underneath.
    <Modal open={open} onClose={close} className="settings-dialog" labelledBy="settings-title" closeOnEscape={false}>
      <SettingsPanel onClose={close} />
    </Modal>
  )
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useApp((s) => s.settings)
  const update = useApp((s) => s.updateSettings)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    useApp.getState().loadSettings()
  }, [])

  // Take focus from whatever had it (often a terminal) and hand it back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => previous?.focus()
  }, [])

  // Opened for one section (the project panel's Connect Jira), scroll to it.
  useEffect(() => {
    const section = useApp.getState().settingsSection
    if (section) document.getElementById(`settings-${section}`)?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div
      ref={panelRef}
      className="settings-inner"
      tabIndex={-1}
      onKeyDown={(e) => {
        // Board and Projects shortcuts listen on window; keep them from firing underneath.
        e.stopPropagation()
        if (e.key === 'Escape') onClose()
        else if (e.key === 'Tab') trapTab(e, e.currentTarget)
      }}
    >
      <header className="settings-head">
        <h2 id="settings-title" className="settings-title">
          Settings
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close (Esc)" aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="settings-body">
        <fieldset className="settings-group">
          <legend className="settings-label">Appearance</legend>
          <div className="settings-themes">
            {THEMES.map((t) => (
              <label key={t.value} className="settings-theme">
                <input
                  type="radio"
                  name="theme"
                  className="settings-theme-input"
                  value={t.value}
                  checked={settings?.theme === t.value}
                  disabled={!settings}
                  onChange={() => update({ theme: t.value })}
                />
                <ThemePreview theme={t.value} settings={settings} />
                <span className="settings-theme-name">{t.label}</span>
              </label>
            ))}
          </div>
          <p className="settings-hint">System follows the appearance set in macOS.</p>
          <SchemeRow
            label="Dark colours"
            name="darkScheme"
            options={DARK_SCHEMES.map((s) => ({ ...s, tile: schemeTile(s.id) }))}
            value={settings?.darkScheme}
            disabled={!settings}
            onPick={(darkScheme) => update({ darkScheme })}
          />
          <label className="settings-row">
            <span className="settings-row-text">
              <span className="settings-row-title">Always show the project sidebar</span>
              <span className="settings-row-hint">When off, point at the window’s left edge to slide it in.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings?.pinProjectRail ?? false}
              disabled={!settings}
              onChange={(e) => update({ pinProjectRail: e.target.checked })}
            />
          </label>
        </fieldset>

        <fieldset className="settings-group">
          <legend className="settings-label">Board</legend>
          <div className="settings-row-text">
            <span className="settings-row-title" id="board-mouse-title">
              Mouse
            </span>
            <span className="settings-row-hint">
              How the mouse moves around the board. The trackpad works the same either way.
            </span>
          </div>
          <MouseDemo key={settings?.mouseMode ?? 'withKeyboard'} mode={settings?.mouseMode ?? 'withKeyboard'} />
          <div className="settings-choices" role="radiogroup" aria-labelledby="board-mouse-title">
            {MOUSE_MODES.map((c) => (
              <label key={c.value} className="settings-choice">
                <input
                  type="radio"
                  name="mouseMode"
                  className="settings-choice-input"
                  checked={(settings?.mouseMode ?? 'withKeyboard') === c.value}
                  disabled={!settings}
                  onChange={() => update({ mouseMode: c.value })}
                />
                <span className="settings-choice-name">{c.label}</span>
              </label>
            ))}
          </div>
          <p className="settings-hint settings-choice-hint">
            {MOUSE_MODES.find((c) => c.value === (settings?.mouseMode ?? 'withKeyboard'))?.hint}
          </p>
        </fieldset>

        <TerminalSettings settings={settings} update={update} />

        <fieldset className="settings-group">
          <legend className="settings-label">Focus</legend>
          <label className="settings-row">
            <span className="settings-row-text">
              <span className="settings-row-title">Focus mode</span>
              <span className="settings-row-hint">
                Adds a Focus switch to the title bar that shows only the projects in focus. Right-click a project
                and choose Add to Focus.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings?.focusFeature ?? false}
              disabled={!settings}
              onChange={(e) => update({ focusFeature: e.target.checked })}
            />
          </label>
        </fieldset>

        <fieldset className="settings-group">
          <legend className="settings-label">Notifications</legend>
          <label className="settings-row">
            <span className="settings-row-text">
              <span className="settings-row-title">Notify me when a session needs me or finishes</span>
              <span className="settings-row-hint">Only while Nodus is in the background. Click one to open its card.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings?.notify ?? false}
              disabled={!settings}
              onChange={(e) => update({ notify: e.target.checked })}
            />
          </label>
          <label className="settings-row">
            <span className="settings-row-text">
              <span className="settings-row-title">Count sessions that need me on the Dock icon</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings?.dockBadge ?? false}
              disabled={!settings}
              onChange={(e) => update({ dockBadge: e.target.checked })}
            />
          </label>
        </fieldset>

        <fieldset className="settings-group">
          <legend className="settings-label">Sessions</legend>
          <label className="settings-row">
            <span className="settings-row-text">
              <span className="settings-row-title">Show my status line</span>
              <span className="settings-row-hint">
                Runs the status line from your Claude Code settings at the bottom of each session. Applies to sessions
                you start or resume after changing it.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={settings?.showOwnStatusLine ?? false}
              disabled={!settings}
              onChange={(e) => update({ showOwnStatusLine: e.target.checked })}
            />
          </label>
        </fieldset>

        <VoiceSettings />

        <IntegrationSettings />

        <UpdateSettings settings={settings} update={update} />
      </div>
    </div>
  )
}

/**
 * The xAI key behind the board's mic button. The key itself never comes back
 * from the main process; only where it's from.
 */
function VoiceSettings() {
  /** undefined while loading. */
  const [source, setSource] = useState<VoiceKeySource | undefined>(undefined)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    window.api.voice.keySource().then((s) => !cancelled && setSource(s))
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (value: string | null) => {
    setError(null)
    try {
      setSource(await window.api.voice.setKey(value))
      setKey('')
      // Save goes disabled and Remove goes away; keep focus in the dialog so Esc still closes it.
      inputRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    }
  }

  return (
    <fieldset className="settings-group">
      <legend className="settings-label">Voice prompts</legend>
      <form
        className="settings-key"
        onSubmit={(e) => {
          e.preventDefault()
          if (key.trim()) void save(key)
        }}
      >
        <input
          ref={inputRef}
          type="password"
          className="settings-input"
          placeholder={source === 'settings' ? 'Replace the saved xAI API key' : 'xAI API key'}
          aria-label="xAI API key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={source === undefined}
        />
        <button type="submit" className="btn" disabled={!key.trim()}>
          Save
        </button>
      </form>
      <p className="settings-hint">
        {source === 'settings' ? (
          <>
            Saved in your Keychain.{' '}
            <button type="button" className="settings-link" onClick={() => void save(null)}>
              Remove
            </button>
          </>
        ) : source === 'env' ? (
          'Using XAI_API_KEY from your shell. A key saved here takes its place.'
        ) : (
          <>
            Add a key to speak prompts with the mic button. Get one at{' '}
            <a href="https://console.x.ai" target="_blank" rel="noreferrer">
              console.x.ai
            </a>
            .
          </>
        )}
      </p>
      <p className="settings-hint">Recordings are sent to xAI to be turned into text.</p>
      {error && <p className="settings-error">{error}</p>}
    </fieldset>
  )
}

const JIRA_TOKENS_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens'

/**
 * The accounts behind the project panel: Jira Cloud for its Tickets tab
 * (the token never comes back from the main process), and a word on the
 * GitHub CLI, which the PRs tab uses as it's signed in.
 */
function IntegrationSettings() {
  /** undefined while loading. */
  const [account, setAccount] = useState<JiraAccountInfo | null | undefined>(undefined)
  const [site, setSite] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.jira.account().then((a) => {
      if (cancelled) return
      setAccount(a)
      if (a) {
        setSite(a.site)
        setEmail(a.email)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The open board's tickets come from the account: read them again for the new one.
  const changed = (next: JiraAccountInfo | null) => {
    setAccount(next)
    forgetTickets()
    const { route } = useApp.getState()
    if (route.view === 'board') void refreshTickets(route.projectId)
  }

  const signIn = async () => {
    setSaving(true)
    setError(null)
    try {
      changed(await window.api.jira.setAccount({ site, email, token }))
      setToken('')
      setEditing(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    setError(null)
    try {
      changed(await window.api.jira.setAccount(null))
      setToken('')
    } catch (err) {
      setError(errorText(err))
    }
  }

  const showForm = account === null || editing
  return (
    <fieldset className="settings-group" id="settings-integrations">
      <legend className="settings-label">Integrations</legend>
      <div className="settings-row-text">
        <span className="settings-row-title">Jira Cloud</span>
        <span className="settings-row-hint">The project panel’s Tickets tab. Link a folder to a Jira project from there.</span>
      </div>
      {account && !editing && (
        <div className="settings-row settings-account">
          <span className="settings-row-text">
            <span className="settings-row-title">{account.displayName ?? account.email}</span>
            <span className="settings-row-hint">
              {account.email} on {account.site.replace(/^https?:\/\//, '')}
            </span>
          </span>
          <span className="settings-account-actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              Change…
            </button>
            <button type="button" className="btn" onClick={() => void signOut()}>
              Sign Out
            </button>
          </span>
        </div>
      )}
      {showForm && (
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (site.trim() && email.trim() && token.trim()) void signIn()
          }}
        >
          <input
            className="settings-input"
            placeholder="your-team.atlassian.net"
            aria-label="Jira site"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={account === undefined}
          />
          <input
            className="settings-input"
            type="email"
            placeholder="Email you sign in to Jira with"
            aria-label="Jira email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={account === undefined}
          />
          <div className="settings-key">
            <input
              type="password"
              className="settings-input"
              placeholder={account ? 'A new API token' : 'API token'}
              aria-label="Jira API token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={account === undefined}
            />
            <button type="submit" className="btn" disabled={saving || !site.trim() || !email.trim() || !token.trim()}>
              {saving ? 'Signing In…' : 'Sign In'}
            </button>
            {editing && (
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      {showForm && (
        <p className="settings-hint">
          Create an API token at{' '}
          <a href={JIRA_TOKENS_URL} target="_blank" rel="noreferrer">
            id.atlassian.com
          </a>
          . It’s saved in your Keychain, and Nodus only reads from Jira.
        </p>
      )}
      {error && <p className="settings-error">{error}</p>}
      <div className="settings-row-text settings-integration">
        <span className="settings-row-title">GitHub</span>
        <span className="settings-row-hint">
          The PRs tab uses the GitHub CLI as it’s signed in, so there’s nothing to set up here. Run{' '}
          <code className="settings-code">gh auth login</code> in a terminal if it isn’t.
        </span>
      </div>
    </fieldset>
  )
}

const RELEASES_URL = 'https://github.com/saleem-hadad/nodus/releases/latest'

/** The running version, how its update is going, and whether updates come by themselves. */
function UpdateSettings({
  settings,
  update
}: {
  settings: AppSettings | null
  update: (patch: Partial<AppSettings>) => void
}) {
  const status = useUpdateStatus()
  const busy = status?.state === 'checking' || status?.state === 'downloading'
  const text = status && updateText(status)

  return (
    <fieldset className="settings-group">
      <legend className="settings-label">Updates</legend>
      <div className="settings-row">
        <span className="settings-row-text">
          <span className="settings-row-title">Nodus {status?.current}</span>
          {text && <span className="settings-row-hint">{text}</span>}
        </span>
        {status?.state === 'ready' ? (
          <button type="button" className="btn btn-primary" onClick={() => window.api.updates.install()}>
            Restart to Update
          </button>
        ) : (
          status?.state !== 'off' && (
            <button type="button" className="btn" disabled={!status || busy} onClick={() => window.api.updates.check()}>
              Check Now
            </button>
          )
        )}
      </div>
      {status?.state !== 'off' && (
        <label className="settings-row">
          <span className="settings-row-text">
            <span className="settings-row-title">Download updates automatically</span>
            <span className="settings-row-hint">They install when you quit Nodus. Sessions keep running.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={settings?.autoUpdate ?? false}
            disabled={!settings}
            onChange={(e) => update({ autoUpdate: e.target.checked })}
          />
        </label>
      )}
      {status?.state === 'error' && (
        <p className="settings-hint">
          You can also{' '}
          <a href={RELEASES_URL} target="_blank" rel="noreferrer">
            download the latest version
          </a>{' '}
          yourself.
        </p>
      )}
    </fieldset>
  )
}

function updateText(status: UpdateStatus): string | null {
  switch (status.state) {
    case 'off':
      return status.reason
    case 'idle':
      return null
    case 'checking':
      return 'Checking for updates…'
    case 'latest':
      return 'You’re up to date.'
    case 'downloading':
      return `Downloading version ${status.version}… ${status.percent}%`
    case 'ready':
      return `Version ${status.version} is ready to install.`
    case 'error':
      return status.message
  }
}

/** Every whole size from the smallest to the largest. */
const FONT_SIZES = Array.from(
  { length: MAX_TERMINAL_FONT_SIZE - MIN_TERMINAL_FONT_SIZE + 1 },
  (_, i) => MIN_TERMINAL_FONT_SIZE + i
)

/**
 * The terminal's font and size, with a preview drawn like a shell prompt:
 * its arrows and branch sign come from the bundled symbols, so they show
 * whichever font is picked.
 */
function TerminalSettings({
  settings,
  update
}: {
  settings: AppSettings | null
  update: (patch: Partial<AppSettings>) => void
}) {
  // Measuring every candidate font is quick, but only worth doing once the dialog is open.
  const [fonts, setFonts] = useState<string[] | null>(null)
  useEffect(() => setFonts(installedFonts()), [])
  const font = settings?.terminalFont ?? DEFAULT_TERMINAL_FONT
  const size = settings?.terminalFontSize ?? DEFAULT_TERMINAL_FONT_SIZE
  // A saved font this Mac doesn't have stays selectable, so the setting isn't lost.
  const options = fonts === null ? [font] : fonts.includes(font) ? fonts : [font, ...fonts]

  return (
    <fieldset className="settings-group">
      <legend className="settings-label">Terminal</legend>
      <div className="settings-row">
        <span className="settings-row-text">
          <span className="settings-row-title">Font</span>
          <span className="settings-row-hint">The monospace fonts on this Mac. JetBrains Mono comes with Nodus.</span>
        </span>
        <select
          className="settings-select"
          aria-label="Terminal font"
          value={font}
          disabled={!settings || fonts === null}
          onChange={(e) => update({ terminalFont: e.target.value })}
        >
          {options.map((f) => (
            <option key={f} value={f}>
              {f}
              {fonts !== null && !fonts.includes(f) ? ' (not installed)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-row">
        <span className="settings-row-text">
          <span className="settings-row-title">Size</span>
        </span>
        <select
          className="settings-select settings-select-size"
          aria-label="Terminal font size"
          value={size}
          disabled={!settings}
          onChange={(e) => update({ terminalFontSize: Number(e.target.value) })}
        >
          {FONT_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} px
            </option>
          ))}
        </select>
      </div>
      <p className="settings-term-preview" style={{ fontFamily: terminalFontFamily(font), fontSize: size }} aria-hidden="true">
        <span className="settings-term-seg is-user">sami@mac</span>
        <span className="settings-term-arrow is-user">{'\uE0B0'}</span>
        <span className="settings-term-seg is-path">~/nodus</span>
        <span className="settings-term-arrow is-path">{'\uE0B0'}</span>
        <span className="settings-term-seg is-branch">{'\uE0A0 main'}</span>
        <span className="settings-term-arrow is-branch">{'\uE0B0'}</span>
        {' claude'}
      </p>
      <p className="settings-hint">Changes every open terminal at once.</p>
    </fieldset>
  )
}

/** Keeps Tab cycling inside the dialog instead of escaping to the page behind it. */
function trapTab(e: KeyboardEvent<HTMLElement>, panel: HTMLElement) {
  const stops = Array.from(panel.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input, select')).filter(
    (el) => !el.disabled && (el.type !== 'radio' || (el as HTMLInputElement).checked)
  )
  if (stops.length === 0) return
  const first = stops[0]
  const last = stops[stops.length - 1]
  const active = document.activeElement
  if (e.shiftKey ? active === first || active === panel : active === last) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  }
}

/**
 * A row of colour schemes for one mode, as tiles: each in the scheme's ground,
 * with a bar of its text colour and five of its colours.
 */
function SchemeRow<T extends string>({
  label,
  name,
  options,
  value,
  disabled,
  onPick
}: {
  label: string
  name: string
  options: { id: T; name: string; tile: SchemeTile }[]
  value: T | undefined
  disabled: boolean
  onPick: (id: T) => void
}) {
  return (
    <div className="settings-schemes" role="radiogroup" aria-label={label}>
      <span className="settings-schemes-label" aria-hidden="true">
        {label}
      </span>
      <div className="settings-scheme-tiles">
        {options.map((o) => (
          <label key={o.id} className="settings-theme settings-scheme">
            <input
              type="radio"
              name={name}
              className="settings-theme-input"
              value={o.id}
              checked={value === o.id}
              disabled={disabled}
              onChange={() => onPick(o.id)}
            />
            <span className="settings-preview scheme-tile" style={{ background: o.tile.background }} aria-hidden="true">
              <span className="scheme-tile-text" style={{ background: o.tile.text }} />
              <span className="scheme-tile-dots">
                {o.tile.dots.map((color, i) => (
                  <span key={i} className="scheme-tile-dot" style={{ background: color }} />
                ))}
              </span>
              <Check className="scheme-tile-check" size={11} strokeWidth={3} style={{ color: o.tile.text }} />
            </span>
            <span className="settings-theme-name">{o.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** A miniature board window in the theme's colours; System shows both, split diagonally. */
function ThemePreview({ theme, settings }: { theme: ThemePreference; settings: AppSettings | null }) {
  return (
    <span className="settings-preview" aria-hidden="true">
      {theme !== 'dark' && <MiniWindow tone="light" />}
      {theme !== 'light' && <MiniWindow tone="dark" scheme={settings?.darkScheme} split={theme === 'system'} />}
    </span>
  )
}

/** The dark preview in the colour scheme. Nodus's own colours are the stylesheet's. */
function schemeChrome(scheme: AppSettings['darkScheme'] | undefined) {
  if (!scheme || scheme === 'nodus') return undefined
  const c = schemeColors(scheme)
  return { '--mw-canvas': c.board, '--mw-bar': c.toolbar, '--mw-card': c.cards } as CSSProperties
}

function MiniWindow({
  tone,
  scheme,
  split
}: {
  tone: Mode
  scheme?: AppSettings['darkScheme']
  split?: boolean
}) {
  return (
    <span className={clsx('mini-window', `is-${tone}`, split && 'is-split')} style={schemeChrome(scheme)}>
      <span className="mini-bar">
        <span className="mini-light" />
        <span className="mini-light" />
        <span className="mini-light" />
      </span>
      <span className="mini-canvas">
        {(['working', 'done'] as const).map((status) => (
          <span key={status} className="mini-card">
            <span className="mini-dot" data-status={status} />
            <span className="mini-line" />
            <span className="mini-line is-short" />
          </span>
        ))}
      </span>
    </span>
  )
}
