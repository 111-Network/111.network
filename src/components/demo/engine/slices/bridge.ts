// Bridge slice (#/services/bridge, Layer 6; plan §6.4 Bridge, §6.8 bootstrap rule). Owned by the
// bridge view task.
//
// The bridge's own service state lives in core (registry): NOT SET "Needs a radio." at the start,
// "Ready to set up…" once the radio is live and this laptop has Wi-Fi that can host a hotspot (or
// ethernet), STARTING -> LIVE once turned on (the role toggle here, or an accepted proposal). The
// radio board's life and the preferred-network seek are core too (core/radio*, core/transportJoined);
// the bridge page dispatches the same core radio actions the Devices view does.
//
// This slice adds only what the bridge page needs on top:
//   - the diagram's UI state (selected band, direction of the next sample crossing);
//   - one sample crossing at a time, stepped through the scheduler: in -> swap -> out. Only the
//     outer wrapper changes at the bridge; the payload never does. "out" emits "bridge/crossed";
//   - the follow rule: a bridge cannot pass radio traffic without a running radio. When the radio
//     stops while the bridge is on, the bridge pauses (NOT SET, its own reason) and turns back on by
//     itself once the radio runs again (a caused step, never a timer of its own). A board that is
//     unplugged leaves nothing to resume (core already puts the bridge back to NOT SET).
import { BRIDGE_COPY } from "../../copy/bridge"
import type { CoreState } from "../core"
import { NO_NEEDS, type NeedItem, type ServiceId, type SliceCtx } from "../types"
import type { DemoService } from "../world"
import type { DemoAction } from "./index"

/** A band of the bridge diagram: the two networks and the thin bridge between them. */
export type BridgeBand = "radio" | "bridge" | "wifi"

/** Which way the next sample message crosses. */
export type CrossDirection = "radio-to-wifi" | "wifi-to-radio"

/** One crossing, in order: arrives on its side -> wrapper swapped at the bridge -> leaves on the other side. */
export type CrossStep = "in" | "swap" | "out"

export interface Crossing {
  /** `x1`, `x2` … from the slice counter (never from the clock). */
  id: string
  direction: CrossDirection
  step: CrossStep
  /** Virtual ms the crossing began. */
  startedAt: number
}

export interface BridgeState {
  seq: number
  /** The band whose detail the diagram shows. */
  selected: BridgeBand
  /** Direction of the next crossing. */
  direction: CrossDirection
  /** The current (or the last finished) sample crossing; null before the first one. */
  crossing: Crossing | null
  /** The bridge was on when the radio stopped: it turns back on once the radio is running again. */
  paused: boolean
}

export type BridgeAction =
  | { type: "bridge/select"; band: BridgeBand }
  | { type: "bridge/direction"; direction: CrossDirection }
  /** [DEMO] pass a sealed message across. Ignored unless the bridge is LIVE and no crossing is under way. */
  | { type: "bridge/cross"; instant?: boolean }
  /** Scheduled: the crossing `id` moves one step on. */
  | { type: "bridge/crossStep"; id: string }
  /** The role toggle: on = STARTING -> LIVE (only when the bootstrap rule holds), off = back to NOT SET. */
  | { type: "bridge/setRole"; on: boolean; instant?: boolean }

/** Virtual durations of the bridge's own timed steps (ms). */
export const BRIDGE_TIMING = {
  /** One step of a sample crossing. */
  crossStepMs: 1100,
} as const

/** Scheduler key of the pending crossing step (one crossing at a time). */
export const CROSS_KEY = "bridge:cross"

const BRIDGE: ServiceId = "bridge"
const RADIO: ServiceId = "radio"

export function initialBridge(): BridgeState {
  return { seq: 0, selected: "bridge", direction: "radio-to-wifi", crossing: null, paused: false }
}

function service(core: Pick<CoreState, "services">, id: ServiceId): DemoService | undefined {
  return core.services.find((s) => s.id === id)
}

const isLive = (core: Pick<CoreState, "services">, id: ServiceId): boolean => service(core, id)?.state === "live"

/** The crossing has not reached its last step yet. */
export function crossingUnderWay(c: Crossing | null): boolean {
  return c !== null && c.step !== "out"
}

/** The `instant` flag (reduced motion) of an action, when it has one. */
function instantOf(action: DemoAction): boolean {
  return "instant" in action && action.instant === true
}

/** The two sides of a crossing, in travel order. */
export function sidesOf(direction: CrossDirection): { from: "radio" | "wifi"; to: "radio" | "wifi" } {
  return direction === "radio-to-wifi" ? { from: "radio", to: "wifi" } : { from: "wifi", to: "radio" }
}

