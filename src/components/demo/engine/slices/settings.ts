// Settings slice (#/settings, #/settings/l0 .. l9). STUB: the Settings view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: Essentials and the ten layer pages; "Ask the agent about {layer}" dispatches core/agentPrefill; L1 [DEMO] check for updates -> probation -> healthy or rollback; L2 identity: grouped label, editable alias, public card.
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type SettingsState                 the slice's state (replace the placeholder with an interface)
//   type SettingsAction                its actions, every type string prefixed "settings/"
//   initialSettings(world: World)      -> SettingsState
//   reduceSettings(state, action: DemoAction, ctx: SliceCtx) -> SettingsState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsSettings(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/settings.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Settings view task defines it. */
export type SettingsState = Record<never, never>

/** "settings/..." actions. None yet. */
export type SettingsAction = never

export function initialSettings(): SettingsState {
  return {}
}

export function reduceSettings(state: SettingsState): SettingsState {
  return state
}

export function needsSettings(): readonly NeedItem[] {
  return NO_NEEDS
}
