import type { ProjectAction, SessionCard } from '@shared/types'
import { truncate } from '@renderer/components/board/layout'

/** What a run is doing, as its tile's dot and the Actions button's dot say. */
export type RunState = 'working' | 'waiting'

/** The stack above the Actions button, top to bottom: action tiles, the dividers between blocks, and +. */
export type StackItem =
  | { kind: 'action'; action: ProjectAction; run?: SessionCard }
  | { kind: 'divider'; key: string }
  | { kind: 'new' }

/** What a run's card says it is doing, as the rail's fan said it. */
export const runLabel = { working: 'Working', waiting: 'Needs you', done: 'Finishing' } as const

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
 * The stack, top to bottom, as the rail had it: the project's own actions,
 * then the global ones, each block closed by a divider, then +, which so
 * sits just above the button.
 */
export function stackItems(
  own: readonly ProjectAction[],
  global: readonly ProjectAction[],
  runs: ReadonlyMap<string, SessionCard>
): StackItem[] {
  const items: StackItem[] = []
  for (const [key, block] of [
    ['own', own],
    ['global', global]
  ] as const) {
    if (!block.length) continue
    for (const action of block) items.push({ kind: 'action', action, run: runs.get(action.id) })
    items.push({ kind: 'divider', key })
  }
  items.push({ kind: 'new' })
  return items
}

/** The line under an action's name in its hint: where it shows, and what it does. */
export function hintDetail(action: ProjectAction): string {
  return [action.global && 'Every project', truncate(action.description || 'Right-click to edit', 80)]
    .filter(Boolean)
    .join(' · ')
}

/** What a run is doing, for its card beside the stack. */
export function runStep(card: SessionCard): string {
  if (card.status === 'waiting') return 'It needs you. Open it to answer'
  return card.meta?.lastAssistantText ? truncate(card.meta.lastAssistantText, 140) : 'Starting…'
}

/**
 * Where a tile's hint or run card goes: beside the stack on its right, `gap`
 * from it, or on its left when a `width`-wide one wouldn't fit in the window.
 */
export function besideStack(
  stack: { left: number; right: number },
  windowWidth: number,
  width: number,
  gap: number
): { left: number } | { right: number } {
  if (stack.right + gap + width <= windowWidth - 8) return { left: stack.right + gap }
  return { right: windowWidth - stack.left + gap }
}

/** A run card's top: level with its tile, kept 8 px inside the window. */
export function cardTop(tileTop: number, height: number, windowHeight: number): number {
  return Math.max(8, Math.min(tileTop - 4, windowHeight - height - 8))
}

/**
 * Where an arrow key moves the focus among `count` tiles, from `current`
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
