// Layer 7 · Relay & Presence: the pure model behind the Presence Map and the
// Heartbeat Lanes (plan §5 L7). React-free and deterministic: no randomness,
// no clock. Time is an integer `beat` that only advances through `tick`, and
// the widget dispatches ticks only while it is in view and something a click
// caused is still resolving (W14: nothing moves while idle).
//
// Logic (os/README.md, Relay & Presence):
// - every node keeps announcing that it is reachable (heartbeats);
// - a node with internet becomes a gateway: "sometimes" flushes its queue when
//   it gets online, "always" streams messages and updates in live;
// - relays only repeat and can never be gateways: a relay never keeps the
//   message, so when it cannot pass it on, the last node that keeps it
//   (the sender at first) still holds it and waits;
// - a node that loses its internet stays a plain mesh node;
// - delivery paths form from what is reachable now, and a node that goes
//   silent is only routed around once its next heartbeats fail to arrive.

/** The five map nodes, in reading order (top row, middle, bottom row). */
export const NODE_IDS = ["laptop", "home-server", "relay", "phone", "radio-box"] as const

/** One of the five map nodes. */
export type NodeId = (typeof NODE_IDS)[number]

/** A node's internet: none, now and then, or all the time. */
export type InternetMode = "none" | "sometimes" | "always"

/** The three internet choices, in chip order. */
export const INTERNET_MODES: readonly InternetMode[] = ["none", "sometimes", "always"]

/** Chip labels of the internet row. */
export const INTERNET_LABELS: Readonly<Record<InternetMode, string>> = {
  none: "NO INTERNET",
  sometimes: "SOMETIMES",
  always: "ALWAYS",
}

/** Where a node's role label sits from 640 px up (below 640 px it is always under the square). */
export type LabelSide = "left" | "right" | "below"

/** A fixed node on the map. Coordinates are percent of the map box. */
export interface MapNode {
  id: NodeId
  /** Plain role word shown on the map and in the lanes. */
  label: string
  /** The same word with its article, for sentences ("the home server"). */
  the: string
  x: number
  y: number
  side: LabelSide
  /** Relays only repeat: they can never hold internet as a gateway. */
  canBeGateway: boolean
  /** Offset of the node's heartbeat tick (lanes stay staggered, never random). */
  tickPhase: number
  /** Offset of the node's online window while its internet is "sometimes". */
  burstPhase: number
}

/** The node every SEND TO THE OUTSIDE starts from. */
export const ORIGIN: NodeId = "phone"

/** A node is heard on one beat in this many when it has nothing else to carry (its heartbeat). */
export const TICK_PERIOD = 3
/**
 * Beats a node stays silent before it is marked unreachable and paths re-form:
 * two heartbeat periods, so every node misses at least two of its expected
 * heartbeats first (never declared gone before its next heartbeat was due).
 */
export const MISS_LIMIT = 2 * TICK_PERIOD
/** A "sometimes" node is online for BURST_ON beats out of every BURST_PERIOD. */
export const BURST_PERIOD = 8
export const BURST_ON = 3
/** Beats shown in each heartbeat lane (the rightmost cell is now). */
export const LANE_BEATS = 16
/** Beats the clock keeps running after a click, so the rings and lanes answer it. */
export const SETTLE_BEATS = 8
/** Safety cap for `settle` (reduced motion resolves everything at once). */
export const SETTLE_CAP = 64
/** Milliseconds per beat while the clock runs. */
export const BEAT_MS = 600
/** Map y (percent) of the bottom edge of the wider-world band. */
export const WORLD_EDGE = 16
/** Map y (percent) where a packet sits once it is out in the wider world. */
export const WORLD_Y = 8

/** The relay rule, shown when a relay is clicked (plan §5 L7). */
export const RELAY_LINE = "Relays only repeat. They cannot be gateways."

/**
 * Edge rule for the labels: a node whose label sits under it ("below") keeps
 * at least this many percent from either side of the map, so its widest label
 * (the 10 px "unreachable" tag) stays inside the box from 375 px down to 320 px.
 */
export const EDGE_INSET = 17

