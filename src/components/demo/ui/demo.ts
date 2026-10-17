// Demo disclosure markers (React-free). No real counterpart: the real dashboard has no demo data.
// Plan §6.3 / W14: contextual demo actions carry a DEMO tag; every incoming demo item carries a note.
// The words live with the rest of the demo copy (copy/core.ts); this module only types and picks them.
import { DEMO_NOTE, DEMO_TAG } from "../copy/core"

/** The tag on a contextual demo button: `[DEMO] plug in a radio board`. */
export const DEMO_TAG_TEXT: string = DEMO_TAG

/** What an incoming demo item is: a message from the cast, an agent reply, a node heard on the radar. */
export type DemoNoteKind = keyof typeof DEMO_NOTE

/** The note's words per kind ("demo message" / "demo reply" / "demo node"). */
export const DEMO_NOTE_TEXT: Readonly<Record<DemoNoteKind, string>> = DEMO_NOTE

/** The note for an incoming item; defaults to "demo message". */
export function demoNoteText(kind: DemoNoteKind = "message"): string {
  return DEMO_NOTE_TEXT[kind]
}
