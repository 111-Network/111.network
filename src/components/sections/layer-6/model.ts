import { createRng, pick } from "@/lib/prng"

// Layer 6 · Transport & Bridge: the pure state machines behind the two
// widgets (plan §5 L6). React-free, so vitest runs them in node.
//
// A. Priority Seek Board: four example networks on a short, ordered preferred
//    list. A priority encoder answers "first hit wins"; SEEK walks the list
//    from the top (the seek ladder), joins the first network in range and
//    starts a few heartbeats; with none in range, messages wait on the device.
// B. Thin Bridge: a sealed packet crosses from one network to the other. Only
//    its outer wrapper swaps at the bridge; the payload never changes.

// ─── A. Priority Seek Board ────────────────────────────────────────────────

/** One example network on the preferred list, named only by its medium (W1). */
export interface SeekNetwork {
  letter: "A" | "B" | "C" | "D"
  /** Generic medium in plain words. */
  medium: string
}

/** The preferred list, in order: #1 is tried first. */
export const NETWORKS: readonly [SeekNetwork, SeekNetwork, SeekNetwork, SeekNetwork] = [
  { letter: "A", medium: "long-range radio" },
  { letter: "B", medium: "Wi-Fi" },
  { letter: "C", medium: "Bluetooth" },
  { letter: "D", medium: "long-range radio" },
]

/** Which of the four networks are in range, in list order. */
export type InRange = readonly [boolean, boolean, boolean, boolean]

/** Starting world: B and D in range, so the first seek falls past A and joins #2. */
export const DEFAULT_IN_RANGE: InRange = [false, true, false, true]

/** The encoder's rule, printed in its box. */
export const ENCODER_RULE = "1 > 2 > 3 > 4, first hit wins"

/** The encoder's output when nothing is in range. */
export const NONE_IN_RANGE = "NONE IN RANGE → messages wait on the device"

/** "Network B" for index 1. */
export function networkName(index: number): string {
  const net = NETWORKS[index]
  return net ? `Network ${net.letter}` : "Network"
}

/** True for 0..3. */
export function isNetworkIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < NETWORKS.length
}

/** Priority encoder: the index of the first network in range (first hit wins), or null. */
export function priorityEncode(inRange: readonly boolean[]): number | null {
  const hit = inRange.indexOf(true)
  return hit === -1 ? null : hit
}

/** The encoder box's output line: "JOIN #n" (1-based list position) or NONE_IN_RANGE. */
export function encoderOutput(inRange: readonly boolean[]): string {
  const hit = priorityEncode(inRange)
  return hit === null ? NONE_IN_RANGE : `JOIN #${hit + 1}`
}

/**
 * idle: nothing tried yet (or a range change undid the last walk);
 * seeking: listening on rung `cursor`; joined: found rung `cursor`, heartbeats
 * going out; settled: heartbeats handed on (static frame); none: the whole
 * list was tried and nothing answered.
 */
export type SeekPhase = "idle" | "seeking" | "joined" | "settled" | "none"

/** One rung of the seek ladder. */
export type RungState = "not-tried" | "listening" | "no-signal" | "found"

/** Visible words per rung state (FOUND is drawn inverted). */
export const RUNG_LABEL: Record<RungState, string> = {
  "not-tried": "not tried",
  listening: "listening",
  "no-signal": "no signal",
  found: "FOUND",
}

/** Heartbeats shown after joining before the readout settles (a few; Layer 7 carries on). */
export const HEARTBEATS = 3
/** How long the node listens on one rung. */
export const SEEK_STEP_MS = 700
/** Time between heartbeats once joined (and before the readout settles). */
export const HEARTBEAT_MS = 650

/**
 * What one "in range" toggle does to the walk:
 * set: no walk yet, nothing to undo · kept: the walk or the join still holds
 * (a network the walk has not reached, or one below the joined network) ·
 * lost: the joined network left range · above: a network higher on the list
 * than the walk had got came into range · appeared: nothing was in range and
 * now something is. Every effect but `kept` puts the board back to idle.
 */