// The two bottom-corner nodes label below at every width (their labels grow
// downward, never toward the box edge); the upper pair label outward from 640 px.
export const NODES: Readonly<Record<NodeId, MapNode>> = {
  laptop: { id: "laptop", label: "laptop", the: "the laptop", x: 26, y: 38, side: "left", canBeGateway: true, tickPhase: 2, burstPhase: 3 },
  "home-server": { id: "home-server", label: "home server", the: "the home server", x: 74, y: 38, side: "right", canBeGateway: true, tickPhase: 0, burstPhase: 7 },
  relay: { id: "relay", label: "relay", the: "the relay", x: 50, y: 57, side: "below", canBeGateway: false, tickPhase: 1, burstPhase: 0 },
  phone: { id: "phone", label: "phone", the: "the phone", x: EDGE_INSET, y: 76, side: "below", canBeGateway: true, tickPhase: 0, burstPhase: 5 },
  "radio-box": { id: "radio-box", label: "radio box", the: "the radio box", x: 100 - EDGE_INSET, y: 76, side: "below", canBeGateway: true, tickPhase: 2, burstPhase: 1 },
}

/** An undirected mesh link (two nodes within reach of each other). */
export type Link = readonly [NodeId, NodeId]

/** The mesh links. Their order is the tie-break when two paths are equally short. */
export const LINKS: readonly Link[] = [
  ["phone", "relay"],
  ["laptop", "relay"],
  ["relay", "home-server"],
  ["relay", "radio-box"],
  ["phone", "laptop"],
  ["home-server", "radio-box"],
  ["phone", "radio-box"],
]

function buildNeighbours(): Readonly<Record<NodeId, readonly NodeId[]>> {
  const out: Record<NodeId, NodeId[]> = { laptop: [], "home-server": [], relay: [], phone: [], "radio-box": [] }
  for (const [a, b] of LINKS) {
    out[a].push(b)
    out[b].push(a)
  }
  return out
}

const NEIGHBOURS = buildNeighbours()

/** The nodes linked to `id`, in tie-break order. */
export function neighbours(id: NodeId): readonly NodeId[] {
  return NEIGHBOURS[id]
}

