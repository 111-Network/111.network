// Overview slice (#/overview). STUB: the Overview view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: mostly derived (selectors: verdict, needsYou, nearbySentence, servicesHere); keep only view-local state here.
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type OverviewState                 the slice's state (replace the placeholder with an interface)
//   type OverviewAction                its actions, every type string prefixed "overview/"
//   initialOverview(world: World)      -> OverviewState
//   reduceOverview(state, action: DemoAction, ctx: SliceCtx) -> OverviewState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsOverview(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/overview.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Overview view task defines it. */
export type OverviewState = Record<never, never>

/** "overview/..." actions. None yet. */
export type OverviewAction = never

export function initialOverview(): OverviewState {
  return {}
}

export function reduceOverview(state: OverviewState): OverviewState {
  return state
}

export function needsOverview(): readonly NeedItem[] {
  return NO_NEEDS
}
