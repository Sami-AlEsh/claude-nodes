import { describe, expect, it } from 'vitest'
import { INK_MAX_POINTS, INK_MAX_STROKES, INK_MAX_TEXT, cleanInk } from './ink'

const pen = (id: string, points = [0, 0, 10, 10]) => ({ id, kind: 'pen', color: 'red', points, size: 1 })

describe('cleanInk', () => {
  it('keeps pen strokes, arrows and labels, rounding their points', () => {
    const ink = cleanInk([
      pen('a', [0.123, 1.987, 5, 5]),
      { id: 'b', kind: 'arrow', color: 'blue', points: [0, 0, 40, 20], size: 2 },
      { id: 'c', kind: 'text', color: 'graphite', points: [12, 34], size: 1, text: '  needs a design pass ' }
    ])
    expect(ink).toEqual([
      { id: 'a', kind: 'pen', color: 'red', points: [0.1, 2, 5, 5], size: 1 },
      { id: 'b', kind: 'arrow', color: 'blue', points: [0, 0, 40, 20], size: 2 },
      { id: 'c', kind: 'text', color: 'graphite', points: [12, 34], size: 1, text: 'needs a design pass' }
    ])
  })

  it('drops anything malformed', () => {
    expect(
      cleanInk([
        null,
        'pen',
        { ...pen('a'), kind: 'laser' },
        { ...pen('b'), color: 'pink' },
        pen('c', [0, 0, 10]),
        pen('d', [0, NaN]),
        pen('e', []),
        { id: 'f', kind: 'arrow', color: 'red', points: [0, 0, 1, 1, 2, 2], size: 1 },
        { id: 'g', kind: 'text', color: 'red', points: [0, 0], size: 1, text: '   ' },
        { ...pen(''), id: '' },
        pen('h'),
        pen('h')
      ]).map((s) => s.id)
    ).toEqual(['h'])
    expect(cleanInk('nope')).toEqual([])
  })

  it('keeps sizes sensible', () => {
    const [a, b, c] = cleanInk([{ ...pen('a'), size: 100 }, { ...pen('b'), size: -1 }, { ...pen('c'), size: undefined }])
    expect([a.size, b.size, c.size]).toEqual([10, 0.25, 1])
  })

  it('caps how much a board keeps', () => {
    const many = Array.from({ length: INK_MAX_STROKES + 5 }, (_, i) => pen(`s${i}`))
    const kept = cleanInk(many)
    expect(kept).toHaveLength(INK_MAX_STROKES)
    expect(kept[0].id).toBe('s5')

    const long = Array.from({ length: (INK_MAX_POINTS + 10) * 2 }, (_, i) => i)
    expect(cleanInk([pen('long', long)])[0].points).toHaveLength(INK_MAX_POINTS * 2)

    const words = 'x'.repeat(INK_MAX_TEXT + 50)
    expect(cleanInk([{ id: 't', kind: 'text', color: 'red', points: [0, 0], size: 1, text: words }])[0].text).toHaveLength(
      INK_MAX_TEXT
    )
  })
})
