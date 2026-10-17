// Kb slice (#/kb, #/kb/<drawer>, #/kb/<drawer>/<note>; plan §6.4, Layer 0). UI state only: which
// reader the visitor picked (HUMAN reads the full note, AGENT reads the one-line index, as on the
// home L0 section) and the find field's text. Both live in the store so they survive moving
// between the index, a drawer and a note, and between other views and back.
//
// The library itself is static sample data (views/kb/model.ts over the home L0 catalog), so
// nothing here is ever scheduled, emitted or counted: the knowledge base never asks for the
// visitor (NO_NEEDS), and nothing moves while idle.
import { NO_NEEDS, type NeedItem } from "../types"
import type { DemoAction } from "./index"

/** HUMAN reads the full note; AGENT reads the one-line index (L0 `ReaderView`). */
export type KbReader = "human" | "agent"

export interface KbState {
  reader: KbReader
  /** The find field's text as typed (clamped to KB_QUERY_MAX characters). */
  query: string
}

export type KbAction = { type: "kb/setReader"; reader: KbReader } | { type: "kb/setQuery"; query: string }

/** The longest find text kept; anything past it is dropped as it is typed. */
export const KB_QUERY_MAX = 80

/** The find text as the slice keeps it. */
export function clampKbQuery(query: string): string {
  return query.length > KB_QUERY_MAX ? query.slice(0, KB_QUERY_MAX) : query
}

export function initialKb(): KbState {
  return { reader: "human", query: "" }
}

export function reduceKb(state: KbState, action: DemoAction): KbState {
  switch (action.type) {
    case "kb/setReader":
      return action.reader === state.reader ? state : { ...state, reader: action.reader }
    case "kb/setQuery": {
      const query = clampKbQuery(action.query)
      return query === state.query ? state : { ...state, query }
    }
    default:
      return state
  }
}

export function needsKb(): readonly NeedItem[] {
  return NO_NEEDS
}