/** Upper-case the first letter ("the relay" → "The relay"). */
export function capitalise(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

// ---- node state ----------------------------------------------------------

/** What the model tracks per node. */
export interface NodeState {
  mode: InternetMode
  /** Beat at which the node moved out of range; null while in range. */
  outSince: number | null
}

/** Every node's state. */
export type Nodes = Readonly<Record<NodeId, NodeState>>

/** How the mesh sees a node: in range, silent (heartbeats missing, not yet given up), or unreachable. */
export type Reach = "in-range" | "silent" | "unreachable"

/** Reachability of a node at `beat`: silent for MISS_LIMIT beats after it moves out of range, then unreachable. */
export function reachOf(node: NodeState, beat: number): Reach {
  if (node.outSince === null) return "in-range"
  return beat - node.outSince < MISS_LIMIT ? "silent" : "unreachable"
}

/** The short reach word: the map tag under a node and the node button's name. */
export const REACH_WORD: Readonly<Record<Reach, string>> = {
  "in-range": "in range",
  silent: "silent",
  unreachable: "unreachable",
}

/** The NODE row's reach label: a dropped node reads as the red ERROR "unreachable" (plan §5 L7). */
export function reachRowLabel(reach: Reach): string {
  return reach === "unreachable" ? `ERROR · ${REACH_WORD.unreachable}` : REACH_WORD[reach]
}

/** True when the node is (believed) reachable: routing still uses a silent node until it times out. */
export function isKnown(node: NodeState, beat: number): boolean {
  return reachOf(node, beat) !== "unreachable"
}

/** True when the node holds internet as a gateway (any mode but none; never a relay). */
export function isGateway(id: NodeId, mode: InternetMode): boolean {
  return NODES[id].canBeGateway && mode !== "none"
}

/** True when the node has internet at `beat`: always, or inside its online window when "sometimes". */
export function isOnline(id: NodeId, mode: InternetMode, beat: number): boolean {
  if (!isGateway(id, mode)) return false
  if (mode === "always") return true
  return mod(beat + NODES[id].burstPhase, BURST_PERIOD) < BURST_ON
}

/** The role a node plays right now (drives the role line, the label and the lanes). */
export type NodeRole = "relay" | "mesh" | "flush" | "stream"

/** relay = repeats only; mesh = no internet; flush = gateway online sometimes; stream = always-on gateway. */
export function roleOf(id: NodeId, mode: InternetMode): NodeRole {
  if (!NODES[id].canBeGateway) return "relay"
  if (mode === "always") return "stream"
  if (mode === "sometimes") return "flush"
  return "mesh"
}

/** One line on what the node does, in plain words. */
export function roleLine(role: NodeRole): string {
  switch (role) {
    case "relay":
      return RELAY_LINE
    case "stream":
      return "Gateway: always online, it streams messages and updates in live."
    case "flush":
      return "Gateway: it flushes its queue whenever it gets online."
    case "mesh":
      return "Mesh node: no internet, so it repeats and keeps announcing that it is reachable."
  }
}

/** How a link looks: up, touching a silent node, or down (an end is unreachable). */
export type LinkState = "up" | "silent" | "down"

/** State of a mesh link at `beat`. */
export function linkState(nodes: Nodes, [a, b]: Link, beat: number): LinkState {
  const ra = reachOf(nodes[a], beat)
  const rb = reachOf(nodes[b], beat)
  if (ra === "unreachable" || rb === "unreachable") return "down"
  if (ra === "silent" || rb === "silent") return "silent"
  return "up"
}

// ---- path finding --------------------------------------------------------

/**
 * Shortest path (fewest hops) from `from` to the nearest node matching
 * `isTarget`, over links whose ends are both still known at `beat`. Ties go to
 * the LINKS order. Returns [from, …, target], or null when no target is in reach.
 */
export function findPath(nodes: Nodes, from: NodeId, beat: number, isTarget: (id: NodeId) => boolean): NodeId[] | null {
  if (!isKnown(nodes[from], beat)) return null
  const prev = new Map<NodeId, NodeId | null>([[from, null]])
  const queue: NodeId[] = [from]
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]
    if (isTarget(current)) {
      const path: NodeId[] = []
      let step: NodeId | null = current
      while (step !== null) {
        path.unshift(step)
        step = prev.get(step) ?? null
      }
      return path
    }
    for (const next of NEIGHBOURS[current]) {
      if (!prev.has(next) && isKnown(nodes[next], beat)) {
        prev.set(next, current)
        queue.push(next)
      }
    }
  }
  return null
}

/** Why a packet is waiting. */
export type WaitReason =
  /** In a "sometimes" gateway's queue, until it gets online. */
  | "queue"
  /** No gateway in reach at all; it moves on when one appears. */
  | "no-gateway"
  /** A node it must pass next went silent; paths re-form once it is marked unreachable. */
  | "no-answer"
  /** The node holding it moved out of range. */
  | "carried"

/** What a packet at `at` does on a beat. `target` is the gateway it is heading for. */
export type Decision =
  | { kind: "exit" }
  | { kind: "hop"; route: readonly NodeId[]; target: NodeId }
  | { kind: "wait"; reason: WaitReason; route: readonly NodeId[]; target: NodeId | null }

function lastOf(path: readonly NodeId[] | null): NodeId | null {
  return path && path.length > 0 ? path[path.length - 1] : null
}

/**
 * Which gateway a packet at `at` heads for. A packet keeps its gateway while
 * that one is still a gateway and still in reach, so it never chases two
 * "sometimes" gateways back and forth. It changes only:
 * - when it has none, or its gateway lost internet or went out of reach:
 *   the nearest gateway online now, else the nearest "sometimes" one;
 * - when its "sometimes" gateway is offline and an always-on one is in reach.
 */
export function chooseTarget(nodes: Nodes, at: NodeId, beat: number, current: NodeId | null = null): NodeId | null {
  const reachable = (target: NodeId) => findPath(nodes, at, beat, (id) => id === target) !== null
  if (current !== null && isGateway(current, nodes[current].mode) && reachable(current)) {
    if (isOnline(current, nodes[current].mode, beat)) return current
    return lastOf(findPath(nodes, at, beat, (id) => roleOf(id, nodes[id].mode) === "stream")) ?? current
  }
  return (
    lastOf(findPath(nodes, at, beat, (id) => isOnline(id, nodes[id].mode, beat))) ??
    lastOf(findPath(nodes, at, beat, (id) => isGateway(id, nodes[id].mode)))
  )
}

