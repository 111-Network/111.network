// Storage slice (#/services/storage). STUB: the Storage view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: gauge, classes, the free-space order, [DEMO] fetch the regional map from a hub over Wi-Fi (emit "map-fetched"); big datasets are not practical over long-range radio.
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type StorageState                 the slice's state (replace the placeholder with an interface)
//   type StorageAction                its actions, every type string prefixed "storage/"
//   initialStorage(world: World)      -> StorageState
//   reduceStorage(state, action: DemoAction, ctx: SliceCtx) -> StorageState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsStorage(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/storage.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Storage view task defines it. */
export type StorageState = Record<never, never>

/** "storage/..." actions. None yet. */
export type StorageAction = never

export function initialStorage(): StorageState {
  return {}
}

export function reduceStorage(state: StorageState): StorageState {
  return state
}

export function needsStorage(): readonly NeedItem[] {
  return NO_NEEDS
}
