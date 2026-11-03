import { create } from 'zustand'
import type { Project, ProjectGroup } from '@shared/types'
import { useApp } from '@renderer/store'
import { focusModeOn, isFocusing } from './focus'

interface ProjectsUiState {
  /** Selected folder in the projects grid. */
  selectedId: string | null
  /** Transient message shown at the bottom of the projects view. */
  toast: string | null
  select(id: string | null): void
  showToast(message: string): void
}

let toastTimer: number | undefined

export const useProjectsUi = create<ProjectsUiState>((set) => ({
  selectedId: null,
  toast: null,
  select: (id) => set({ selectedId: id }),
  showToast(message) {
    window.clearTimeout(toastTimer)
    set({ toast: message })
    toastTimer = window.setTimeout(() => set({ toast: null }), 3500)
  }
}))

const folderName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

/**
 * Adds a project (from a path, or via the native folder picker when omitted),
 * selects it and shows it in the projects grid, or with `open`, opens its board.
 */
export async function addProject(
  repoPath?: string,
  { open = false }: { open?: boolean } = {}
): Promise<Project | null> {
  const ui = useProjectsUi.getState()
  let project: Project | null
  try {
    project = await window.api.projects.add(repoPath)
  } catch {
    ui.showToast(
      repoPath
        ? `Couldn’t add “${folderName(repoPath)}”. Only folders can be projects.`
        : 'Couldn’t add that folder.'
    )
    return null
  }
  if (!project) return null

  // A project added while focusing joins the focus, or it would vanish as it arrives.
  const { projects, settings } = useApp.getState()
  if (isFocusing(projects, focusModeOn(settings)) && !project.focused) {
    await window.api.projects.update(project.id, { focused: true })
  }

  if (open) {
    await useApp.getState().refreshProjects()
    const { route, navigate } = useApp.getState()
    if (route.view !== 'board' || route.projectId !== project.id) {
      navigate({ view: 'board', projectId: project.id })
    }
    return project
  }

  ui.select(project.id)
  const app = useApp.getState()
  if (app.route.view !== 'projects') app.navigate({ view: 'projects' })
  else await app.refreshProjects()
  return project
}

/** Sort order of the grid: most recently opened first, then newest. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0) || b.createdAt - a.createdAt
  )
}

/** Groups in the order they were created. */
export function sortGroups(groups: ProjectGroup[]): ProjectGroup[] {
  return [...groups].sort((a, b) => a.createdAt - b.createdAt)
}

/** Splits projects (keeping their order) into the ungrouped ones and one list per group. */
export function groupProjects(projects: Project[], groups: ProjectGroup[]) {
  const known = new Set(groups.map((g) => g.id))
  return {
    ungrouped: projects.filter((p) => !p.groupId || !known.has(p.groupId)),
    byGroup: sortGroups(groups).map((group) => ({
      group,
      projects: projects.filter((p) => p.groupId === group.id)
    }))
  }
}

/** Files a project under a group, or takes it out of its group with null. */
export async function moveToGroup(projectId: string, groupId: string | null) {
  await window.api.projects.update(projectId, { groupId })
  await useApp.getState().refreshProjects()
}

/** Applies a change to a group right away, then saves it. */
export async function updateGroup(id: string, patch: { name?: string; collapsed?: boolean }) {
  useApp.setState((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
  await window.api.groups.update(id, patch)
}

/** Brings a project into focus, or takes it out. */
export async function setFocused(projectId: string, focused: boolean) {
  await window.api.projects.update(projectId, { focused })
  await useApp.getState().refreshProjects()
}

/** Flips the title bar's Focus switch; nothing while focus is turned off in Settings. */
export function toggleFocusMode() {
  const { settings, updateSettings } = useApp.getState()
  if (settings?.focusFeature) updateSettings({ focusMode: !settings.focusMode })
}

/** The letter embossed on a project's folder. */
export function projectGlyph(name: string): string | undefined {
  return name.match(/[\p{L}\p{N}]/u)?.[0]
}