/** True for a node that keeps a message it carries (every node but a relay). */
export function keepsMessages(id: NodeId): boolean {
  return NODES[id].canBeGateway
}

/**
 * The first silent node the packet would have to pass before it is kept
 * again: the next hop, and, while that hop is a relay (relays keep nothing),
 * every hop after it up to the next node that keeps it. Null when all answer.
 */
export function blockerOf(nodes: Nodes, route: readonly NodeId[], beat: number): NodeId | null {
  for (let i = 1; i < route.length; i++) {
    const id = route[i]
    if (reachOf(nodes[id], beat) === "silent") return id
    if (keepsMessages(id)) return null
  }
  return null
}

/**
 * The routing rule, from what is reachable now:
 * 1. the holder has internet right now → out to the wider world;
 * 2. the holder is out of range → wait with it;
 * 3. head for the target gateway (chooseTarget) along the shortest path that is
 *    reachable now; already there and it is offline → wait in its queue;
 *    no gateway in reach → wait where it is;
 * 4. a node it must pass next is silent (the next hop, or the hop after a
 *    relay, since a relay only repeats) → wait until the mesh gives up on it.
 * A relay never ends up keeping the message: stepPacket hands a waiting
 * relay's packet back to the last node that keeps it.
 */
export function decide(nodes: Nodes, at: NodeId, beat: number, target: NodeId | null = null): Decision {
  const holder = nodes[at]
  if (isOnline(at, holder.mode, beat)) return { kind: "exit" }
  if (reachOf(holder, beat) !== "in-range") return { kind: "wait", reason: "carried", route: [at], target }
  const goal = chooseTarget(nodes, at, beat, target)
  const path = goal === null ? null : findPath(nodes, at, beat, (id) => id === goal)
  if (goal === null || path === null) return { kind: "wait", reason: "no-gateway", route: [at], target: null }
  if (path.length === 1) return { kind: "wait", reason: "queue", route: path, target: goal }
  if (blockerOf(nodes, path, beat) !== null) return { kind: "wait", reason: "no-answer", route: path, target: goal }
  return { kind: "hop", route: path, target: goal }
}

// ---- heartbeat lanes -----------------------------------------------------

/** One beat of a heartbeat lane. */
export type LaneCell = "heard" | "quiet" | "gone"

/**
 * The lane script, never random: out of range = gone; online as a gateway =
 * heard (always = solid, sometimes = bursts); otherwise one heartbeat tick per
 * TICK_PERIOD beats, quiet in between.
 */
export function laneCell(id: NodeId, mode: InternetMode, inRange: boolean, beat: number): LaneCell {
  if (!inRange) return "gone"
  if (isOnline(id, mode, beat)) return "heard"
  return mod(beat + NODES[id].tickPhase, TICK_PERIOD) === 0 ? "heard" : "quiet"
}

/** Every node's lane, oldest beat first; the last cell is the current beat. */
export type Lanes = Readonly<Record<NodeId, readonly LaneCell[]>>

function mapNodes<T>(fn: (id: NodeId) => T): Record<NodeId, T> {
  return {
    laptop: fn("laptop"),
    "home-server": fn("home-server"),
    relay: fn("relay"),
    phone: fn("phone"),
    "radio-box": fn("radio-box"),
  }
}

/** Lanes for the LANE_BEATS beats ending at `beat`, as if `nodes` had always held. */
export function lanesFor(nodes: Nodes, beat: number): Lanes {
  return mapNodes((id) =>
    Array.from({ length: LANE_BEATS }, (_, i) => laneCell(id, nodes[id].mode, nodes[id].outSince === null, beat - LANE_BEATS + 1 + i)),
  )
}

function rewriteNow(lanes: Lanes, id: NodeId, node: NodeState, beat: number): Lanes {
  const lane = lanes[id]
  return { ...lanes, [id]: [...lane.slice(0, -1), laneCell(id, node.mode, node.outSince === null, beat)] }
}

