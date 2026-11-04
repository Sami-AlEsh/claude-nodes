// Geometry for the ink drawn on the board (InkLayer.tsx): paths to draw,
// bounds, and what's under the pointer. Everything is in board coordinates.
import type { InkStroke } from '@shared/types'

/** A pen line and an arrow's shaft, and its head, at size 1 (board units). */
export const PEN_WIDTH = 3
export const ARROW_HEAD = 14
/** A label's type at size 1 (ink.css sets the rest of the font). */
export const LABEL_FONT = 16
export const LABEL_LINE = 20

export type Pt = [number, number]

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function pointsOf(s: InkStroke): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i + 1 < s.points.length; i += 2) out.push([s.points[i], s.points[i + 1]])
  return out
}

export const flatten = (pts: Pt[]) => pts.flatMap(([x, y]) => [r1(x), r1(y)])

export const distance = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** How far `p` is from the segment `a`–`b`. */
export function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

/** A smooth path through a pen stroke: curves between the midpoints, so its corners round off. */
export function penPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  const [x0, y0] = pts[0]
  // A dot: a zero-length line still draws its round caps.
  if (pts.length === 1) return `M${x0} ${y0}h0.01`
  if (pts.length === 2) return `M${x0} ${y0}L${pts[1][0]} ${pts[1][1]}`
  let d = `M${x0} ${y0}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    d += `Q${x} ${y} ${r1((x + nx) / 2)} ${r1((y + ny) / 2)}`
  }
  const [lx, ly] = pts[pts.length - 1]
  return `${d}L${lx} ${ly}`
}

/** A straight arrow from `a` to `b`, its head two strokes back from the tip. */
export function arrowPath(a: Pt, b: Pt, head: number): string {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  const wing = (turn: number) =>
    `${r1(b[0] - head * Math.cos(angle + turn))} ${r1(b[1] - head * Math.sin(angle + turn))}`
  return `M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${wing(-0.45)}L${b[0]} ${b[1]}L${wing(0.45)}`
}

/** Drops the points that stray less than `tolerance` from the line through their neighbours (Douglas–Peucker). */
export function simplify(pts: Pt[], tolerance: number): Pt[] {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [from, to] = stack.pop()!
    let worst = -1
    let far = 0
    for (let i = from + 1; i < to; i++) {
      const d = segmentDistance(pts[i], pts[from], pts[to])
      if (d > far) {
        far = d
        worst = i
      }
    }
    if (worst > 0 && far > tolerance) {
      keep[worst] = 1
      stack.push([from, worst], [worst, to])
    }
  }
  return pts.filter((_, i) => keep[i])
}

let measureCtx: CanvasRenderingContext2D | null | undefined
let labelFamily = ''

/** How wide a label is, measured in the font ink.css draws it in. */
export function labelWidth(text: string, size: number): number {
  const px = LABEL_FONT * size
  if (measureCtx === undefined) {
    measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    if (measureCtx) labelFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim()
  }
  if (!measureCtx) return text.length * px * 0.56
  measureCtx.font = `600 ${px}px ${labelFamily || 'sans-serif'}`
  return measureCtx.measureText(text).width
}

const boxes = new WeakMap<InkStroke, Box>()

/** The box a stroke covers, its line's thickness included. */
export function strokeBox(s: InkStroke): Box {
  const cached = boxes.get(s)
  if (cached) return cached
  let box: Box
  const pts = pointsOf(s)
  if (s.kind === 'text') {
    const [x, y] = pts[0]
    box = { x, y, w: labelWidth(s.text ?? '', s.size), h: LABEL_LINE * s.size }
  } else {
    const pad = (s.kind === 'arrow' ? ARROW_HEAD : PEN_WIDTH / 2) * s.size
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const x = Math.min(...xs) - pad
    const y = Math.min(...ys) - pad
    box = { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y }
  }
  boxes.set(s, box)
  return box
}

/** Whether `p` is on the stroke, or within `tolerance` of its line. */
export function hitStroke(s: InkStroke, p: Pt, tolerance: number): boolean {
  const b = strokeBox(s)
  if (p[0] < b.x - tolerance || p[0] > b.x + b.w + tolerance || p[1] < b.y - tolerance || p[1] > b.y + b.h + tolerance) {
    return false
  }
  // A label is hit anywhere in its box.
  if (s.kind === 'text') return true
  const pts = pointsOf(s)
  const reach = tolerance + (PEN_WIDTH * s.size) / 2
  if (pts.length === 1) return distance(p, pts[0]) <= reach
  for (let i = 1; i < pts.length; i++) if (segmentDistance(p, pts[i - 1], pts[i]) <= reach) return true
  // An arrow's head is part of it too.
  return s.kind === 'arrow' && distance(p, pts[1]) <= ARROW_HEAD * s.size
}

/** The topmost stroke under `p`. Labels draw above lines, so they're found first. */
export function strokeAt(strokes: InkStroke[], p: Pt, tolerance: number): InkStroke | undefined {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokes[i].kind === 'text' && hitStroke(strokes[i], p, tolerance)) return strokes[i]
  }
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokes[i].kind !== 'text' && hitStroke(strokes[i], p, tolerance)) return strokes[i]
  }
  return undefined
}

/** The strokes an eraser dragged from `a` to `b` touches. */
export function strokesAlong(strokes: InkStroke[], a: Pt, b: Pt, tolerance: number): Set<string> {
  const steps = Math.max(1, Math.ceil(distance(a, b) / Math.max(tolerance / 2, 0.5)))
  const hit = new Set<string>()
  for (const s of strokes) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      if (hitStroke(s, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], tolerance)) {
        hit.add(s.id)
        break
      }
    }
  }
  return hit
}

export function translate(s: InkStroke, dx: number, dy: number): InkStroke {
  return { ...s, points: s.points.map((n, i) => r1(n + (i % 2 === 0 ? dx : dy))) }
}
