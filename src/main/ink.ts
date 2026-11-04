// Ink drawn on the board with the ink tools (InkLayer.tsx). The renderer sends
// the whole list whenever it changes, so it's checked here before it's saved.
import { INK_COLORS, INK_KINDS, type InkStroke } from '@shared/types'

/** How many strokes a board keeps; past this, the oldest go first. */
export const INK_MAX_STROKES = 2000
/** How many points a pen stroke keeps. */
export const INK_MAX_POINTS = 2000
/** How much text a label keeps. */
export const INK_MAX_TEXT = 500

const round = (n: number) => Math.round(n * 10) / 10
const clampSize = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.min(10, Math.max(0.25, n)) * 100) / 100 : 1

/** How many numbers each kind of stroke has: a path, an arrow's two ends, a label's corner. */
function pointsFor(kind: InkStroke['kind'], points: number[]): number[] | null {
  if (points.length < 2 || points.length % 2 !== 0) return null
  if (kind === 'pen') return points.slice(0, INK_MAX_POINTS * 2)
  if (kind === 'arrow') return points.length === 4 ? points : null
  return points.length === 2 ? points : null
}

/** The strokes worth keeping, cleaned up. Anything malformed is dropped. */
export function cleanInk(raw: unknown): InkStroke[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: InkStroke[] = []
  for (const item of raw.slice(-INK_MAX_STROKES)) {
    if (!item || typeof item !== 'object') continue
    const { id, kind, color, points, size, text } = item as Partial<InkStroke>
    if (typeof id !== 'string' || !id || id.length > 64 || seen.has(id)) continue
    if (!kind || !INK_KINDS.includes(kind) || !color || !INK_COLORS.includes(color)) continue
    if (!Array.isArray(points) || !points.every((n) => typeof n === 'number' && Number.isFinite(n))) continue
    const kept = pointsFor(kind, points)
    if (!kept) continue
    const words = kind === 'text' && typeof text === 'string' ? text.trim().slice(0, INK_MAX_TEXT) : ''
    if (kind === 'text' && !words) continue
    seen.add(id)
    out.push({ id, kind, color, points: kept.map(round), size: clampSize(size), ...(words ? { text: words } : {}) })
  }
  return out
}
