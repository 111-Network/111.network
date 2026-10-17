// Repairs slice (#/services/repairs). STUB: the Repairs view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: health matrix, [DEMO] simulate a fault (core/serviceTransition to "error" + emit "fault") -> diagnose -> sandbox -> proposal (core/proposalAdded, from "repairs") -> the W13 gate rail (HEAL_GATES from @/lib/heal; human gates wait, never auto-continue) -> "fix-shared".
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type RepairsState                 the slice's state (replace the placeholder with an interface)
//   type RepairsAction                its actions, every type string prefixed "repairs/"
//   initialRepairs(world: World)      -> RepairsState
//   reduceRepairs(state, action: DemoAction, ctx: SliceCtx) -> RepairsState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsRepairs(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/repairs.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Repairs view task defines it. */
export type RepairsState = Record<never, never>

/** "repairs/..." actions. None yet. */
export type RepairsAction = never

export function initialRepairs(): RepairsState {
  return {}
}

export function reduceRepairs(state: RepairsState): RepairsState {
  return state
}

export function needsRepairs(): readonly NeedItem[] {
  return NO_NEEDS
}
