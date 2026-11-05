// Between views' frames and the main process. A view's page (viewPage.ts in
// the main process) posts its requests to the board; this answers them for
// the view whose frame sent them, which it knows by the frame's window, not
// by anything the page says. Most go to the main process, which checks them;
// opening and starting sessions happen here, on the board.
import type { ViewEvent } from '@shared/types'

interface Frame {
  projectId: string
  viewId: string
  /** The page version the frame shows, which it reports loaded. */
  version: number
}

/** What the board does for a page itself. */
export interface RelayHandlers {
  openSession(sessionId: string): void
  /** Starts a session for a view that may start them. Throws, saying why, when it may not. */
  startSession(viewId: string, prompt: string, title?: string): Promise<void>
}

const frames = new Map<Window, Frame>()
let handlers: RelayHandlers | null = null

export function registerFrame(win: Window, frame: Frame) {
  frames.set(win, frame)
}

export function unregisterFrame(win: Window) {
  frames.delete(win)
}

export function setRelayHandlers(h: RelayHandlers | null) {
  handlers = h
}

/** Sends an event to every frame showing a view (its card, and its large window when open). */
export function postToView(viewId: string, event: string, payload?: unknown) {
  for (const [win, frame] of frames) {
    if (frame.viewId === viewId) win.postMessage({ nodus: 1, event, payload }, '*')
  }
}

/** Sends an event to every view's frame, but `except`'s. */
export function broadcast(event: string, payload?: unknown, except?: string) {
  for (const [win, frame] of frames) {
    if (frame.viewId !== except) win.postMessage({ nodus: 1, event, payload }, '*')
  }
}

/** The colours pages show now (viewCss in schemes.ts), or undefined until the board sets them. */
let theme: string | undefined

/**
 * Gives every open page new colours. A page still loading misses the
 * broadcast and may have been served the old ones, so each page gets them
 * again once it says it has loaded.
 */
export function setViewTheme(css: string) {
  theme = css
  broadcast('theme', css)
}

interface PageWheel {
  dx: number
  dy: number
  mode: number
  /** Where in the page, which is the frame's size before the board's zoom. */
  x: number
  y: number
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

interface PageMessage {
  nodus: 1
  id?: number
  method?: string
  args?: unknown
  error?: string
  loaded?: boolean
  wheel?: PageWheel
}

const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

/**
 * A scroll the page had no use for, played on its frame as if the frame
 * weren't there: it pans the board, and a pinch zooms it. The board can't
 * tell whether the pointer is really over a frame of another origin, so a
 * page could move the board on its own; that's all it could do with this.
 */
function replayWheel(win: Window, w: PageWheel) {
  const el = Array.from(document.querySelectorAll('iframe')).find((f) => f.contentWindow === win)
  if (!el) return
  const r = el.getBoundingClientRect()
  const scale = el.offsetWidth ? r.width / el.offsetWidth : 1
  el.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: num(w.dx),
      deltaY: num(w.dy),
      deltaMode: num(w.mode),
      clientX: r.left + num(w.x) * scale,
      clientY: r.top + num(w.y) * scale,
      ctrlKey: w.ctrl === true,
      shiftKey: w.shift === true,
      altKey: w.alt === true,
      metaKey: w.meta === true
    })
  )
}

/**
 * `activated`: the user had just clicked or pressed something in this view
 * when the request came in, rather than a script acting on its own.
 */
async function answer(frame: Frame, method: string, args: unknown, activated: boolean): Promise<unknown> {
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>
  if (method === 'openSession') {
    if (typeof a.id !== 'string') throw new Error('nodus.openSession needs a session id')
    handlers?.openSession(a.id)
    return null
  }
  if (method === 'startSession') {
    const prompt = typeof a.prompt === 'string' ? a.prompt.trim() : ''
    if (!prompt) throw new Error('nodus.startSession needs a prompt')
    if (!activated) throw new Error('A view can only start a session within a few seconds of the user clicking something in it')
    if (!handlers) throw new Error('The board isn’t open')
    await handlers.startSession(frame.viewId, prompt, typeof a.title === 'string' ? a.title.trim() : undefined)
    return null
  }
  return window.api.views.call(frame.projectId, frame.viewId, method, args)
}

/**
 * Whether the user just clicked or pressed something in this frame. A click
 * in a frame activates the board's window for a few seconds, and gives the
 * frame the focus there; a click anywhere else on the board takes the focus
 * away. A page can fake neither. Read when the request comes in.
 */
function clickedIn(win: Window): boolean {
  const focused = document.activeElement
  const inFrame = focused instanceof HTMLIFrameElement && focused.contentWindow === win
  return inFrame && (navigator.userActivation?.isActive ?? false)
}

/** IPC errors arrive as "Error invoking remote method 'views:call': Error: …"; the page gets the last part. */
const reason = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

window.addEventListener('message', (e: MessageEvent) => {
  const win = e.source as Window | null
  const frame = win ? frames.get(win) : undefined
  const msg = e.data as PageMessage | null
  if (!frame || !win || !msg || msg.nodus !== 1) return
  if (typeof msg.error === 'string') {
    window.api.views.report(frame.projectId, frame.viewId, { error: msg.error })
    return
  }
  if (msg.loaded) {
    if (theme) win.postMessage({ nodus: 1, event: 'theme', payload: theme }, '*')
    window.api.views.report(frame.projectId, frame.viewId, { loaded: frame.version })
    return
  }
  if (msg.wheel && typeof msg.wheel === 'object') {
    replayWheel(win, msg.wheel)
    return
  }
  if (typeof msg.id !== 'number' || typeof msg.method !== 'string') return
  const id = msg.id
  answer(frame, msg.method, msg.args, clickedIn(win)).then(
    (result) => win.postMessage({ nodus: 1, id, result }, '*'),
    (err) => win.postMessage({ nodus: 1, id, error: reason(err) }, '*')
  )
})

// New data, saved state and commands' results, from the main process.
window.api.on.view((_projectId, viewId, event: ViewEvent, payload) => {
  postToView(viewId, event, payload)
  // Other views may draw from this one's data.
  if (event === 'data') broadcast('board', undefined, viewId)
})
