import { describe, expect, it } from 'vitest'
import {
  PANEL_DEFAULT_W,
  PANEL_MAX_W,
  PANEL_MIN_W,
  clampPanelWidth,
  fitPanelWidth,
  normalizePanel,
  prForIssue
} from './panel'
import type { PullRequestRow } from './types'

const pr = (number: number, headRef: string, state: PullRequestRow['state'] = 'open'): PullRequestRow => ({
  number,
  title: `PR ${number}`,
  url: `https://github.com/o/r/pull/${number}`,
  state,
  headRef,
  baseRef: 'main',
  author: { login: 'octocat' },
  mine: false,
  needsMyReview: false,
  comments: 0,
  updatedAt: 0
})

describe('panel settings', () => {
  it('keeps the width within the panel’s range, in whole pixels', () => {
    expect(clampPanelWidth(100)).toBe(PANEL_MIN_W)
    expect(clampPanelWidth(5000)).toBe(PANEL_MAX_W)
    expect(clampPanelWidth(401.6)).toBe(402)
  })

  it('folds the panel to its strip unless it was left open, at the default width unless one was dragged', () => {
    expect(normalizePanel({})).toEqual({ panelOpen: false, panelWidth: PANEL_DEFAULT_W })
    expect(normalizePanel({ panelOpen: true, panelWidth: 500 })).toEqual({ panelOpen: true, panelWidth: 500 })
  })

  it('cuts the width down so the board keeps its minimum, and gives it back in a wider window', () => {
    // The smallest window, with the project rail pinned: 960 − 52 − 480 (board) = 428.
    expect(fitPanelWidth(640, 960, 52)).toBe(428)
    expect(fitPanelWidth(360, 960, 52)).toBe(360)
    expect(fitPanelWidth(640, 1440)).toBe(640)
    // Never below the panel's own minimum, even if the board then gets less.
    expect(fitPanelWidth(640, 700)).toBe(PANEL_MIN_W)
  })

  it('drops values it doesn’t understand', () => {
    const odd = { panelOpen: 'yes', panelWidth: Number.NaN } as unknown as Parameters<typeof normalizePanel>[0]
    expect(normalizePanel(odd)).toEqual({ panelOpen: false, panelWidth: PANEL_DEFAULT_W })
    expect(normalizePanel({ panelWidth: 9000 }).panelWidth).toBe(PANEL_MAX_W)
  })
})

describe('prForIssue', () => {
  const prs = [pr(12, 'feature/nds-42-terminal-font'), pr(14, 'NDS-43'), pr(9, 'NDS-7-old', 'merged'), pr(15, 'XNDS-50')]

  it('finds the open PR whose branch names the key, in any case', () => {
    expect(prForIssue('NDS-42', prs)?.number).toBe(12)
    expect(prForIssue('NDS-43', prs)?.number).toBe(14)
  })

  it('needs the key to stand on its own', () => {
    expect(prForIssue('NDS-4', prs)).toBeUndefined()
    expect(prForIssue('NDS-50', prs)).toBeUndefined()
  })

  it('leaves merged PRs out', () => {
    expect(prForIssue('NDS-7', prs)).toBeUndefined()
  })
})
