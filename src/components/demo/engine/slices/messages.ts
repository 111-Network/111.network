// Messages slice (#/messages, #/messages/<peer>). STUB: the Messages view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: threads with Ada and Bram, the welcome message (cause "welcome"), message requests (needsMessages returns the requests row), send -> queued / sent / relayed / delivered through ctx.schedule, the hub's custody ACK (emit "custody-ack"), Ada's reply (cause "reply"), the outbox flushing on core/internetConnected (emit "queue-flushed").
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type MessagesState                 the slice's state (replace the placeholder with an interface)
//   type MessagesAction                its actions, every type string prefixed "messages/"
//   initialMessages(world: World)      -> MessagesState
//   reduceMessages(state, action: DemoAction, ctx: SliceCtx) -> MessagesState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsMessages(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/messages.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Messages view task defines it. */
export type MessagesState = Record<never, never>

/** "messages/..." actions. None yet. */
export type MessagesAction = never

export function initialMessages(): MessagesState {
  return {}
}

export function reduceMessages(state: MessagesState): MessagesState {
  return state
}

export function needsMessages(): readonly NeedItem[] {
  return NO_NEEDS
}
