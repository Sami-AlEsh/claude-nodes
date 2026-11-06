// The project panel's Tickets tab: the linked Jira project's issues, from Jira
// Cloud's REST API. The account (site, email and API token) is saved from
// Settings › Integrations. The token is sealed with safeStorage, so the macOS
// Keychain holds the secret, and never leaves the main process. Everything
// here only reads: nothing is ever created, commented on or transitioned.
import { safeStorage } from 'electron'
import type {
  JiraAccountInfo,
  JiraAccountInput,
  JiraProjectInfo,
  Project,
  TicketCategory,
  TicketRow,
  TicketsResult
} from '@shared/types'
import { getState, save, type JiraAccountState } from '../store'

const TIMEOUT_MS = 15_000
/** One page of issues: the panel is for what's in flight, not the backlog's far end. */
const MAX_ISSUES = 100
/** Pages of projects to read when linking, 50 each. */
const MAX_PROJECT_PAGES = 10
/** The Sprint field's type, in Jira Software. Its id (customfield_…) differs from site to site. */
const SPRINT_FIELD_TYPE = 'com.pyxis.greenhopper.jira:gh-sprint'
const FIELDS = ['summary', 'status', 'priority', 'issuetype', 'assignee', 'updated']

/** Loopback hosts, the only ones a token may be sent to without TLS (a local test server). */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The site's address as https://team.atlassian.net, from whatever was typed:
 * with or without the scheme, a trailing slash, or a page on the site.
 */
export function normalizeSite(input: string): string {
  const typed = input.trim()
  if (!typed) throw new Error('Enter your Jira site, such as your-team.atlassian.net.')
  let url: URL
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(typed) ? typed : `https://${typed}`)
  } catch {
    throw new Error('That doesn’t look like a web address. Enter your Jira site, such as your-team.atlassian.net.')
  }
  if (url.protocol === 'http:' && !LOOPBACK.has(url.hostname)) url.protocol = 'https:'
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Enter your Jira site’s web address, such as your-team.atlassian.net.')
  }
  return url.origin
}

/** Jira project keys: a capital letter, then capitals, digits or underscores. */
export function isProjectKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(key)
}

/** What's to do or in flight in the project, and what got done in the last week, most recently updated first. */
export function buildJql(key: string): string {
  if (!isProjectKey(key)) throw new Error(`Not a Jira project key: ${key}`)
  return `project = "${key}" AND (statusCategory != Done OR statusCategoryChangedDate >= -7d) ORDER BY updated DESC`
}

/** The id of the site's Sprint field, from GET /rest/api/3/field; undefined without Jira Software. */
export function findSprintField(raw: unknown): string | undefined {
  if (!Array.isArray(raw)) return undefined
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue
    const field = f as { id?: unknown; schema?: { custom?: unknown } }
    if (field.schema?.custom === SPRINT_FIELD_TYPE && typeof field.id === 'string') return field.id
  }
  return undefined
}

const CATEGORY: Record<string, TicketCategory> = { new: 'todo', indeterminate: 'in-progress', done: 'done' }

/**
 * Whether an issue's Sprint field holds a sprint that's going now. Jira
 * Cloud sends sprints as objects; older sites sent them as strings like
 * com.atlassian.greenhopper.service.sprint.Sprint@1a2b[id=4,state=ACTIVE,…].
 */
