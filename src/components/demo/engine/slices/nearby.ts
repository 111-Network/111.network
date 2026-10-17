// Nearby slice (#/nearby). STUB: the Nearby view task owns this file (and slices/gateway.ts for the
// Internet gateway page) and fills it in place; nobody else edits it. Plan §6.4: RADAR | LIST with no continuous sweep; blips only with a named cause (core.heard, core.events); [DEMO] listen for a minute = one finite burst of core/heardNode with cause "listen-burst"; relay row "forwards sealed traffic, cannot read it".
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type NearbyState                 the slice's state (replace the placeholder with an interface)
//   type NearbyAction                its actions, every type string prefixed "nearby/"
//   initialNearby(world: World)      -> NearbyState
//   reduceNearby(state, action: DemoAction, ctx: SliceCtx) -> NearbyState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsNearby(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/nearby.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Nearby view task defines it. */
export type NearbyState = Record<never, never>

/** "nearby/..." actions. None yet. */
export type NearbyAction = never

export function initialNearby(): NearbyState {
  return {}
}

export function reduceNearby(state: NearbyState): NearbyState {
  return state
}

export function needsNearby(): readonly NeedItem[] {
  return NO_NEEDS
}