export type RangeEffect = "set" | "kept" | "lost" | "above" | "appeared"

/** The visitor's last range change, for narration. */
export interface RangeChange {
  index: number
  effect: RangeEffect
}

/** State of the seek board. */
export interface SeekState {
  inRange: InRange
  phase: SeekPhase
  /** seeking: the rung being tried; joined/settled: the rung joined. */
  cursor: number
  /** Heartbeats sent since joining, 0..HEARTBEATS. */
  beats: number
  /** How many times SEEK was pressed. */
  runs: number
  /** The last range change (for narration); cleared by SEEK and by every step. */
  change: RangeChange | null
}

/** Board on first paint: nothing tried, nothing moving. */
export const INITIAL_SEEK: SeekState = {
  inRange: DEFAULT_IN_RANGE,
  phase: "idle",
  cursor: 0,
  beats: 0,
  runs: 0,
  change: null,
}

/** Visitor and timer events. `instant` resolves the whole seek at once (reduced motion). */
export type SeekAction =
  | { type: "toggle"; index: number }
  | { type: "seek"; instant?: boolean }
  | { type: "step" }

/** One timer step: the next rung, the join, the next heartbeat, or nothing. */
export function stepSeek(state: SeekState): SeekState {
  switch (state.phase) {
    case "seeking":
      // The walk reads the live range at the rung it is on.
      if (state.inRange[state.cursor]) return { ...state, phase: "joined", beats: 0, change: null }
      if (state.cursor + 1 < NETWORKS.length) return { ...state, cursor: state.cursor + 1, change: null }
      return { ...state, phase: "none", change: null }
    case "joined":
      if (state.beats < HEARTBEATS) return { ...state, beats: state.beats + 1, change: null }
      return { ...state, phase: "settled", change: null }
    default:
      return state
  }
}

/**
 * What toggling network `index` does to the walk in `state`. Rungs above the
 * cursor were tried and heard nothing, so toggling one always brings it into
 * range; the joined rung is in range, so toggling it always takes it out.
 */
export function rangeEffect(state: SeekState, index: number): RangeEffect {
  switch (state.phase) {
    case "idle":
      return "set"
    case "none":
      return "appeared"
    case "seeking":
      // The walk has not reached it yet, or is listening there now: it reads the new value.
      return index < state.cursor ? "above" : "kept"
    case "joined":
    case "settled":
      if (index < state.cursor) return "above"
      return index === state.cursor ? "lost" : "kept"
  }
}

/** Milliseconds until the next automatic step, or null when the board is at rest. */
export function seekDelay(state: SeekState): number | null {
  if (state.phase === "seeking") return SEEK_STEP_MS
  if (state.phase === "joined") return HEARTBEAT_MS
  return null
}

/** Run every remaining step at once: the final state, printed whole. */
export function settleSeek(state: SeekState): SeekState {
  let current = state
  while (seekDelay(current) !== null) current = stepSeek(current)
  return current
}

/** The seek board reducer. */
export function seekReducer(state: SeekState, action: SeekAction): SeekState {
  switch (action.type) {
    case "toggle": {
      if (!isNetworkIndex(action.index)) return state
      const inRange: [boolean, boolean, boolean, boolean] = [...state.inRange]
      inRange[action.index] = !inRange[action.index]
      const effect = rangeEffect(state, action.index)
      const change: RangeChange = { index: action.index, effect }
      // A change that cannot alter the outcome keeps the walk or the join as it is.
      if (effect === "kept") return { ...state, inRange, change }
      // Otherwise the last walk no longer holds: back to idle, and the narration says why.
      return { ...state, inRange, phase: "idle", cursor: 0, beats: 0, change }
    }
    case "seek": {
      const started: SeekState = { ...state, phase: "seeking", cursor: 0, beats: 0, runs: state.runs + 1, change: null }
      return action.instant ? settleSeek(started) : started
    }
    case "step":
      return stepSeek(state)
  }
}