export function inActiveSprint(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.some((s) =>
    typeof s === 'string'
      ? /[[,]state=ACTIVE[,\]]/i.test(s)
      : Boolean(s && typeof s === 'object' && String((s as { state?: unknown }).state).toLowerCase() === 'active')
  )
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const named = (v: unknown): string | undefined =>
  v && typeof v === 'object' ? text((v as { name?: unknown }).name) : undefined

/**
 * Rows from a GET /rest/api/3/search/jql answer. `me` is the signed-in
 * account's id, for Mine; `sprintField` the Sprint field's id, for This sprint.
 */
export function parseIssues(
  raw: unknown,
  ctx: { site: string; me?: string; sprintField?: string }
): TicketRow[] {
  const issues = raw && typeof raw === 'object' ? (raw as { issues?: unknown }).issues : undefined
  if (!Array.isArray(issues)) return []
  const rows: TicketRow[] = []
  for (const item of issues) {
    if (!item || typeof item !== 'object') continue
    const issue = item as { key?: unknown; fields?: Record<string, unknown> }
    const key = text(issue.key)
    if (!key) continue
    const f = issue.fields ?? {}
    const status = (f.status && typeof f.status === 'object' ? f.status : {}) as {
      name?: unknown
      statusCategory?: { key?: unknown }
    }
    const assignee = f.assignee && typeof f.assignee === 'object' ? (f.assignee as Record<string, unknown>) : null
    const accountId = text(assignee?.accountId)
    const priority = named(f.priority)
    const type = named(f.issuetype)
    rows.push({
      key,
      summary: text(f.summary) ?? key,
      url: `${ctx.site}/browse/${encodeURIComponent(key)}`,
      status: text(status.name) ?? 'Unknown',
      category: CATEGORY[String(status.statusCategory?.key)] ?? 'todo',
      ...(priority ? { priority } : {}),
      ...(type ? { type } : {}),
      ...(assignee && accountId ? { assignee: { accountId, name: text(assignee.displayName) ?? 'Someone' } } : {}),
      mine: Boolean(ctx.me && accountId === ctx.me),
      inActiveSprint: ctx.sprintField ? inActiveSprint(f[ctx.sprintField]) : false,
      updatedAt: Date.parse(String(f.updated ?? '')) || 0
    })
  }
  return rows
}

/** Projects from a GET /rest/api/3/project/search page, and whether it was the last page. */
export function parseProjects(raw: unknown): { projects: JiraProjectInfo[]; last: boolean } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as { values?: unknown; isLast?: unknown }
  const projects: JiraProjectInfo[] = []
  for (const v of Array.isArray(body.values) ? body.values : []) {
    if (!v || typeof v !== 'object') continue
    const p = v as { key?: unknown; name?: unknown; style?: unknown; simplified?: unknown }
    if (!isProjectKey(p.key)) continue
    const teamManaged = p.style === 'next-gen' || p.simplified === true
    projects.push({ key: p.key, name: text(p.name) ?? p.key, ...(teamManaged ? { teamManaged } : {}) })
  }
  return { projects, last: body.isLast !== false }
}

/** Jira's own words about an error answer, from errorMessages or errors. */
export function jiraErrorText(body: unknown, status: number): string {
  const b = (body && typeof body === 'object' ? body : {}) as { errorMessages?: unknown; errors?: unknown; message?: unknown }
  const messages = [
    ...(Array.isArray(b.errorMessages) ? b.errorMessages : []),
    ...(b.errors && typeof b.errors === 'object' ? Object.values(b.errors) : []),
    b.message
  ].filter((m): m is string => typeof m === 'string' && m.trim() !== '')
  return messages[0]?.trim() ?? `Jira answered with an error (${status}).`
}

type JiraAnswer = { ok: true; body: unknown } | { ok: false; status: number; message: string }

interface Credentials {
  site: string
  email: string
  token: string
}

async function jiraGet(creds: Credentials, path: string): Promise<JiraAnswer> {
  let res: Response
  try {
    res = await fetch(`${creds.site}${path}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.email}:${creds.token}`).toString('base64')}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    const host = new URL(creds.site).host
    return { ok: false, status: 0, message: timedOut ? `${host} didn’t answer in time.` : `Couldn’t reach ${host}.` }
  }
  const text = await res.text().catch(() => '')
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    // A proxy, a captive portal or a single sign-on page can answer 200 with HTML.
    if (res.ok) return { ok: false, status: res.status, message: notJira(creds.site) }
    body = null
  }
  return res.ok ? { ok: true, body } : { ok: false, status: res.status, message: jiraErrorText(body, res.status) }
}

/** What to say when something other than Jira's API answered. */
function notJira(site: string): string {
  return `${new URL(site).host} didn’t answer like Jira’s API. A proxy or a sign-in page may be in the way.`
}

function unseal(account: JiraAccountState): string | null {
  try {
    return safeStorage.decryptString(Buffer.from(account.token, 'base64')) || null
  } catch (err) {
    console.error('[jira] could not decrypt the saved token', err)
    return null
  }
}

function credentials(): (Credentials & { account: JiraAccountState }) | null {
  const account = getState().jira
  const token = account && unseal(account)
  return account && token ? { site: account.site, email: account.email, token, account } : null
}

export function accountInfo(): JiraAccountInfo | null {
  const a = getState().jira
  return a ? { site: a.site, email: a.email, ...(a.displayName ? { displayName: a.displayName } : {}) } : null
}

