// Nearby slice (#/nearby, Layers 5 and 7; plan §6.4). The heard nodes themselves live in core
// (core.heard, meshNeighbours / homeHubHeard); this slice keeps the view's own state:
// - the RADAR | LIST choice (it survives leaving the view and coming back);
// - "[DEMO] listen for a minute": ONE finite burst. Pressing it schedules a fixed set of
//   core/heardNode {cause: "listen-burst", quiet: true} on the demo scheduler, then the end of the
//   minute, which emits "listen-burst" once with what was heard. Nothing repeats by itself, and it
//   stops early (and says so) when the long-range radio stops running or is unplugged.
// No continuous sweep: nothing here schedules anything except in response to that one button.
import { formatDuration, SEC, MIN } from "../clock"
import type { CoreState } from "../core"
import { NO_NEEDS, type NeedItem, type PeerId, type SliceCtx } from "../types"
import type { DemoAction } from "./index"
import { nodeName, type World } from "../world"
import { NEARBY_COPY } from "../../copy/nearby"

export type NearbyMode = "radar" | "list"

/** A listen that is running. */
export interface ListenRun {
  /** 1, 2, 3 … one per press, never reused. */
  n: number
  startedAt: number
  /** The hears this burst will bring, in order (a relay can be heard twice). */
  planned: readonly PeerId[]
  /** The hears that landed so far, in order. */
  heard: readonly PeerId[]
}

/** How the last listen ended. */
export interface ListenResult {
  n: number
  startedAt: number
  endedAt: number
  heard: readonly PeerId[]
  /** done = the minute ran out · stopped = you stopped it · lost = the long-range radio stopped. */
  outcome: "done" | "stopped" | "lost"
  /** The sentence it emitted (also the "last listen" line). */
  text: string
}

export interface NearbyState {
  mode: NearbyMode
  /** Listens started so far. */
  seq: number
  listen: ListenRun | null
  last: ListenResult | null
}

export type NearbyAction =
  | { type: "nearby/setMode"; mode: NearbyMode }
  /** "[DEMO] listen for a minute". `instant` (reduced motion): the whole burst and its end land in this dispatch. */
  | { type: "nearby/listen"; instant?: boolean }
  /** The minute is over (scheduled by nearby/listen). */
  | { type: "nearby/listenEnd" }
  | { type: "nearby/stopListening" }

/** How long a listen lasts (virtual ms): a minute. */
export const LISTEN_MS = MIN

/** When each hear of the burst lands after the press (virtual ms). The rest of the minute is quiet. */
export const LISTEN_OFFSETS: readonly number[] = [2 * SEC, 6 * SEC, 11 * SEC, 17 * SEC, 24 * SEC]

export const LISTEN_END_KEY = "nearby:listen:end"
export const listenKey = (i: number): string => `nearby:listen:${i}`

const KIND_ORDER = { relay: 0, hub: 1, person: 2 } as const

/**
 * The hears one listen brings: every node of the sample world normally reached over long-range radio,
 * relays first, and each relay heard a second time at the end (a relay forwards for everyone, so it
 * is on the air most). Capped at LISTEN_OFFSETS.length.
 */
export function listenPlan(world: World): PeerId[] {
  const radio = world.cast.filter((c) => c.reach === "radio").sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
  const relays = radio.filter((c) => c.kind === "relay")
  return [...radio, ...relays].map((c) => c.id).slice(0, LISTEN_OFFSETS.length)
}

/** "Ridge repeater twice, Valley hub and Bram": each node once, in first-heard order, with how often. */
export function heardNames(ids: readonly PeerId[], world: World): string {
  const counts = new Map<PeerId, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  const parts = [...counts].map(([id, n]) => NEARBY_COPY.listen.times(nodeName(world, id), n))
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/** Is the long-range radio running (the only way this node hears radio nodes)? */
export function radioListening(core: Pick<CoreState, "services">): boolean {
  return core.services.some((s) => s.id === "radio" && s.state === "live")
}

export function initialNearby(): NearbyState {
  return { mode: "radar", seq: 0, listen: null, last: null }
}

/** Ends the running listen: drops what is still pending and emits "listen-burst" once. */
function endListen(state: NearbyState, ctx: SliceCtx, outcome: ListenResult["outcome"]): NearbyState {
  const run = state.listen
  if (!run) return state
  for (let i = 0; i < run.planned.length; i++) ctx.cancel(listenKey(i))
  ctx.cancel(LISTEN_END_KEY)
  const names = heardNames(run.heard, ctx.world)
  const c = NEARBY_COPY.listen
  const text =
    outcome === "done"
      ? names === ""
        ? c.doneNobody
        : c.done(names)
      : outcome === "stopped"
        ? c.stopped(formatDuration(ctx.now - run.startedAt), names)
        : c.lost
  ctx.emit("listen-burst", { text, ref: `listen-${run.n}` })
  return { ...state, listen: null, last: { n: run.n, startedAt: run.startedAt, endedAt: ctx.now, heard: run.heard, outcome, text } }
}

export function reduceNearby(state: NearbyState, action: DemoAction, ctx: SliceCtx): NearbyState {
  switch (action.type) {
    case "nearby/setMode":
      return state.mode === action.mode ? state : { ...state, mode: action.mode }

    case "nearby/listen": {
      if (state.listen !== null || !radioListening(ctx.core)) return state
      const n = state.seq + 1
      const planned = listenPlan(ctx.world)
      planned.forEach((id, i) => {
        const hear: DemoAction = { type: "core/heardNode", id, via: "radio", cause: "listen-burst", quiet: true }
        if (action.instant) ctx.dispatch(hear)
        else ctx.schedule(LISTEN_OFFSETS[i], hear, { key: listenKey(i) })
      })
      if (action.instant) ctx.dispatch({ type: "nearby/listenEnd" })
      else ctx.schedule(LISTEN_MS, { type: "nearby/listenEnd" }, { key: LISTEN_END_KEY })
      return { ...state, seq: n, listen: { n, startedAt: ctx.now, planned, heard: [] } }
    }

    case "nearby/listenEnd":
      return endListen(state, ctx, "done")

    case "nearby/stopListening":
      return endListen(state, ctx, "stopped")

    case "core/heardNode": {
      const run = state.listen
      if (!run || action.cause !== "listen-burst") return checkRadio(state, ctx)
      return { ...state, listen: { ...run, heard: [...run.heard, action.id] } }
    }

    default:
      return checkRadio(state, ctx)
  }
}

/** A listen cannot outlive the radio: unplugged, stopped or in error, it ends at once and says why. */
function checkRadio(state: NearbyState, ctx: SliceCtx): NearbyState {
  if (state.listen === null || radioListening(ctx.core)) return state
  return endListen(state, ctx, "lost")
}

export function needsNearby(): readonly NeedItem[] {
  return NO_NEEDS
}
