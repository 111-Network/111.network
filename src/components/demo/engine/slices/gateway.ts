// Internet gateway slice (#/services/gateway, Layer 7). STUB: the Nearby view task owns this file
// (with slices/nearby.ts, copy/gateway.ts and views/services/gateway/**) and fills it in place;
// nobody else edits it. Plan §6.4 "Presence + Internet gateway": heard nodes, "[DEMO] connect to the
// internet" -> core/internetConnected (the gateway is an overlay role: the node chip never changes),
// the queue flushes (the messages slice reacts to the core event), "core/internetLost" makes it a
// pure mesh node again. Its causes are namespaced "gateway/…" (pass `text`).
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type GatewayState                 the slice's state (replace the placeholder with an interface)
//   type GatewayAction                its actions, every type string prefixed "gateway/"
//   initialGateway(world: World)      -> GatewayState
//   reduceGateway(state, action: DemoAction, ctx: SliceCtx) -> GatewayState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsGateway(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/gateway.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Nearby view task defines it. */
export type GatewayState = Record<never, never>

/** "gateway/..." actions. None yet. */
export type GatewayAction = never

export function initialGateway(): GatewayState {
  return {}
}

export function reduceGateway(state: GatewayState): GatewayState {
  return state
}

export function needsGateway(): readonly NeedItem[] {
  return NO_NEEDS
}
