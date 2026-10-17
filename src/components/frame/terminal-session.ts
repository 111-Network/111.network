import type { LayerNumber } from "@/lib/layers"
import {
  INITIAL_INTERPRETER_STATE,
  WELCOME_LINE,
  runCommand,
  type InterpreterState,
  type OutputLine,
  type TerminalContext,
} from "@/components/frame/terminal-commands"

// The finale terminal's screen + input state as pure transitions (no React):
// the component keeps one TerminalSession in useState and replaces it from its
// event handlers. Tested in terminal-session.test.ts.

/** One block on screen: the echoed command and what it printed. */
export interface TerminalEntry {
  id: number
  /** The echoed command ("" for a blank Enter); null for the welcome line. */
  command: string | null
  lines: readonly OutputLine[]
  /** Type the lines one by one while this is the newest entry (else print whole). */
  typed: boolean
  /** Screen-reader text for lines hidden as art. */
  srText?: string
}

/** Everything the terminal shows and remembers. */
export interface TerminalSession {
  entries: readonly TerminalEntry[]
  /** Id of the next entry (also drives the live-region refresh). */
  nextId: number
  /** The line being typed. */
  input: string
  /** Submitted commands, oldest first, no blank lines, no back-to-back repeats. */
  history: readonly string[]
  /** Index into `history` while recalling with ArrowUp/ArrowDown; null while editing a fresh line. */
  cursor: number | null
  /** The unsent line saved when a recall starts; ArrowDown past the newest brings it back. */
  draft: string
  interp: InterpreterState
  /** Text of the one polite live region; changes on every submit. */
  announcement: string
}

/** Most commands kept for ArrowUp. */
export const MAX_HISTORY = 50
/** Most entries kept on screen (older ones scroll off for good). */
export const MAX_ENTRIES = 100

/** The session on page load: only the welcome line, printed whole (never typed). */
export function createSession(): TerminalSession {
  return {
    entries: [{ id: 0, command: null, lines: [{ text: WELCOME_LINE }], typed: false }],
    nextId: 1,
    input: "",
    history: [],
    cursor: null,
    draft: "",
    interp: INITIAL_INTERPRETER_STATE,
    announcement: "",
  }
}

/** The visitor edited the line: it becomes a fresh line (the recall position is dropped). */
export function editInput(session: TerminalSession, value: string): TerminalSession {
  if (value === session.input && session.cursor === null) return session
  return { ...session, input: value, cursor: null }
}

/** ArrowUp: recall the previous command (the first press saves the unsent line). */
export function historyPrev(session: TerminalSession): TerminalSession {
  const { history, cursor } = session
  if (history.length === 0 || cursor === 0) return session
  if (cursor === null) {
    const last = history.length - 1
    return { ...session, cursor: last, draft: session.input, input: history[last] }
  }
  return { ...session, cursor: cursor - 1, input: history[cursor - 1] }
}

/** ArrowDown: step towards the newest command, then back to the unsent line. */
export function historyNext(session: TerminalSession): TerminalSession {
  const { history, cursor } = session
  if (cursor === null) return session
  if (cursor < history.length - 1) return { ...session, cursor: cursor + 1, input: history[cursor + 1] }
  return { ...session, cursor: null, input: session.draft, draft: "" }
}

const ARROW = /\s*->\s*/g

/**
 * The live-region text for printed lines: art is skipped (its description comes
 * first), a link reads as its label, link arrows are dropped and every line
 * ends as a sentence.
 */
export function announcementFor(lines: readonly OutputLine[], description?: string): string {
  const parts = lines
    .filter((line) => !line.art)
    .map((line) => (line.label ?? line.text).replace(ARROW, " ").trim())
    .filter(Boolean)
  if (description) parts.unshift(description)
  return parts.map((part) => (/[.:;!?]$/.test(part) ? part : `${part}.`)).join(" ")
}

/** U+00A0: unlike an ASCII space it survives white-space collapsing, so the rendered text really differs. */
export const PARITY_MARK = " "

/**
 * Identical consecutive texts may not be re-announced, so every other submit
 * appends one non-breaking space: the rendered text always changes, the words
 * do not. (The component also re-keys the live text node per submit.)
 */
function withParity(text: string, id: number): string {
  return id % 2 === 0 ? text : `${text}${PARITY_MARK}`
}

/** Result of submitInput: the next session and the layer to scroll to, if any. */
export interface SubmitOutcome {
  session: TerminalSession
  /** Run scrollToLayer(n) in the event handler when set (`goto` / `open`). */
  scrollTo: LayerNumber | null
}

/** Enter: run the line, echo it with its output, record it in history and clear the input. */
export function submitInput(session: TerminalSession, ctx: TerminalContext): SubmitOutcome {
  const command = session.input.trim()
  const outcome = runCommand(command, session.interp, ctx)
  const id = session.nextId
  const repeat = session.history[session.history.length - 1] === command
  const base: TerminalSession = {
    ...session,
    nextId: id + 1,
    input: "",
    cursor: null,
    draft: "",
    history: command && !repeat ? [...session.history, command].slice(-MAX_HISTORY) : session.history,
    interp: outcome.state,
  }

  if (outcome.effect?.kind === "clear") {
    return { session: { ...base, entries: [], announcement: withParity("Screen cleared.", id) }, scrollTo: null }
  }

  const entry: TerminalEntry = {
    id,
    command,
    lines: outcome.lines,
    typed: outcome.typed && outcome.lines.length > 0,
    ...(outcome.announce ? { srText: outcome.announce } : {}),
  }
  return {
    session: {
      ...base,
      entries: [...session.entries, entry].slice(-MAX_ENTRIES),
      announcement: command ? withParity(announcementFor(outcome.lines, outcome.announce), id) : "",
    },
    scrollTo: outcome.effect?.kind === "scroll" ? outcome.effect.layer : null,
  }
}
