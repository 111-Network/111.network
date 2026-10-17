// Kb slice (#/kb, #/kb/<drawer>, #/kb/<drawer>/<note>). STUB: the Kb view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: the index by drawer (projects, devices, recipes, protocols, local-models, concepts), the note view, grades as in L0; it must provide every note a service's `kb` field names (engine/world.ts).
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type KbState                 the slice's state (replace the placeholder with an interface)
//   type KbAction                its actions, every type string prefixed "kb/"
//   initialKb(world: World)      -> KbState
//   reduceKb(state, action: DemoAction, ctx: SliceCtx) -> KbState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsKb(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/kb.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Kb view task defines it. */
export type KbState = Record<never, never>

/** "kb/..." actions. None yet. */
export type KbAction = never

export function initialKb(): KbState {
  return {}
}

export function reduceKb(state: KbState): KbState {
  return state
}

export function needsKb(): readonly NeedItem[] {
  return NO_NEEDS
}
