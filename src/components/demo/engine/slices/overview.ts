// Overview slice (#/overview, where /demo opens). Owned by the Overview view task.
//
// Overview is derived (selectors: verdict, needsYou, nearbySentence, devicesSummary, servicesHere,
// ownDevice): it keeps no state of its own, so the "needs you" block, the verdict and the services
// grid change in the same dispatch as core. The slice only turns Overview's two agent hand-offs into
// the core prefill, so the prepared wording is pure and tested here:
//   overview/askAgent {goal: "check"}        "Let the agent check this node"
//   overview/askAgent {goal: "setup", id}    "Set up with the agent" on a NOT SET row of "needs you"
// Both stage a prompt in the Agent's composer (core/agentPrefill opens "/"); nothing is ever sent.
import { SERVICE_NOUN } from "../../copy/core"
import { OVERVIEW_COPY } from "../../copy/overview"
import type { CoreState } from "../core"
import { NO_NEEDS, type NeedItem, type ServiceId, type SliceCtx } from "../types"
import type { DemoAction } from "./index"

/** Overview keeps no state of its own: everything it shows is derived from core and the other slices. */
export type OverviewState = Readonly<Record<never, never>>

export type OverviewAction =
  | { type: "overview/askAgent"; goal: "check" }
  | { type: "overview/askAgent"; goal: "setup"; id: ServiceId }

/** One empty state for every store (identity never changes, so Overview never wakes a subscriber). */
const EMPTY: OverviewState = Object.freeze({})

export function initialOverview(): OverviewState {
  return EMPTY
}

/** A prompt to stage in the Agent's composer. */
export interface OverviewPrompt {
  text: string
  /** Banner label: "prepared from: …". */
  from: string
}

/**
 * The prepared prompt of a hand-off, or null when there is nothing to set up: "setup" only for a
 * service that can run here, is NOT SET, and is set up through the agent (the gateway turns live by
 * itself, so it never gets one).
 */
export function overviewPrompt(action: OverviewAction, core: Pick<CoreState, "services">): OverviewPrompt | null {
  if (action.goal === "check") return { text: OVERVIEW_COPY.ask.checkPrompt, from: OVERVIEW_COPY.ask.from }
  const svc = core.services.find((s) => s.id === action.id)
  if (!svc || !svc.canRunHere || svc.state !== "unset" || svc.setup !== "agent") return null
  return { text: OVERVIEW_COPY.ask.setupPrompt(SERVICE_NOUN[svc.id]), from: svc.name }
}

export function reduceOverview(state: OverviewState, action: DemoAction, ctx: SliceCtx): OverviewState {
  if (action.type !== "overview/askAgent") return state
  const prompt = overviewPrompt(action, ctx.core)
  if (prompt) ctx.dispatch({ type: "core/agentPrefill", text: prompt.text, from: prompt.from })
  return state
}

/** Overview adds no rows of its own to "needs you": it is where they are shown. */
export function needsOverview(): readonly NeedItem[] {
  return NO_NEEDS
}
