import type { ProjectAction, SessionCard } from '@shared/types'

/** What a run is doing, as its row in the menu and the Actions button's dot say. */
export type RunState = 'working' | 'waiting'

export type MenuRow =
  | { kind: 'action'; action: ProjectAction; run?: SessionCard }
  | { kind: 'divider'; key: string }
  | { kind: 'new' }

/** Each action's run, by action id. A run that was archived has gone. */
export function runsByAction(cards: readonly SessionCard[] | undefined): Map<string, SessionCard> {
  const out = new Map<string, SessionCard>()
  for (const c of cards ?? []) if (c.runOf && !c.archived) out.set(c.runOf, c)
  return out
}

/** A run needs you while it waits on a question, and is working otherwise, finishing included. */
export function runState(card: SessionCard): RunState {
  return card.status === 'waiting' ? 'waiting' : 'working'
}

/** The button's dot: red while any run needs you, orange while any is going, and none without a run. */
export function buttonStatus(runs: Iterable<SessionCard>): RunState | undefined {
  let status: RunState | undefined
  for (const run of runs) {
    if (runState(run) === 'waiting') return 'waiting'
    status = 'working'
  }
  return status
}

/**
 * The menu, top to bottom: the project's own actions, then the global ones,
 * then New action, with a divider between each group that has something in it.
 */
export function menuRows(
  own: readonly ProjectAction[],
  global: readonly ProjectAction[],
  runs: ReadonlyMap<string, SessionCard>
): MenuRow[] {
  const rows: MenuRow[] = []
  for (const [key, block] of [
    ['own', own],
    ['global', global]
  ] as const) {
    if (!block.length) continue
    if (rows.length) rows.push({ kind: 'divider', key })
    for (const action of block) rows.push({ kind: 'action', action, run: runs.get(action.id) })
  }
  if (rows.length) rows.push({ kind: 'divider', key: 'new' })
  rows.push({ kind: 'new' })
  return rows
}

/**
 * Where an arrow key moves the focus among `count` items, from `current`
 * (-1 for none): down and up wrap around, Home and End go to the ends.
 * Null for any other key.
 */
export function stepIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
