import http from 'http'
import type { AddressInfo } from 'net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@shared/types'
import { getState } from '../store'
import {
  buildJql,
  findSprintField,
  inActiveSprint,
  isProjectKey,
  jiraErrorText,
  listProjects,
  normalizeSite,
  parseIssues,
  parseProjects,
  setAccount,
  tickets
} from './jira'

// safeStorage stands in for the Keychain; the sealed token is just marked, so tests can see it isn't stored plain.
vi.mock('electron', () => ({
  app: { getPath: () => require('os').tmpdir() },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`sealed:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^sealed:/, '')
  }
}))
vi.mock('../store', async (importOriginal) => {
  const real = await importOriginal<typeof import('../store')>()
  const state = { projects: [], groups: [], boards: {}, settings: real.normalizeSettings(null) } as ReturnType<
    typeof real.getState
  >
  return { ...real, getState: () => state, save: () => {} }
})

const SITE = 'https://team.atlassian.net'

/** A GET /rest/api/3/search/jql answer as Jira Cloud sends it, trimmed to the fields asked for. */
const SEARCH = {
  issues: [
    {
      id: '10042',
      key: 'NDS-42',
      self: `${SITE}/rest/api/3/issue/10042`,
      fields: {
        summary: 'Terminal font and size setting',
        status: { name: 'In Progress', id: '3', statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' } },
        priority: { name: 'High', id: '2' },
        issuetype: { name: 'Story', subtask: false },
        assignee: { accountId: 'acc-sami', displayName: 'Sami AlEsh', active: true },
        updated: '2026-11-05T12:00:00.000+0000',
        customfield_10020: [{ id: 4, name: 'NDS Sprint 4', state: 'active', boardId: 1 }]
      }
    },
    {
      id: '10039',
      key: 'NDS-39',
      fields: {
        summary: 'Mouse only navigation on the board',
        status: { name: 'Ready for QA', statusCategory: { key: 'indeterminate' } },
        priority: null,
        issuetype: { name: 'Bug' },
        assignee: null,
        updated: '2026-11-04T09:30:00.000+0000',
        customfield_10020: [{ id: 3, name: 'NDS Sprint 3', state: 'closed' }]
      }
    },
    {
      id: '10031',
      key: 'NDS-31',
      fields: {
        summary: 'Colour schemes',
        status: { name: 'Done', statusCategory: { key: 'done' } },
        issuetype: { name: 'Task' },
        updated: '2026-11-02T09:30:00.000+0000',
        customfield_10020: null
      }
    },
    { id: '1', fields: { summary: 'no key' } }
  ],
  isLast: true
}

describe('normalizeSite', () => {
  it('turns what was typed into the site’s address', () => {
    expect(normalizeSite('team.atlassian.net')).toBe(SITE)
    expect(normalizeSite(' https://team.atlassian.net/ ')).toBe(SITE)
    expect(normalizeSite('https://team.atlassian.net/jira/software/projects/NDS/boards/1')).toBe(SITE)
  })

  it('only sends a token without TLS to this Mac', () => {
    expect(normalizeSite('http://team.atlassian.net')).toBe(SITE)
    expect(normalizeSite('http://127.0.0.1:4010/')).toBe('http://127.0.0.1:4010')
    expect(normalizeSite('localhost:4010')).toBe('https://localhost:4010')
  })

  it('turns down what isn’t a web address', () => {
    expect(() => normalizeSite('')).toThrow(/Enter your Jira site/)
    expect(() => normalizeSite('ftp://team.atlassian.net')).toThrow(/web address/)
    expect(() => normalizeSite('team atlassian')).toThrow(/doesn’t look like a web address/)
  })
})

describe('buildJql', () => {
  it('asks for what’s open and what was done this week, newest first', () => {
    expect(buildJql('NDS')).toBe(
      'project = "NDS" AND (statusCategory != Done OR statusCategoryChangedDate >= -7d) ORDER BY updated DESC'
    )
  })

  it('only takes project keys', () => {
    expect(isProjectKey('NDS_2')).toBe(true)
    expect(isProjectKey('nds')).toBe(false)
    expect(() => buildJql('NDS" OR project = "X')).toThrow(/Not a Jira project key/)
  })
})

describe('the Sprint field', () => {
  it('is found by its type, whatever its id', () => {
    const fields = [
      { id: 'summary', schema: { type: 'string', system: 'summary' } },
      { id: 'customfield_10020', name: 'Sprint', schema: { type: 'array', custom: 'com.pyxis.greenhopper.jira:gh-sprint' } }
    ]
    expect(findSprintField(fields)).toBe('customfield_10020')
    expect(findSprintField([{ id: 'summary' }])).toBeUndefined()
  })

  it('tells an active sprint, sent as an object or in the older string form', () => {
    expect(inActiveSprint([{ state: 'closed' }, { state: 'active' }])).toBe(true)
    expect(inActiveSprint([{ state: 'future' }])).toBe(false)
    expect(inActiveSprint(['com.atlassian.greenhopper.service.sprint.Sprint@1a[id=4,rapidViewId=1,state=ACTIVE,name=S4]'])).toBe(true)
    expect(inActiveSprint(null)).toBe(false)
  })
})

describe('parseIssues', () => {
  const rows = parseIssues(SEARCH, { site: SITE, me: 'acc-sami', sprintField: 'customfield_10020' })

  it('makes a row of each issue with a key', () => {
    expect(rows.map((r) => r.key)).toEqual(['NDS-42', 'NDS-39', 'NDS-31'])
  })

  it('reads status, category, priority, type, assignee, sprint and mine', () => {
    expect(rows[0]).toEqual({
      key: 'NDS-42',
      summary: 'Terminal font and size setting',
      url: `${SITE}/browse/NDS-42`,
      status: 'In Progress',
      category: 'in-progress',
      priority: 'High',
      type: 'Story',
      assignee: { accountId: 'acc-sami', name: 'Sami AlEsh' },
      mine: true,
      inActiveSprint: true,
      updatedAt: Date.parse('2026-11-05T12:00:00.000Z')
    })
  })

  it('keeps a custom status’s name, and copes with no priority or assignee', () => {
    expect(rows[1]).toMatchObject({ status: 'Ready for QA', category: 'in-progress', mine: false, inActiveSprint: false })
    expect(rows[1].priority).toBeUndefined()
    expect(rows[1].assignee).toBeUndefined()
    expect(rows[2].category).toBe('done')
  })

  it('knows nothing of sprints without the field', () => {
    expect(parseIssues(SEARCH, { site: SITE }).every((r) => !r.inActiveSprint && !r.mine)).toBe(true)
    expect(parseIssues({ errorMessages: ['x'] }, { site: SITE })).toEqual([])
  })
})

describe('parseProjects', () => {
  it('reads company- and team-managed projects, and whether more pages follow', () => {
    const page = {
      values: [
        { key: 'NDS', name: 'Nodus', style: 'classic', simplified: false },
        { key: 'WEB', name: 'Website', style: 'next-gen', simplified: true },
        { key: 'bad key', name: 'Skipped' }
      ],
      isLast: false
    }
    expect(parseProjects(page)).toEqual({
      projects: [
        { key: 'NDS', name: 'Nodus' },
        { key: 'WEB', name: 'Website', teamManaged: true }
      ],
      last: false
    })
  })
})

describe('jiraErrorText', () => {
  it('gives Jira’s own words', () => {
    expect(jiraErrorText({ errorMessages: ["The value 'NOPE' does not exist for the field 'project'."] }, 400)).toBe(
      "The value 'NOPE' does not exist for the field 'project'."
    )
    expect(jiraErrorText({ errorMessages: [], errors: { jql: 'Bad JQL' } }, 400)).toBe('Bad JQL')
    expect(jiraErrorText(null, 503)).toBe('Jira answered with an error (503).')
  })
})

describe('the Jira client, against a local server', () => {
  let server: http.Server
  let site: string
  let token = 'good-token'
  /** Something other than Jira answering 200: a sign-in page, or JSON that isn't a search answer. */
  let impostor: 'html' | 'json' | null = null
  const requests: { url: string; auth?: string }[] = []

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requests.push({ url: req.url ?? '', auth: req.headers.authorization })
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      const expected = `Basic ${Buffer.from(`sami@example.com:${token}`).toString('base64')}`
      if (req.headers.authorization !== expected) return send(401, { errorMessages: ['Unauthorized'] })
      const url = new URL(req.url ?? '/', 'http://x')
      if (impostor === 'html' && url.pathname !== '/rest/api/3/field') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        return res.end('<html><body>Sign in to continue</body></html>')
      }
      if (impostor === 'json' && url.pathname === '/rest/api/3/search/jql') return send(200, { message: 'ok' })
      if (url.pathname === '/rest/api/3/myself') return send(200, { accountId: 'acc-sami', displayName: 'Sami AlEsh' })
      if (url.pathname === '/rest/api/3/field')
        return send(200, [{ id: 'customfield_10020', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } }])
      if (url.pathname === '/rest/api/3/project/search') {
        const start = Number(url.searchParams.get('startAt'))
        return send(200, start === 0 ? { values: [{ key: 'NDS', name: 'Nodus' }], isLast: false } : { values: [{ key: 'WEB', name: 'Website' }], isLast: true })
      }
      if (url.pathname === '/rest/api/3/search/jql') return send(200, SEARCH)
      send(404, { errorMessages: ['Not found'] })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  beforeEach(() => {
    token = 'good-token'
    impostor = null
    requests.length = 0
    delete getState().jira
  })

  const project = (jira?: Project['jira']): Project => ({
    id: 'p1',
    name: 'nodus',
    repoPath: '/tmp/nodus',
    color: 'blue',
    createdAt: 0,
    ...(jira ? { jira } : {})
  })

  it('signs in, keeping the token sealed and who it belongs to', async () => {
    const info = await setAccount({ site: `${site}/`, email: ' sami@example.com ', token: 'good-token' })
    expect(info).toEqual({ site, email: 'sami@example.com', displayName: 'Sami AlEsh' })
    const saved = getState().jira!
    expect(saved.accountId).toBe('acc-sami')
    expect(Buffer.from(saved.token, 'base64').toString()).toBe('sealed:good-token')
  })

  it('turns down an email and token Jira doesn’t accept, saving nothing', async () => {
    await expect(setAccount({ site, email: 'sami@example.com', token: 'wrong' })).rejects.toThrow(
      'Jira didn’t accept that email and API token.'
    )
    expect(getState().jira).toBeUndefined()
  })

  it('says what’s missing before the tickets can show', async () => {
    expect((await tickets(project({ key: 'NDS' }))).problem).toEqual({ kind: 'jira-no-account' })
    await setAccount({ site, email: 'sami@example.com', token: 'good-token' })
    expect((await tickets(project())).problem).toEqual({ kind: 'jira-not-linked' })
  })

  it('lists every page of projects', async () => {
    await setAccount({ site, email: 'sami@example.com', token: 'good-token' })
    expect((await listProjects()).map((p) => p.key)).toEqual(['NDS', 'WEB'])
  })

  it('reads the linked project’s tickets with the Sprint field', async () => {
    await setAccount({ site, email: 'sami@example.com', token: 'good-token' })
    const result = await tickets(project({ key: 'NDS' }), 1000)
    expect(result).toMatchObject({ project: { key: 'NDS', url: `${site}/browse/NDS` }, sprints: true, fetchedAt: 1000 })
    expect(result.rows.map((r) => [r.key, r.mine, r.inActiveSprint])).toEqual([
      ['NDS-42', true, true],
      ['NDS-39', false, false],
      ['NDS-31', false, false]
    ])
    const search = new URL(requests.find((r) => r.url.startsWith('/rest/api/3/search/jql'))!.url, 'http://x')
    expect(search.searchParams.get('jql')).toBe(buildJql('NDS'))
    expect(search.searchParams.get('fields')).toBe('summary,status,priority,issuetype,assignee,updated,customfield_10020')
  })

  it('says so when a sign-in page answers instead of Jira, rather than showing no tickets', async () => {
    await setAccount({ site, email: 'sami@example.com', token: 'good-token' })
    impostor = 'html'
    const result = await tickets(project({ key: 'NDS' }))
    expect(result.rows).toEqual([])
    expect(result.problem).toEqual({
      kind: 'error',
      message: `${new URL(site).host} didn’t answer like Jira’s API. A proxy or a sign-in page may be in the way.`
    })
    await expect(setAccount({ site, email: 'sami@example.com', token: 'good-token' })).rejects.toThrow(/didn’t answer like Jira’s API/)
  })

  it('says so when the answer is JSON but not a search result', async () => {
    await setAccount({ site, email: 'sami@example.com', token: 'good-token' })
    impostor = 'json'
    expect((await tickets(project({ key: 'NDS' }))).problem).toMatchObject({ kind: 'error' })
  })

  it('asks to sign in again once the token stops working', async () => {
    await setAccount({ site, email: 'sami@example.com', token: 'good-token' })
    token = 'rotated'
    expect((await tickets(project({ key: 'NDS' })))).toMatchObject({
      project: { key: 'NDS' },
      problem: { kind: 'jira-auth', site }
    })
  })
})