/** The ladder, rung by rung, in list order. */
export function rungStates(state: SeekState): RungState[] {
  return NETWORKS.map((_, i): RungState => {
    switch (state.phase) {
      case "idle":
        return "not-tried"
      case "none":
        return "no-signal"
      case "seeking":
        return i < state.cursor ? "no-signal" : i === state.cursor ? "listening" : "not-tried"
      case "joined":
      case "settled":
        return i < state.cursor ? "no-signal" : i === state.cursor ? "found" : "not-tried"
    }
  })
}

/** What the readout window shows. */
export type ScopeMode = "idle" | "noise" | "carrier" | "settled" | "flat"

/** idle: standing by · noise: seeking · carrier: joined, heartbeats · settled: static carrier · flat: nothing in range. */
export function scopeMode(state: SeekState): ScopeMode {
  switch (state.phase) {
    case "idle":
      return "idle"
    case "seeking":
      return "noise"
    case "joined":
      return "carrier"
    case "settled":
      return "settled"
    case "none":
      return "flat"
  }
}

/** True only for the modes that move (during a seek); every other mode is one static frame. */
export function scopeAnimates(mode: ScopeMode): boolean {
  return mode === "noise" || mode === "carrier"
}

/** Short caption over the readout window. */
export const SCOPE_CAPTION: Record<ScopeMode, string> = {
  idle: "standing by",
  noise: "noise · listening",
  carrier: "clean carrier · heartbeats",
  settled: "carrier steady",
  flat: "no carrier",
}

/** The readout canvas's aria-label for the current state. */
export function scopeLabel(state: SeekState): string {
  const name = networkName(state.cursor)
  switch (scopeMode(state)) {
    case "idle":
      // Idle after a seek only follows a range change that undid the walk.
      return state.runs > 0
        ? "Signal readout: standing by, the range changed; press SEEK again"
        : "Signal readout: standing by, no seek yet"
    case "noise":
      return `Signal readout: noise while listening on ${name}`
    case "carrier":
      return `Signal readout: clean carrier from ${name}, heartbeats going out`
    case "settled":
      return `Signal readout: steady carrier from ${name}`
    case "flat":
      return "Signal readout: flat line, nothing in range"
  }
}

/** The heartbeat row's value in words (the pips are drawn squares, hidden from screen readers). */
export function heartbeatStatus(state: SeekState): string {
  switch (state.phase) {
    case "idle":
    case "seeking":
      return "none yet"
    case "joined":
      return state.beats === 0 ? "starting" : "going out"
    case "settled":
      return "sent; Layer 7 carries on"
    case "none":
      return "none, nothing in range"
  }
}

function silentBefore(cursor: number): string {
  const names = NETWORKS.slice(0, cursor).map((_, i) => networkName(i))
  return names.length === 0 ? "" : `${names.join(", ")}: no signal. `
}

/** "Seek 2 · " on a result line, so a repeated seek with the same answer is announced again. */
function seekTag(state: SeekState): string {
  return state.runs > 0 ? `Seek ${state.runs} · ` : ""
}

/** The live line right after a toggle. */
function rangeNarration(state: SeekState, change: RangeChange): string {
  const name = networkName(change.index)
  const head = `${name} is ${state.inRange[change.index] ? "now in range" : "now out of range"}.`
  const encoder = `Encoder: ${encoderOutput(state.inRange)}.`
  switch (change.effect) {
    case "set":
      return `${head} ${encoder} Press SEEK to walk the list.`
    case "kept":
      return state.phase === "seeking"
        ? `${head} The walk has not passed it, so it carries on.`
        : `${head} Encoder still says JOIN #${state.cursor + 1}, so the node stays on ${networkName(state.cursor)}.`
    case "lost":
      return `${name}, the network the node had joined, is now out of range. A real node falls back down the list. ${encoder} Press SEEK to walk it again.`
    case "above":
      return `${head} It sits higher on the list, so the last walk no longer holds. ${encoder} Press SEEK to walk it again.`
    case "appeared":
      return `${head} Messages were waiting on the device, and a real node keeps trying its list. ${encoder} Press SEEK to walk it again.`
  }
}

