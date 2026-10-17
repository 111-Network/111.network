// Bridge slice (#/services/bridge). STUB: the Bridge view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: starts NOT SET "needs a radio" with [DEMO] plug in a radio board on the page; once selectors.bridgeReady: the preferred networks tried in order (core.transport) and the bridge diagram; buffer copy = BRIDGE_REASON.buffer.
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type BridgeState                 the slice's state (replace the placeholder with an interface)
//   type BridgeAction                its actions, every type string prefixed "bridge/"
//   initialBridge(world: World)      -> BridgeState
//   reduceBridge(state, action: DemoAction, ctx: SliceCtx) -> BridgeState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsBridge(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/bridge.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Bridge view task defines it. */
export type BridgeState = Record<never, never>

/** "bridge/..." actions. None yet. */
export type BridgeAction = never

export function initialBridge(): BridgeState {
  return {}
}

export function reduceBridge(state: BridgeState): BridgeState {
  return state
}

export function needsBridge(): readonly NeedItem[] {
  return NO_NEEDS
}
