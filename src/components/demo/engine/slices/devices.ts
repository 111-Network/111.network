// Devices slice (#/devices, #/devices/<id>). STUB: the Devices view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: the device list (this laptop, core.radio, other sample devices) and the radio flow: [DEMO] plug in a radio board -> allow once -> identify -> flash with the typed device-name confirm -> region (core/radio* actions).
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type DevicesState                 the slice's state (replace the placeholder with an interface)
//   type DevicesAction                its actions, every type string prefixed "devices/"
//   initialDevices(world: World)      -> DevicesState
//   reduceDevices(state, action: DemoAction, ctx: SliceCtx) -> DevicesState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsDevices(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/devices.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Devices view task defines it. */
export type DevicesState = Record<never, never>

/** "devices/..." actions. None yet. */
export type DevicesAction = never

export function initialDevices(): DevicesState {
  return {}
}

export function reduceDevices(state: DevicesState): DevicesState {
  return state
}

export function needsDevices(): readonly NeedItem[] {
  return NO_NEEDS
}