/** The board's live-line text for the current state. */
export function seekNarration(state: SeekState): string {
  if (state.change) return rangeNarration(state, state.change)
  const name = networkName(state.cursor)
  const net = NETWORKS[state.cursor]
  switch (state.phase) {
    case "idle":
      return "Set which networks are in range, then press SEEK."
    case "seeking":
      return state.cursor === 0
        ? `Trying ${name}, ${net.medium}…`
        : `${networkName(state.cursor - 1)}: no signal. Trying ${name}, ${net.medium}…`
    case "joined":
      return state.beats === 0
        ? `${name}: FOUND. Joining #${state.cursor + 1} and starting heartbeats.`
        : `Heartbeats going out on ${name}.`
    case "settled":
      return `${seekTag(state)}${silentBefore(state.cursor)}Joined ${name} (#${state.cursor + 1}). Heartbeats carry on; Layer 7 picks them up.`
    case "none":
      return `${seekTag(state)}Network A to D: no signal. NONE IN RANGE, so messages wait on the device until a network appears.`
  }
}

// ─── B. Thin Bridge ────────────────────────────────────────────────────────

/** The two networks the bridge joins: they cannot hear each other. */
export type Side = "a" | "b"

/** Names and media of the two sides. */
export const BRIDGE_SIDES: Record<Side, { name: string; medium: string }> = {
  a: { name: "Network A", medium: "long-range radio" },
  b: { name: "Network B", medium: "Wi-Fi / Bluetooth" },
}

/** The opposite side. */
export function otherSide(side: Side): Side {
  return side === "a" ? "b" : "a"
}

/** A sealed packet: an outer wrapper for the network it is on, around a payload nobody opens. */
export interface Packet {
  wrapper: Side
  payload: string
}

/** launch: at the source · to-bridge: travelling · swap: at the bridge, wrapper changed · to-dest · delivered. */
export type PacketStage = "idle" | "launch" | "to-bridge" | "swap" | "to-dest" | "delivered"

/** Where the packet is drawn. */
export type PacketSpot = Side | "bridge"

/** What the visitor did last (picks the live-line text). */
export type BridgeEvent = "none" | "packet" | "detail" | "more"

/** State of the thin bridge. */
export interface BridgeState {
  stage: PacketStage
  from: Side
  packet: Packet | null
  /** Packets sent so far; the current packet's number. */
  runs: number
  detailOpen: boolean
  /** Times MAKE THE BRIDGE DO MORE was pressed (each press is refused). */
  refusals: number
  last: BridgeEvent
}

/** Bridge on first paint: no packet, and the does / does not detail open, so the rule is read without a click. */
export const INITIAL_BRIDGE: BridgeState = {
  stage: "idle",
  from: "a",
  packet: null,
  runs: 0,
  detailOpen: true,
  refusals: 0,
  last: "none",
}

/** Visitor and timer events. `instant` delivers at once (reduced motion: travel cuts to the destination). */
export type BridgeAction =
  | { type: "send"; from: Side; instant?: boolean }
  | { type: "step" }
  | { type: "toggle-detail" }
  | { type: "do-more" }

/** What the bridge does. */
export const BRIDGE_DOES = "carry the bare minimum across, buffer briefly"
/** What the bridge does not do. */
export const BRIDGE_DOES_NOT = "reinvent the radio, reinvent routing, read the payload"
/** Answer to MAKE THE BRIDGE DO MORE. */
export const REFUSED_LINE = "REFUSED: bridges stay thin"

/** CSS travel time between two spots; every travel step waits a little longer. */
export const TRAVEL_MS = 600
const LAUNCH_MS = 350
const TRAVEL_STEP_MS = TRAVEL_MS + 100
const SWAP_HOLD_MS = 700

const PAYLOAD_GLYPHS = [..."░▒▓█"]
/** Length of the drawn payload pattern. */
export const PAYLOAD_LENGTH = 10