/** Sprint field ids by site, read once a run: null when the site has none. */
const sprintFields = new Map<string, string | null>()

/**
 * Signs in with what was typed in Settings: checks it against Jira (who the
 * token belongs to), then saves it with the token sealed. null signs out.
 */
export async function setAccount(input: JiraAccountInput | null): Promise<JiraAccountInfo | null> {
  const state = getState()
  if (!input) {
    delete state.jira
    save()
    return null
  }
  const site = normalizeSite(String(input.site ?? ''))
  const email = String(input.email ?? '').trim()
  const token = String(input.token ?? '').trim()
  if (!email) throw new Error('Enter the email address you sign in to Jira with.')
  if (!token) throw new Error('Paste an API token from your Atlassian account.')
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('The Keychain isn’t available, so the token can’t be saved.')
  }
  const me = await jiraGet({ site, email, token }, '/rest/api/3/myself')
  if (!me.ok) {
    throw new Error(
      me.status === 401 || me.status === 403
        ? 'Jira didn’t accept that email and API token.'
        : me.status === 404
          ? `There’s no Jira Cloud site at ${site}.`
          : me.message
    )
  }
  const who = (me.body && typeof me.body === 'object' ? me.body : {}) as { accountId?: unknown; displayName?: unknown }
  state.jira = {
    site,
    email,
    token: safeStorage.encryptString(token).toString('base64'),
    ...(text(who.accountId) ? { accountId: text(who.accountId) } : {}),
    ...(text(who.displayName) ? { displayName: text(who.displayName) } : {})
  }
  sprintFields.delete(site)
  save()
  return accountInfo()
}

/** The projects the account can see, by name, to link a folder to. */
export async function listProjects(): Promise<JiraProjectInfo[]> {
  const creds = credentials()
  if (!creds) throw new Error('Sign in to Jira in Settings › Integrations first.')
  const out: JiraProjectInfo[] = []
  for (let page = 0; page < MAX_PROJECT_PAGES; page++) {
    const res = await jiraGet(creds, `/rest/api/3/project/search?orderBy=name&maxResults=50&startAt=${page * 50}`)
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'Jira turned down the saved API token. Sign in again in Settings.' : res.message)
    }
    const { projects, last } = parseProjects(res.body)
    out.push(...projects)
    if (last || projects.length === 0) break
  }
  return out
}

async function sprintField(creds: Credentials): Promise<string | undefined> {
  if (!sprintFields.has(creds.site)) {
    const res = await jiraGet(creds, '/rest/api/3/field')
    // Not knowing only hides the This sprint chip; try again next time.
    if (!res.ok) return undefined
    sprintFields.set(creds.site, findSprintField(res.body) ?? null)
  }
  return sprintFields.get(creds.site) ?? undefined
}

/** The linked Jira project's tickets, or why there are none to show. */
export async function tickets(project: Project, now = Date.now()): Promise<TicketsResult> {
  const base = { rows: [], sprints: false, fetchedAt: now }
  const creds = credentials()
  if (!getState().jira) return { ...base, problem: { kind: 'jira-no-account' } }
  if (!creds) return { ...base, problem: { kind: 'jira-auth', site: getState().jira!.site } }
  const key = project.jira?.key
  if (!isProjectKey(key)) return { ...base, problem: { kind: 'jira-not-linked' } }

  const linked = { key, url: `${creds.site}/browse/${key}` }
  const field = await sprintField(creds)
  const query = new URLSearchParams({
    jql: buildJql(key),
    fields: [...FIELDS, ...(field ? [field] : [])].join(','),
    maxResults: String(MAX_ISSUES)
  })
  const res = await jiraGet(creds, `/rest/api/3/search/jql?${query}`)
  if (!res.ok) {
    return {
      ...base,
      project: linked,
      problem: res.status === 401 ? { kind: 'jira-auth', site: creds.site } : { kind: 'error', message: res.message }
    }
  }
  // JSON, but not a search answer: treat it as an error rather than as no tickets.
  if (!Array.isArray((res.body as { issues?: unknown } | null)?.issues)) {
    return { ...base, project: linked, problem: { kind: 'error', message: notJira(creds.site) } }
  }
  return {
    project: linked,
    rows: parseIssues(res.body, { site: creds.site, me: creds.account.accountId, sprintField: field }),
    sprints: Boolean(field),
    fetchedAt: now
  }
}
