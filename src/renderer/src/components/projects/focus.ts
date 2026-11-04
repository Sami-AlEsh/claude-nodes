import type { AppSettings, Project, ProjectStats } from '@shared/types'

/** Whether focus mode is on: offered in Settings, and switched on in the title bar. */
export function focusModeOn(
  settings: Pick<AppSettings, 'focusFeature' | 'focusMode'> | null | undefined
): boolean {
  return !!settings?.focusFeature && !!settings.focusMode
}

/**
 * Whether focus mode is narrowing the project lists: it's on, and some project
 * (not archived) is in focus. With nothing in focus, every project shows.
 */
export function isFocusing(projects: Project[], focusMode: boolean | undefined): boolean {
  return !!focusMode && projects.some((p) => p.focused && !p.archived)
}

/**
 * Whether a project shows while focusing: it's in focus, one of its sessions is
 * waiting on the user (so nothing that needs you goes out of sight), or it's
 * `openId`, the project whose board is open.
 */
export function showsInFocus(project: Project, stats?: ProjectStats, openId?: string): boolean {
  return !!project.focused || (stats?.waiting ?? 0) > 0 || project.id === openId
}