/** The sealed payload drawn for packet number `run`: deterministic, block glyphs only. */
export function sealedPayload(run: number): string {
  const rng = createRng(`l6-payload-${run}`)
  return Array.from({ length: PAYLOAD_LENGTH }, () => pick(rng, PAYLOAD_GLYPHS)).join("")
}

/** One timer step of the packet's trip. Only the swap touches the packet, and only its wrapper. */
export function stepBridge(state: BridgeState): BridgeState {
  switch (state.stage) {
    case "launch":
      return { ...state, stage: "to-bridge", last: "packet" }
    case "to-bridge":
      return {
        ...state,
        stage: "swap",
        packet: state.packet ? { ...state.packet, wrapper: otherSide(state.from) } : null,
        last: "packet",
      }
    case "swap":
      return { ...state, stage: "to-dest", last: "packet" }
    case "to-dest":
      return { ...state, stage: "delivered", last: "packet" }
    default:
      return state
  }
}

/** Milliseconds until the packet's next step, or null when nothing is moving. */
export function bridgeDelay(state: BridgeState): number | null {
  switch (state.stage) {
    case "launch":
      return LAUNCH_MS
    case "to-bridge":
    case "to-dest":
      return TRAVEL_STEP_MS
    case "swap":
      return SWAP_HOLD_MS
    default:
      return null
  }
}

/** Run every remaining step at once. */
export function settleBridge(state: BridgeState): BridgeState {
  let current = state
  while (bridgeDelay(current) !== null) current = stepBridge(current)
  return current
}

/** The thin bridge reducer. */
export function bridgeReducer(state: BridgeState, action: BridgeAction): BridgeState {
  switch (action.type) {
    case "send": {
      const runs = state.runs + 1
      const launched: BridgeState = {
        ...state,
        stage: "launch",
        from: action.from,
        packet: { wrapper: action.from, payload: sealedPayload(runs) },
        runs,
        last: "packet",
      }
      return action.instant ? settleBridge(launched) : launched
    }
    case "step":
      return stepBridge(state)
    case "toggle-detail":
      return { ...state, detailOpen: !state.detailOpen, last: "detail" }
    case "do-more":
      return { ...state, refusals: state.refusals + 1, last: "more" }
  }
}

/** Where the packet is drawn, or null when there is none. */
export function packetSpot(state: BridgeState): PacketSpot | null {
  switch (state.stage) {
    case "idle":
      return null
    case "launch":
      return state.from
    case "to-bridge":
    case "swap":
      return "bridge"
    case "to-dest":
    case "delivered":
      return otherSide(state.from)
  }
}

/** The bridge's live-line text for the current state. */
export function bridgeNarration(state: BridgeState): string {
  switch (state.last) {
    case "none":
      return "Press Network A or Network B to drop a sealed packet through the bridge."
    case "detail":
      return state.detailOpen ? "Bridge detail open: what it does and does not do." : "Bridge detail closed."
    case "more": {
      // Each press reads differently, so a repeated press is announced again.
      const head = state.refusals > 1 ? `Ask ${state.refusals}, still ${REFUSED_LINE}` : REFUSED_LINE
      return `${head}. It never reinvents the radio or routing, and it never reads the payload.`
    }
    case "packet":
      break
  }
  // Every line names the packet, so a repeated trip (instant under reduced motion) is announced again.
  const packet = `Packet ${state.runs}`
  const src = BRIDGE_SIDES[state.from]
  const dest = BRIDGE_SIDES[otherSide(state.from)]
  switch (state.stage) {
    case "idle":
    case "launch":
    case "to-bridge":
      return `${packet} leaves ${src.name}, sealed, in a ${src.medium} wrapper.`
    case "swap":
    case "to-dest":
      return `${packet} at the bridge: ${src.medium} wrapper off, ${dest.medium} wrapper on. The payload is not opened.`
    case "delivered":
      return `${packet} arrived on ${dest.name} in a ${dest.medium} wrapper. Only the wrapper changed at the bridge; the payload is exactly as it left.`
  }
}
