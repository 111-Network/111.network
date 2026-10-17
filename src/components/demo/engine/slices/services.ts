// Services slice (#/services/<id> except bridge, storage, repairs). STUB: the Services view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: the service page template for agent, model, mesh, radio, kb, gateway, messaging, incl. the gateway's [DEMO] connect to the internet (core/internetConnected).
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type ServicesState                 the slice's state (replace the placeholder with an interface)
//   type ServicesAction                its actions, every type string prefixed "services/"
//   initialServices(world: World)      -> ServicesState
//   reduceServices(state, action: DemoAction, ctx: SliceCtx) -> ServicesState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsServices(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/services.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Services view task defines it. */
export type ServicesState = Record<never, never>

/** "services/..." actions. None yet. */
export type ServicesAction = never

export function initialServices(): ServicesState {
  return {}
}

export function reduceServices(state: ServicesState): ServicesState {
  return state
}

export function needsServices(): readonly NeedItem[] {
  return NO_NEEDS
}
