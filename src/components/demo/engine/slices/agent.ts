// Agent slice (#/). STUB: the Agent view task owns this file and fills it in place;
// nobody else edits it. Plan §6.4: chat over the canned intent table (copy/agent.ts) with the reply streaming word by word through ctx.schedule and at most 4 tool lines; proposal cards (core.proposals; Accept / Dismiss dispatch core/proposalAccepted / core/proposalDismissed); the prefill (core.prefill, then core/prefillTaken). Every reply carries DEMO_NOTE.reply.
//
// Module shape (keep these four export names; ./index.ts already wires them):
//   type AgentState                 the slice's state (replace the placeholder with an interface)
//   type AgentAction                its actions, every type string prefixed "agent/"
//   initialAgent(world: World)      -> AgentState
//   reduceAgent(state, action: DemoAction, ctx: SliceCtx) -> AgentState
//       receives EVERY action (core/... and other slices'); return `state` itself when nothing applies.
//       ctx.core = core state after this action; ctx.schedule / ctx.emit / ctx.dispatch record effects.
//   needsAgent(state, core: CoreState) -> readonly NeedItem[]
//       rows this slice adds to Overview's "needs you" and the header badge; NO_NEEDS when none.
// Add the parameters as you need them (import World, DemoAction, SliceCtx, CoreState as types).
// User-visible sentences go in copy/agent.ts.
import { NO_NEEDS, type NeedItem } from "../types"

/** Placeholder until the Agent view task defines it. */
export type AgentState = Record<never, never>

/** "agent/..." actions. None yet. */
export type AgentAction = never

export function initialAgent(): AgentState {
  return {}
}

export function reduceAgent(state: AgentState): AgentState {
  return state
}

export function needsAgent(): readonly NeedItem[] {
  return NO_NEEDS
}
