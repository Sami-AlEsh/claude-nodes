// What the board does for what's drawn in its place: the workspace's + starts a
// session the way the board's New Session does, with its card laid out on the
// board, so the board has to be the one to make it.

interface BoardCommands {
  newSession(): void
}

let current: BoardCommands | null = null

/** The board hands its commands over while it's mounted; the function returned takes them back. */
export function provideBoardCommands(commands: BoardCommands): () => void {
  current = commands
  return () => {
    if (current === commands) current = null
  }
}

/** Starts a Claude session on the open board, which opens it in the workspace. */
export function newSession() {
  current?.newSession()
}