function advanceLanes(lanes: Lanes, nodes: Nodes, beat: number): Lanes {
  return mapNodes((id) => [...lanes[id].slice(1), laneCell(id, nodes[id].mode, nodes[id].outSince === null, beat)])
}

/** Plain words for a lane, for screen readers (the cells themselves are drawn). */
export function laneSummary(id: NodeId, node: NodeState): string {
  if (node.outSince !== null) return `${NODES[id].label}: gone, out of range`
  switch (roleOf(id, node.mode)) {
    case "stream":
      return `${NODES[id].label}: heard on every beat`
    case "flush":
      return `${NODES[id].label}: heard in bursts while online, a heartbeat now and then`
    default:
      return `${NODES[id].label}: a heartbeat now and then`
  }
}

/** Short muted tag under a lane label. */
export function laneTag(id: NodeId, node: NodeState): string {
  if (node.outSince !== null) return "out of range"
  switch (roleOf(id, node.mode)) {
    case "relay":
      return "repeats only"
    case "stream":
      return "always online"
    case "flush":
      return "sometimes online"
    case "mesh":
      return "no internet"
  }
}

// ---- packet --------------------------------------------------------------

/** Where the one packet is. */
export type PacketStatus = "moving" | "waiting" | "out"

/** The packet sent by SEND TO THE OUTSIDE. */
export interface Packet {
  /** Increments per send (a fresh packet never animates from the old spot). */
  id: number
  /** The node holding it (for "out": the gateway it left through). */
  at: NodeId
  status: PacketStatus
  reason: WaitReason | null
  /** The path planned from `at`, at the last beat: [at, …, target]. */
  route: readonly NodeId[]
  /** The gateway it is heading for (null: none in reach yet). */
  target: NodeId | null
  /** Nodes it has been held by, origin first; the last one is `at`. */
  trail: readonly NodeId[]
}