function own(state: BridgeState, action: DemoAction, ctx: SliceCtx): BridgeState {
  switch (action.type) {
    case "bridge/select":
      return state.selected === action.band ? state : { ...state, selected: action.band }
    case "bridge/direction":
      return state.direction === action.direction ? state : { ...state, direction: action.direction }
    case "bridge/cross": {
      if (!isLive(ctx.core, BRIDGE) || crossingUnderWay(state.crossing)) return state
      const seq = state.seq + 1
      const crossing: Crossing = { id: `x${seq}`, direction: state.direction, step: "in", startedAt: ctx.now }
      if (action.instant) {
        // Reduced motion: the crossing lands at its end state in this same dispatch.
        const { from, to } = sidesOf(crossing.direction)
        ctx.emit("bridge/crossed", { text: BRIDGE_COPY.crossedEvent(from, to), ref: crossing.id })
        return { ...state, seq, crossing: { ...crossing, step: "out" } }
      }
      ctx.schedule(BRIDGE_TIMING.crossStepMs, { type: "bridge/crossStep", id: crossing.id }, { key: CROSS_KEY })
      return { ...state, seq, crossing }
    }
    case "bridge/crossStep": {
      const c = state.crossing
      if (!c || c.id !== action.id || c.step === "out") return state
      if (c.step === "in") {
        ctx.schedule(BRIDGE_TIMING.crossStepMs, { type: "bridge/crossStep", id: c.id }, { key: CROSS_KEY })
        return { ...state, crossing: { ...c, step: "swap" } }
      }
      const { from, to } = sidesOf(c.direction)
      ctx.emit("bridge/crossed", { text: BRIDGE_COPY.crossedEvent(from, to), ref: c.id })
      return { ...state, crossing: { ...c, step: "out" } }
    }
    case "bridge/setRole": {
      const svc = service(ctx.core, BRIDGE)
      if (!svc) return state
      if (action.on) {
        // core refuses "starting" while the bootstrap rule does not hold; nothing else to check here.
        if (svc.state === "unset") ctx.dispatch({ type: "core/serviceTransition", id: BRIDGE, to: "starting", instant: action.instant })
        return state
      }
      if (svc.state === "live" || svc.state === "starting") ctx.dispatch({ type: "core/serviceTransition", id: BRIDGE, to: "unset" })
      return state.paused ? { ...state, paused: false } : state
    }
    default:
      return state
  }
}

/** Rules that follow core, applied after every action (core's and every slice's). */
function follow(state: BridgeState, action: DemoAction, ctx: SliceCtx): BridgeState {
  const bridge = service(ctx.core, BRIDGE)
  if (!bridge) return state
  const radioLive = isLive(ctx.core, RADIO)
  const radioWasLive = isLive(ctx.prev.core, RADIO)
  let next = state

  // A crossing under way stops when the bridge is no longer on (nothing is passed by a bridge that is off).
  if (crossingUnderWay(next.crossing) && bridge.state !== "live") {
    ctx.cancel(CROSS_KEY)
    next = { ...next, crossing: null }
  }

  // The board is gone (core put the bridge back to NOT SET "Needs a radio."): nothing to resume.
  if (next.paused && ctx.core.radio === null) next = { ...next, paused: false }

  if (radioWasLive && !radioLive && ctx.core.radio !== null && (bridge.state === "live" || bridge.state === "starting")) {
    // The radio stopped (an error, a restart) while the bridge was on: pause it honestly.
    ctx.dispatch({ type: "core/serviceTransition", id: BRIDGE, to: "unset", reason: BRIDGE_COPY.pausedReason })
    return { ...next, paused: true }
  }

  if (next.paused) {
    // On again with the radio running (resumed here, or turned on another way): nothing left to wait for.
    // On while the radio is NOT running is only the moment before this slice's own pause lands (the
    // radio's events run first, as follow-ups queued ahead of it): keep waiting.
    if (bridge.state !== "unset") return radioLive ? { ...next, paused: false } : next
    if (radioLive) {
      // The radio runs again: the bridge turns back on, caused by that (never a timer of its own).
      ctx.dispatch({ type: "core/serviceTransition", id: BRIDGE, to: "starting", instant: instantOf(action) || undefined })
      return { ...next, paused: false }
    }
    // core refreshes an unset bridge's reason on every radio transition; keep the paused sentence while waiting.
    if (bridge.reason !== BRIDGE_COPY.pausedReason) {
      ctx.dispatch({ type: "core/serviceTransition", id: BRIDGE, to: "unset", reason: BRIDGE_COPY.pausedReason })
    }
  }
  return next
}

export function reduceBridge(state: BridgeState, action: DemoAction, ctx: SliceCtx): BridgeState {
  return follow(own(state, action, ctx), action, ctx)
}

/** The bridge adds no rows of its own: core lists its setup row once the radio is live (selectors needsYou). */
export function needsBridge(): readonly NeedItem[] {
  return NO_NEEDS
}
