import { describe, expect, it } from 'vitest'
import type { Project, ProjectStats } from '@shared/types'
import { focusModeOn, isFocusing, showsInFocus } from './focus'

const project = (id: string, extra: Partial<Project> = {}): Project => ({
  id,
  name: id,
  repoPath: `/repos/${id}`,
  color: 'blue',
  createdAt: 0,
  ...extra
})

const stats = (waiting: number): ProjectStats => ({ total: 1, active: 1, working: 0, waiting })

describe('focusModeOn', () => {
  it('is on only while focus is offered in Settings and switched on', () => {
    expect(focusModeOn({ focusFeature: true, focusMode: true })).toBe(true)
    expect(focusModeOn({ focusFeature: true, focusMode: false })).toBe(false)
    expect(focusModeOn(null)).toBe(false)
  })

  it('stays off while focus is turned off in Settings, whatever the switch says', () => {
    expect(focusModeOn({ focusFeature: false, focusMode: true })).toBe(false)
  })
})

describe('isFocusing', () => {
  it('is off while focus mode is off, even with projects in focus', () => {
    expect(isFocusing([project('a', { focused: true })], false)).toBe(false)
    expect(isFocusing([project('a', { focused: true })], undefined)).toBe(false)
  })

  it('narrows the lists once focus mode is on and a project is in focus', () => {
    expect(isFocusing([project('a', { focused: true }), project('b')], true)).toBe(true)
  })

  it('shows everything when nothing is in focus', () => {
    expect(isFocusing([project('a'), project('b')], true)).toBe(false)
  })

  it('ignores archived projects in focus', () => {
    expect(isFocusing([project('a', { focused: true, archived: true }), project('b')], true)).toBe(false)
  })
})

describe('showsInFocus', () => {
  it('shows the projects in focus', () => {
    expect(showsInFocus(project('a', { focused: true }))).toBe(true)
  })

  it('hides the others', () => {
    expect(showsInFocus(project('a'))).toBe(false)
    expect(showsInFocus(project('a'), stats(0))).toBe(false)
  })

  it('shows a project out of focus while a session in it waits on you', () => {
    expect(showsInFocus(project('a'), stats(1))).toBe(true)
  })

  it('shows the project whose board is open', () => {
    expect(showsInFocus(project('a'), undefined, 'a')).toBe(true)
    expect(showsInFocus(project('a'), undefined, 'b')).toBe(false)
  })
})
