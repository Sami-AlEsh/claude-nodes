import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, X } from 'lucide-react'
import type { JiraProjectInfo } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useApp } from '@renderer/store'
import { refreshTickets } from './panelData'
import { errorText } from './panelUi'

/**
 * Picks the Jira project whose tickets belong to the project folder, from
 * the projects the account in Settings can see. Saved with the project.
 */
export function JiraLinkDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const linked = useApp((s) => s.projects.find((p) => p.id === projectId)?.jira?.key ?? s.board?.project.jira?.key)
  const [projects, setProjects] = useState<JiraProjectInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    window.api.jira.projects().then(
      (list) => !cancelled && setProjects(list),
      (err: unknown) => !cancelled && setError(errorText(err))
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  useEffect(() => inputRef.current?.focus(), [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!projects || !q) return projects ?? []
    return projects.filter((p) => p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
  }, [projects, query])

  const link = async (key: string | null) => {
    setSaving(true)
    try {
      await useApp.getState().setProjectJira(projectId, key ? { key } : null)
      await refreshTickets(projectId)
      onClose()
    } catch (err) {
      setError(errorText(err))
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} className="panel-link-dialog" labelledBy="jira-link-title">
      <div
        className="panel-link-inner"
        // The board's shortcuts listen on window: typing a filter mustn't start sessions.
        // That keeps Escape from the Modal too, so it's handled here.
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onClose()
        }}
      >
        <header className="panel-link-head">
          <div>
            <h2 id="jira-link-title" className="panel-link-title">
              Link a Jira project
            </h2>
            <p className="panel-link-sub">Its tickets show in this folder’s panel.</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="panel-link-search">
          <input
            ref={inputRef}
            className="settings-input"
            placeholder="Filter projects"
            aria-label="Filter projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown.length === 1 && !saving) void link(shown[0].key)
            }}
            spellCheck={false}
          />
        </div>
        <div className="panel-link-list" role="listbox" aria-label="Jira projects">
          {error ? (
            <div className="panel-link-note">
              <p className="panel-error">{error}</p>
              <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : !projects ? (
            <div className="panel-link-note">Loading projects…</div>
          ) : shown.length === 0 ? (
            <div className="panel-link-note">{projects.length ? 'No project matches.' : 'This account can’t see any projects.'}</div>
          ) : (
            shown.map((p) => (
              <button
                key={p.key}
                role="option"
                aria-selected={p.key === linked}
                className={clsx('panel-link-item', p.key === linked && 'is-linked')}
                disabled={saving}
                onClick={() => void link(p.key)}
              >
                <span className="panel-key">{p.key}</span>
                <span className="panel-link-name">{p.name}</span>
                {p.teamManaged && <span className="panel-link-kind">Team-managed</span>}
                {p.key === linked && <Check size={14} strokeWidth={2.4} className="panel-link-check" />}
              </button>
            ))
          )}
        </div>
        {linked && (
          <footer className="panel-link-foot">
            <span>
              Linked to <span className="panel-key">{linked}</span>
            </span>
            <button className="btn" disabled={saving} onClick={() => void link(null)}>
              Unlink
            </button>
          </footer>
        )}
      </div>
    </Modal>
  )
}