function sameRoute(a: readonly NodeId[], b: readonly NodeId[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

function names(route: readonly NodeId[]): string {
  return route.map((id) => NODES[id].label).join(" → ")
}

/**
 * The packet's whole path as one line: where it has been, then the plan ahead,
 * then "wider world" when the plan ends at a gateway (or it is already out).
 */
export function pathLine(nodes: Nodes, packet: Packet): string {
  if (packet.status === "out") return `${names(packet.trail)} → wider world`
  const ahead = packet.route.length > 0 ? packet.route : [packet.at]
  const full = [...packet.trail.slice(0, -1), ...ahead]
  const target = ahead[ahead.length - 1]
  const reachesOut = isGateway(target, nodes[target].mode) && packet.reason !== "carried"
  return reachesOut ? `${names(full)} → wider world` : names(full)
}

/** One sentence for why a packet waits. "no-answer" names the silent node it must pass (blockerOf). */
export function waitLine(nodes: Nodes, beat: number, reason: WaitReason, at: NodeId, route: readonly NodeId[]): string {
  const holder = NODES[at].the
  switch (reason) {
    case "queue":
      return `Waiting in ${holder}'s queue. It flushes when ${holder} gets online.`
    case "no-gateway":
      return `Waiting at ${holder}: no gateway in reach. It moves on when one appears.`
    case "no-answer": {
      const silent = blockerOf(nodes, route, beat) ?? route[1] ?? at
      return `Waiting at ${holder}: ${NODES[silent].the} went silent. Paths re-form once it misses its heartbeats.`
    }
    case "carried":
      return `Waiting: ${holder} is out of range with it.`
  }
}

/**
 * The sentence for a packet leaving through `before.at`. "Flushed its queue"
 * only when it really sat in that gateway's queue while the gateway was
 * offline (or carried out of range) and the gateway has just got online.
 */
export function exitLine(nodes: Nodes, before: Packet): string {
  const via = before.at
  const gateway = NODES[via].the
  if (nodes[via].mode === "always") return `Out to the wider world through ${gateway}, an always-on gateway.`
  const queued = before.status === "waiting" && (before.reason === "queue" || before.reason === "carried")
  return queued
    ? `${capitalise(gateway)} got online and flushed its queue: out to the wider world.`
    : `Out to the wider world through ${gateway} while it is online.`
}

/** The sentence for a relay that cannot pass the message on: it keeps nothing. */
export function handBackLine(relay: NodeId, keeper: NodeId): string {
  return `${capitalise(NODES[relay].the)} only repeats and keeps nothing: ${NODES[keeper].the} still holds it.`
}

/** "the relay", "the relay and the phone", "the relay, the phone and the laptop". */
function listNames(ids: readonly NodeId[]): string {
  const names = ids.map((id) => NODES[id].the)
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/**
 * The sentence for nodes that just timed out (one sentence even when several
 * time out on the same beat). `alone`: nothing else to say this beat, so it
 * also says that paths re-form (otherwise the packet's new path says it).
 */
export function unreachableLine(ids: readonly NodeId[], alone: boolean): string {
  const one = ids.length === 1
  const reform = alone ? ` Paths re-form around ${one ? "it" : "them"}.` : ""
  return `${capitalise(listNames(ids))} missed ${one ? "its" : "their"} heartbeats: unreachable.${reform}`
}

/** The packet given back to the last node in its trail that keeps messages (relays keep nothing). */
function handBack(packet: Packet): Packet {
  let k = packet.trail.length - 1
  while (k > 0 && !keepsMessages(packet.trail[k])) k--
  const at = packet.trail[k]
  return { ...packet, at, trail: packet.trail.slice(0, k + 1), route: [at] }
}

/** Where the packet square is drawn: map percent plus a pixel offset, and the side its WAITING / OUT tag sits on. */
export interface PacketPlacement {
  x: number
  y: number
  dx: number
  dy: number
  tag: "left" | "right"
}

/**
 * Placement of the packet. Out in the band, the tag points away from the
 * centred "wider world" word, but inward near the box edges. At a node the
 * square sits up and to one side of it: right of the left-hand nodes and the
 * relay, left of the right-hand nodes, with the tag continuing that way, so it
 * stays inside the box and clear of the labels under the squares. Below the
 * relay (the bottom corners) it sits higher, so its tag passes above the
 * relay's status line on narrow maps (checked from 375 px up).
 */
export function packetPlacement(packet: Pick<Packet, "at" | "status">): PacketPlacement {
  const { x, y } = NODES[packet.at]
  if (packet.status === "out") {
    const nearEdge = x < EDGE_INSET + 4 || x > 100 - EDGE_INSET - 4
    const outward = x < 50 ? "left" : "right"
    return { x, y: WORLD_Y, dx: 0, dy: 0, tag: nearEdge ? (outward === "left" ? "right" : "left") : outward }
  }
  const right = x <= 50
  return { x, y, dx: right ? 16 : -16, dy: y > NODES.relay.y ? -28 : -16, tag: right ? "right" : "left" }
}

function resting(packet: Packet, decision: Decision): Packet {
  if (decision.kind === "wait") {
    return { ...packet, status: "waiting", reason: decision.reason, route: decision.route, target: decision.target }
  }
  if (decision.kind === "hop") return { ...packet, status: "moving", reason: null, route: decision.route, target: decision.target }
  return { ...packet, status: "moving", reason: null, route: [packet.at], target: packet.at }
}

/**
 * One beat of the packet. Returns the new packet and a sentence when something
 * worth announcing happened. A packet never rests on a relay: when the relay
 * cannot pass it on (out of range, no gateway in reach, the next node silent),
 * the last node that keeps it (the sender still has its copy) holds it, and
 * the path re-forms from there.
 */
export function stepPacket(nodes: Nodes, packet: Packet | null, beat: number): { packet: Packet | null; note: string | null } {
  if (!packet || packet.status === "out") return { packet, note: null }
  const decision = decide(nodes, packet.at, beat, packet.target)

  if (decision.kind === "exit") {
    return { packet: { ...packet, status: "out", reason: null, route: [packet.at] }, note: exitLine(nodes, packet) }
  }

  if (decision.kind === "wait") {
    if (!keepsMessages(packet.at)) {
      const back = handBack(packet)
      if (back.at !== packet.at) {
        const next = resting(back, decide(nodes, back.at, beat, packet.target))
        const notes = [handBackLine(packet.at, back.at)]
        if (next.status === "waiting" && next.reason) notes.push(waitLine(nodes, beat, next.reason, next.at, next.route))
        return { packet: next, note: notes.join(" ") }
      }
    }
    const next = resting(packet, decision)
    const changed = packet.status !== "waiting" || packet.reason !== decision.reason || !sameRoute(packet.route, decision.route)
    return { packet: next, note: changed ? waitLine(nodes, beat, decision.reason, packet.at, decision.route) : null }
  }

  // hop: move one node along the path, then look at the plan from there.
  const to = decision.route[1]
  const moved: Packet = { ...packet, at: to, trail: [...packet.trail, to] }
  const after = resting(moved, decide(nodes, to, beat, decision.target))
  const notes: string[] = []
  if (packet.status === "waiting") notes.push(`Moving on: ${pathLine(nodes, after)}.`)
  else if (!sameRoute(packet.route, decision.route)) notes.push(`New path: ${pathLine(nodes, after)}.`)
  if (after.status === "waiting" && after.reason) notes.push(waitLine(nodes, beat, after.reason, after.at, after.route))
  return { packet: after, note: notes.length > 0 ? notes.join(" ") : null }
}

// ---- the widget state ----------------------------------------------------

/** Everything the Presence Map and the Heartbeat Lanes show. */
export interface PresenceState {
  beat: number
  nodes: Nodes
  selected: NodeId
  packet: Packet | null
  /** Packets sent so far (the next packet's id). */
  sent: number
  lanes: Lanes
  /** The clock keeps running until this beat after a click. */
  runUntil: number
  /** Beat of the last tick: heartbeat rings show only on a ticked beat. */
  pulseBeat: number | null
  /** The live line. */
  notice: string
}

/** User actions carry `settle` under reduced motion: the result is resolved to its final state at once. */
export type PresenceAction =
  | { type: "select"; id: NodeId; settle?: boolean }
  | { type: "setMode"; id: NodeId; mode: InternetMode; settle?: boolean }
  | { type: "setRange"; id: NodeId; inRange: boolean; settle?: boolean }
  | { type: "send"; settle?: boolean }
  | { type: "tick" }

/** The opening map: the home server always online, the laptop sometimes, the rest without internet. */
export const INITIAL_NODES: Nodes = {
  laptop: { mode: "sometimes", outSince: null },
  "home-server": { mode: "always", outSince: null },
  relay: { mode: "none", outSince: null },
  phone: { mode: "none", outSince: null },
  "radio-box": { mode: "none", outSince: null },
}

/** Opening hint in the live line (not announced: it is there from the first render). */
export const OPENING_NOTICE = "Pick a node to change its internet, or send something to the outside."

/** The deterministic opening state (same on the server and the client). */
export function createInitialState(): PresenceState {
  return {
    beat: 0,
    nodes: INITIAL_NODES,
    selected: "laptop",
    packet: null,
    sent: 0,
    lanes: lanesFor(INITIAL_NODES, 0),
    runUntil: 0,
    pulseBeat: null,
    notice: OPENING_NOTICE,
  }
}

/** True while something a click caused is still resolving, so the clock should run. */
export function isActive(state: PresenceState): boolean {
  if (state.beat < state.runUntil) return true
  if (NODE_IDS.some((id) => reachOf(state.nodes[id], state.beat) === "silent")) return true
  const packet = state.packet
  if (!packet || packet.status === "out") return false
  if (packet.status === "moving") return true
  if (packet.reason === "queue") return true
  // A node that left with the packet can still flush it if it gets online now and then.
  return packet.reason === "carried" && roleOf(packet.at, state.nodes[packet.at].mode) === "flush"
}

/** Advance one beat: range timeouts, the packet, the lanes and the rings. */
export function tick(state: PresenceState): PresenceState {
  const beat = state.beat + 1
  const lost = NODE_IDS.filter((id) => {
    const outSince = state.nodes[id].outSince
    return outSince !== null && beat - outSince === MISS_LIMIT
  })
  const step = stepPacket(state.nodes, state.packet, beat)
  const notes: string[] = []
  if (lost.length > 0) notes.push(unreachableLine(lost, step.note === null))
  if (step.note) notes.push(step.note)
  return {
    ...state,
    beat,
    packet: step.packet,
    lanes: advanceLanes(state.lanes, state.nodes, beat),
    pulseBeat: beat,
    notice: notes.length > 0 ? notes.join(" ") : state.notice,
  }
}

/** Run the clock until nothing is left to resolve (reduced motion: every lesson prints whole). */
export function settle(state: PresenceState, cap: number = SETTLE_CAP): PresenceState {
  let current = state
  for (let i = 0; i < cap && isActive(current); i++) current = tick(current)
  return current === state ? state : { ...current, pulseBeat: null }
}

function keepRunning(state: PresenceState): number {
  return Math.max(state.runUntil, state.beat + SETTLE_BEATS)
}

function select(state: PresenceState, id: NodeId): PresenceState {
  const notice = NODES[id].canBeGateway ? `Selected: ${NODES[id].the}.` : `Selected: ${NODES[id].the}. ${RELAY_LINE}`
  return { ...state, selected: id, notice }
}

function modeLine(id: NodeId, mode: InternetMode): string {
  const who = capitalise(NODES[id].the)
  switch (mode) {
    case "always":
      return `${who} is now always online: a gateway that streams messages and updates in live.`
    case "sometimes":
      return `${who} now gets online only sometimes: a gateway that flushes its queue whenever it does.`
    case "none":
      return `${who} has no internet now. It simply stays a mesh node.`
  }
}

function setMode(state: PresenceState, id: NodeId, mode: InternetMode): PresenceState {
  if (!NODES[id].canBeGateway) return { ...state, notice: RELAY_LINE }
  const current = state.nodes[id]
  if (current.mode === mode) return state
  const node: NodeState = { ...current, mode }
  const nodes: Nodes = { ...state.nodes, [id]: node }
  return {
    ...state,
    nodes,
    lanes: rewriteNow(state.lanes, id, node, state.beat),
    runUntil: keepRunning(state),
    notice: modeLine(id, mode),
  }
}

function setRange(state: PresenceState, id: NodeId, inRange: boolean): PresenceState {
  const current = state.nodes[id]
  if ((current.outSince === null) === inRange) return state
  const node: NodeState = { ...current, outSince: inRange ? null : state.beat }
  const nodes: Nodes = { ...state.nodes, [id]: node }
  const who = capitalise(NODES[id].the)
  return {
    ...state,
    nodes,
    lanes: rewriteNow(state.lanes, id, node, state.beat),
    runUntil: keepRunning(state),
    notice: inRange ? `${who} is back in range. Its heartbeats are heard again.` : `${who} moved out of range. Its heartbeats stopped.`,
  }
}

function send(state: PresenceState): PresenceState {
  const id = state.sent + 1
  const fresh: Packet = { id, at: ORIGIN, status: "moving", reason: null, route: [ORIGIN], trail: [ORIGIN], target: null }
  const decision = decide(state.nodes, ORIGIN, state.beat)
  const packet = resting(fresh, decision)
  const notice =
    packet.status === "waiting" && packet.reason
      ? `Sent from ${NODES[ORIGIN].the}. ${waitLine(state.nodes, state.beat, packet.reason, ORIGIN, packet.route)}`
      : `Sent from ${NODES[ORIGIN].the} along a path formed from what is reachable now: ${pathLine(state.nodes, packet)}.`
  return { ...state, packet, sent: id, runUntil: keepRunning(state), notice }
}

function apply(state: PresenceState, action: Exclude<PresenceAction, { type: "tick" }>): PresenceState {
  switch (action.type) {
    case "select":
      return select(state, action.id)
    case "setMode":
      return setMode(state, action.id, action.mode)
    case "setRange":
      return setRange(state, action.id, action.inRange)
    case "send":
      return send(state)
  }
}

/** The widget reducer. Ticks come from the in-view clock; user actions may ask to settle. */
export function presenceReducer(state: PresenceState, action: PresenceAction): PresenceState {
  if (action.type === "tick") return tick(state)
  if (!action.settle) return apply(state, action)
  return settle(apply(settle(state), action))
}
