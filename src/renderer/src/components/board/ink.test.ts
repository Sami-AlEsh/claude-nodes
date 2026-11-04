import { describe, expect, it } from 'vitest'
import type { InkStroke } from '@shared/types'
import { arrowPath, hitStroke, penPath, simplify, strokeAt, strokesAlong, translate, type Pt } from './ink'

const pen = (id: string, points: number[], size = 1): InkStroke => ({ id, kind: 'pen', color: 'red', points, size })

describe('penPath', () => {
  it('draws a dot, a line, and curves through the midpoints', () => {
    expect(penPath([[1, 2]])).toBe('M1 2h0.01')
    expect(penPath([[0, 0], [10, 0]])).toBe('M0 0L10 0')
    expect(penPath([[0, 0], [10, 0], [10, 10]])).toBe('M0 0Q10 0 10 5L10 10')
  })
})

describe('arrowPath', () => {
  it('puts the head on the tip', () => {
    const d = arrowPath([0, 0], [100, 0], 10)
    expect(d.startsWith('M0 0L100 0M')).toBe(true)
    expect(d).toContain('L100 0L')
  })
})

describe('simplify', () => {
  it('drops points on a straight line and keeps corners', () => {
    const line: Pt[] = [[0, 0], [1, 0.01], [2, 0], [3, 0.02], [4, 0]]
    expect(simplify(line, 0.5)).toEqual([[0, 0], [4, 0]])
    const corner: Pt[] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]
    expect(simplify(corner, 0.5)).toEqual([[0, 0], [10, 0], [10, 10]])
  })
})

describe('hitStroke', () => {
  const line = pen('a', [0, 0, 100, 0])

  it('hits near the line, not away from it', () => {
    expect(hitStroke(line, [50, 4], 3)).toBe(true)
    expect(hitStroke(line, [50, 9], 3)).toBe(false)
    expect(hitStroke(line, [120, 0], 3)).toBe(false)
  })

  it('reaches further for thicker ink', () => {
    expect(hitStroke(pen('b', [0, 0, 100, 0], 4), [50, 9], 3)).toBe(true)
  })

  it('hits a label anywhere in its box', () => {
    const label: InkStroke = { id: 't', kind: 'text', color: 'blue', points: [10, 10], size: 1, text: 'Ship it' }
    expect(hitStroke(label, [14, 20], 0)).toBe(true)
    expect(hitStroke(label, [14, 40], 0)).toBe(false)
  })
})

describe('strokeAt', () => {
  it('finds the topmost stroke, labels first', () => {
    const under = pen('under', [0, 0, 100, 0])
    const over = pen('over', [0, 0, 100, 0])
    expect(strokeAt([under, over], [50, 0], 3)?.id).toBe('over')
    const label: InkStroke = { id: 't', kind: 'text', color: 'blue', points: [40, -10], size: 1, text: 'here' }
    expect(strokeAt([label, under], [45, 0], 3)?.id).toBe('t')
    expect(strokeAt([under], [50, 50], 3)).toBeUndefined()
  })
})

describe('strokesAlong', () => {
  it('catches strokes the eraser passes over between two pointer events', () => {
    const strokes = [pen('a', [50, -20, 50, 20]), pen('b', [200, -20, 200, 20])]
    expect([...strokesAlong(strokes, [0, 0], [100, 0], 3)]).toEqual(['a'])
  })
})

describe('translate', () => {
  it('moves every point', () => {
    expect(translate(pen('a', [0, 0, 10, 20]), 5, -5).points).toEqual([5, -5, 15, 15])
  })
})
