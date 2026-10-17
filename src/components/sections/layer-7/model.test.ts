import { describe, expect, it } from "vitest"
import {
  BURST_ON,
  BURST_PERIOD,
  EDGE_INSET,
  INTERNET_MODES,
  chooseTarget,
  INITIAL_NODES,
  LANE_BEATS,
  LINKS,
  MISS_LIMIT,
  NODES,
  NODE_IDS,
  REACH_WORD,
  RELAY_LINE,
  SETTLE_BEATS,
  SETTLE_CAP,
  TICK_PERIOD,
  blockerOf,
  createInitialState,
  decide,
  exitLine,
  findPath,
  isActive,
  isGateway,
  isOnline,
  keepsMessages,
  laneCell,
  lanesFor,
  linkState,
  neighbours,
  packetPlacement,
  pathLine,
  presenceReducer,
  reachOf,
  reachRowLabel,
  roleOf,
  settle,
  tick,
  unreachableLine,
  type InternetMode,
  type NodeId,
  type Nodes,
  type Packet,
  type PresenceAction,
  type PresenceState,
} from "./model"

function run(state: PresenceState, ...actions: PresenceAction[]): PresenceState {
  return actions.reduce(presenceReducer, state)
}

function ticks(state: PresenceState, n: number): PresenceState {
  let s = state
  for (let i = 0; i < n; i++) s = tick(s)
  return s
}

/** True when a relay is left holding the packet (it must never keep it). */
function relayKeeps(state: PresenceState): boolean {
  const packet = state.packet
  return packet !== null && packet.status === "waiting" && !keepsMessages(packet.at)
}

/** Tick until idle like `settle`, checking after every beat that no relay keeps the packet. */
function settleChecked(state: PresenceState): PresenceState {
  let s = state
  for (let i = 0; i < SETTLE_CAP && isActive(s); i++) {
    s = tick(s)
    expect(relayKeeps(s)).toBe(false)
  }
  return s
}

/** First beat at which `beat` satisfies `test`, searching one burst period from `from`. */
function firstBeat(from: number, test: (beat: number) => boolean): number {
  for (let b = from; b < from + BURST_PERIOD * TICK_PERIOD; b++) if (test(b)) return b
  throw new Error("no such beat")
}

function withModes(modes: Partial<Record<NodeId, InternetMode>>): Nodes {
  const out = { ...INITIAL_NODES }
  for (const id of NODE_IDS) {
    const mode = modes[id]
    if (mode) out[id] = { ...out[id], mode }
  }
  return out
}

function runs(cells: readonly string[], value: string): number[] {
  const lengths: number[] = []
  let current = 0
  for (const cell of cells) {
    if (cell === value) current++
    else if (current > 0) {
      lengths.push(current)
      current = 0
    }
  }
  if (current > 0) lengths.push(current)
  return lengths
}

describe("map", () => {
  it("has the five role-tagged nodes and links that stay inside the box", () => {
    expect(NODE_IDS.map((id) => NODES[id].label)).toEqual(["laptop", "home server", "relay", "phone", "radio box"])
    for (const id of NODE_IDS) {
      expect(NODES[id].x).toBeGreaterThan(0)
      expect(NODES[id].x).toBeLessThan(100)
      expect(NODES[id].y).toBeGreaterThan(16)
      expect(NODES[id].y).toBeLessThan(100)
    }
    for (const [a, b] of LINKS) {
      expect(neighbours(a)).toContain(b)
      expect(neighbours(b)).toContain(a)
    }
  })

  it("keeps under-the-square labels clear of the box edges", () => {
    for (const id of NODE_IDS) {
      if (NODES[id].side !== "below") continue
      expect(NODES[id].x).toBeGreaterThanOrEqual(EDGE_INSET)
      expect(NODES[id].x).toBeLessThanOrEqual(100 - EDGE_INSET)
    }
    // The two bottom-corner nodes label below at every width (never outward to the edge).
    expect(NODES.phone.side).toBe("below")
    expect(NODES["radio-box"].side).toBe("below")
  })

  it("places the packet tag where there is room: inward near the edges", () => {
    for (const id of NODE_IDS) {
      for (const status of ["moving", "waiting", "out"] as const) {
        if (status === "out" && !NODES[id].canBeGateway) continue
        const place = packetPlacement({ at: id, status })
        expect(place.x).toBe(NODES[id].x)
        if (place.tag === "left") expect(place.x).toBeGreaterThanOrEqual(EDGE_INSET + 4)
        if (place.tag === "right") expect(place.x).toBeLessThanOrEqual(100 - EDGE_INSET - 4)
        // At a node the tag continues the side the square sits on, away from the node itself.
        if (status !== "out") expect(Math.sign(place.dx)).toBe(place.tag === "right" ? 1 : -1)
      }
    }
    expect(packetPlacement({ at: "phone", status: "out" }).tag).toBe("right")
    expect(packetPlacement({ at: "radio-box", status: "out" }).tag).toBe("left")
  })

  it("is the same on every render (server and client)", () => {
    expect(createInitialState()).toEqual(createInitialState())
  })
})

describe("gateway roles", () => {
  it("relays only repeat: they can never be gateways", () => {
    for (const mode of ["none", "sometimes", "always"] as const) {
      expect(isGateway("relay", mode)).toBe(false)
      expect(roleOf("relay", mode)).toBe("relay")
      for (let b = 0; b < BURST_PERIOD; b++) expect(isOnline("relay", mode, b)).toBe(false)
    }
  })

  it("clicking a relay shows the relay line, and setting its internet changes nothing", () => {
    const start = createInitialState()
    const picked = run(start, { type: "select", id: "relay" })
    expect(picked.selected).toBe("relay")
    expect(picked.notice).toContain(RELAY_LINE)
    const tried = run(picked, { type: "setMode", id: "relay", mode: "always" })
    expect(tried.nodes).toBe(picked.nodes)
    expect(tried.notice).toBe(RELAY_LINE)
    expect(isActive(tried)).toBe(false)
  })

  it("a node with internet becomes a gateway; without it, it stays a mesh node", () => {
    expect(roleOf("laptop", "none")).toBe("mesh")
    expect(isGateway("laptop", "none")).toBe(false)
    expect(roleOf("laptop", "sometimes")).toBe("flush")
    expect(roleOf("home-server", "always")).toBe("stream")
    expect(isGateway("phone", "sometimes")).toBe(true)
  })

  it("always = online on every beat; sometimes = online in bursts; none = never", () => {
    for (let b = -20; b < 20; b++) {
      expect(isOnline("home-server", "always", b)).toBe(true)
      expect(isOnline("phone", "none", b)).toBe(false)
    }
    for (const id of ["laptop", "phone", "radio-box", "home-server"] as const) {
      const window = Array.from({ length: BURST_PERIOD }, (_, b) => isOnline(id, "sometimes", b))
      expect(window.filter(Boolean)).toHaveLength(BURST_ON)
      // One contiguous burst per period (wrapping around).
      const doubled = [...window, ...window].map((on) => (on ? "on" : "off"))
      expect(Math.max(...runs(doubled, "on"))).toBe(BURST_ON)
    }
  })

  it("losing internet leaves the node a plain mesh node, still in the lanes", () => {
    const s = run(createInitialState(), { type: "setMode", id: "home-server", mode: "none" })
    expect(roleOf("home-server", s.nodes["home-server"].mode)).toBe("mesh")
    expect(s.notice).toContain("stays a mesh node")
    expect(s.lanes["home-server"][LANE_BEATS - 1]).not.toBe("gone")
  })
})

describe("path finding: a path formed from what is reachable now", () => {
  it("takes the shortest path to a gateway that is online now", () => {
    const d = decide(INITIAL_NODES, "phone", 0)
    expect(d).toEqual({ kind: "hop", route: ["phone", "relay", "home-server"], target: "home-server" })
  })

  it("prefers a gateway online now over a closer one that is offline", () => {
    expect(isOnline("laptop", "sometimes", 0)).toBe(false)
    const d = decide(INITIAL_NODES, "phone", 0)
    expect(d.kind === "hop" && d.route[d.route.length - 1]).toBe("home-server")
  })

  it("takes the closer gateway while it is online", () => {
    const beat = Array.from({ length: BURST_PERIOD }, (_, b) => b).find((b) => isOnline("laptop", "sometimes", b))
    expect(beat).toBeDefined()
    expect(decide(INITIAL_NODES, "phone", beat ?? 0)).toEqual({ kind: "hop", route: ["phone", "laptop"], target: "laptop" })
  })

  it("with only sometimes-gateways, it heads for the nearest one's queue", () => {
    const nodes = withModes({ "home-server": "none" })
    expect(decide(nodes, "phone", 0)).toEqual({ kind: "hop", route: ["phone", "laptop"], target: "laptop" })
    expect(decide(nodes, "laptop", 0)).toEqual({ kind: "wait", reason: "queue", route: ["laptop"], target: "laptop" })
  })

  it("with no gateway at all, it waits where it is", () => {
    const nodes = withModes({ laptop: "none", "home-server": "none" })
    expect(decide(nodes, "phone", 0)).toEqual({ kind: "wait", reason: "no-gateway", route: ["phone"], target: null })
  })

  it("an online gateway holding the packet sends it out", () => {
    expect(decide(INITIAL_NODES, "home-server", 0)).toEqual({ kind: "exit" })
  })

  it("keeps its gateway instead of chasing another sometimes-gateway that is online now", () => {
    const nodes = withModes({ "home-server": "sometimes", "radio-box": "none" })
    const beat = Array.from({ length: BURST_PERIOD }, (_, b) => b).find(
      (b) => isOnline("home-server", "sometimes", b) && !isOnline("laptop", "sometimes", b),
    )
    expect(beat).toBeDefined()
    expect(chooseTarget(nodes, "laptop", beat ?? 0, "laptop")).toBe("laptop")
    expect(decide(nodes, "laptop", beat ?? 0, "laptop")).toMatchObject({ kind: "wait", reason: "queue" })
  })

  it("leaves an offline sometimes-gateway's queue for an always-on gateway in reach", () => {
    const nodes = withModes({ "radio-box": "always" })
    expect(isOnline("laptop", "sometimes", 0)).toBe(false)
    expect(chooseTarget(nodes, "laptop", 0, "laptop")).toBe("home-server")
  })

  it("picks a new gateway when its gateway loses internet", () => {
    const nodes = withModes({ "home-server": "none" })
    expect(chooseTarget(nodes, "relay", 0, "home-server")).toBe("laptop")
  })

  it("routes around an unreachable node", () => {
    const nodes: Nodes = { ...INITIAL_NODES, relay: { mode: "none", outSince: -MISS_LIMIT } }
    expect(reachOf(nodes.relay, 0)).toBe("unreachable")
    expect(findPath(nodes, "phone", 0, (id) => id === "home-server")).toEqual(["phone", "radio-box", "home-server"])
    expect(findPath(nodes, "relay", 0, () => true)).toBeNull()
  })
})

describe("out of range", () => {
  it("is silent for a few beats, then unreachable", () => {
    const node = { mode: "none" as const, outSince: 10 }
    for (let b = 10; b < 10 + MISS_LIMIT; b++) expect(reachOf(node, b)).toBe("silent")
    expect(reachOf(node, 10 + MISS_LIMIT)).toBe("unreachable")
    expect(reachOf({ mode: "none", outSince: null }, 99)).toBe("in-range")
  })

  it("labels a dropped node as the red ERROR \"unreachable\" in the NODE row, the short word on the map", () => {
    expect(reachRowLabel("unreachable")).toBe("ERROR · unreachable")
    expect(REACH_WORD.unreachable).toBe("unreachable")
    expect(reachRowLabel("silent")).toBe("silent")
    expect(reachRowLabel("in-range")).toBe("in range")
  })

  it("narrates nodes timing out on the same beat as one sentence", () => {
    expect(unreachableLine(["relay"], true)).toBe("The relay missed its heartbeats: unreachable. Paths re-form around it.")
    expect(unreachableLine(["relay", "phone"], false)).toBe("The relay and the phone missed their heartbeats: unreachable.")
    let s = run(
      createInitialState(),
      { type: "setRange", id: "laptop", inRange: false },
      { type: "setRange", id: "radio-box", inRange: false },
    )
    s = ticks(s, MISS_LIMIT)
    expect(s.notice).toBe("The laptop and the radio box missed their heartbeats: unreachable. Paths re-form around them.")
  })

  it("is marked unreachable only after it missed at least two of its expected heartbeats", () => {
    for (const id of NODE_IDS) {
      for (const mode of INTERNET_MODES) {
        for (let out = 0; out < BURST_PERIOD * TICK_PERIOD; out++) {
          const node = { mode, outSince: out }
          const gone = firstBeat(out, (b) => reachOf(node, b) === "unreachable")
          // Beats on which this node would have been heard had it stayed in range.
          const missedTicks = Array.from({ length: gone - out }, (_, i) => out + 1 + i).filter(
            (b) => laneCell(id, "none", true, b) === "heard",
          )
          const missedHeard = Array.from({ length: gone - out }, (_, i) => out + 1 + i).filter(
            (b) => laneCell(id, mode, true, b) === "heard",
          )
          expect(missedTicks.length).toBeGreaterThanOrEqual(2)
          expect(missedHeard.length).toBeGreaterThanOrEqual(2)
          // ...and the lane shows it gone the whole time.
          for (let b = out; b <= gone; b++) expect(laneCell(id, mode, false, b)).toBe("gone")
        }
      }
    }
  })

  it("marks the node unreachable after the missed beats, drops its links, and back in range restores", () => {
    let s = run(createInitialState(), { type: "setRange", id: "relay", inRange: false })
    expect(s.notice).toContain("moved out of range")
    expect(linkState(s.nodes, ["phone", "relay"], s.beat)).toBe("silent")
    s = ticks(s, MISS_LIMIT - 1)
    expect(reachOf(s.nodes.relay, s.beat)).toBe("silent")
    s = tick(s)
    expect(reachOf(s.nodes.relay, s.beat)).toBe("unreachable")
    expect(s.notice).toContain("unreachable")
    expect(linkState(s.nodes, ["phone", "relay"], s.beat)).toBe("down")
    expect(linkState(s.nodes, ["phone", "laptop"], s.beat)).toBe("up")
    s = run(s, { type: "setRange", id: "relay", inRange: true })
    expect(reachOf(s.nodes.relay, s.beat)).toBe("in-range")
    expect(linkState(s.nodes, ["phone", "relay"], s.beat)).toBe("up")
    expect(s.notice).toContain("back in range")
  })

  it("holds the packet while the next hop is silent, then reroutes once it is unreachable", () => {
    let s = run(createInitialState(), { type: "setRange", id: "relay", inRange: false }, { type: "send" })
    expect(s.packet?.status).toBe("waiting")
    expect(s.packet?.reason).toBe("no-answer")
    expect(s.notice).toContain("the relay went silent")
    s = ticks(s, MISS_LIMIT - 1)
    expect(s.packet?.at).toBe("phone")
    expect(s.packet?.reason).toBe("no-answer")
    s = tick(s)
    expect(s.packet?.at).toBe("radio-box")
    expect(s.packet?.status).toBe("moving")
    expect(s.notice).toContain("unreachable")
    expect(s.notice).toContain("phone → radio box → home server → wider world")
    s = ticks(s, 2)
    expect(s.packet?.status).toBe("out")
    expect(s.packet?.trail).toEqual(["phone", "radio-box", "home-server"])
  })

  it("a node carrying the packet out of range keeps it, and resumes back in range", () => {
    let s = run(createInitialState(), { type: "setMode", id: "home-server", mode: "none" }, { type: "send" })
    s = tick(s)
    expect(s.packet?.at).toBe("laptop")
    s = run(s, { type: "setMode", id: "laptop", mode: "none" }, { type: "setRange", id: "laptop", inRange: false })
    s = tick(s)
    expect(s.packet?.reason).toBe("carried")
    expect(s.notice).toContain("out of range with it")
    s = settle(s)
    expect(isActive(s)).toBe(false)
    expect(s.packet).toMatchObject({ at: "laptop", status: "waiting", reason: "carried" })
    s = run(s, { type: "setMode", id: "radio-box", mode: "always" }, { type: "setRange", id: "laptop", inRange: true })
    s = tick(s)
    expect(s.packet?.at).toBe("relay")
    expect(s.notice).toContain("Moving on")
    s = settleChecked(s)
    expect(s.packet?.status).toBe("out")
    expect(s.packet?.trail).toEqual(["phone", "laptop", "relay", "radio-box"])
  })
})

describe("relays only repeat: a relay never keeps the message", () => {
  it("a relay moved out of range mid-hop hands it back: the phone still holds it", () => {
    let s = run(createInitialState(), { type: "select", id: "relay" }, { type: "send" })
    s = tick(s)
    expect(s.packet?.at).toBe("relay")
    s = run(s, { type: "setRange", id: "relay", inRange: false })
    s = tick(s)
    expect(s.packet).toMatchObject({ at: "phone", status: "waiting", reason: "no-answer", trail: ["phone"] })
    expect(s.notice).toContain("The relay only repeats and keeps nothing: the phone still holds it.")
    expect(s.notice).toContain("the relay went silent")
    expect(s.notice).not.toContain("out of range with it")
    // Once the relay misses its heartbeats, the path re-forms around it from the phone.
    s = settleChecked(s)
    expect(s.packet?.status).toBe("out")
    expect(s.packet?.trail).toEqual(["phone", "radio-box", "home-server"])
  })

  it("with no gateway left in reach, the relay hands it back and the phone waits", () => {
    let s = run(createInitialState(), { type: "setMode", id: "laptop", mode: "none" }, { type: "send" })
    s = tick(s)
    expect(s.packet?.at).toBe("relay")
    s = run(s, { type: "setMode", id: "home-server", mode: "none" })
    s = tick(s)
    expect(s.packet).toMatchObject({ at: "phone", status: "waiting", reason: "no-gateway" })
    expect(s.notice).toContain("keeps nothing")
    expect(s.notice).toContain("Waiting at the phone: no gateway in reach.")
    s = settleChecked(s)
    expect(isActive(s)).toBe(false)
    expect(s.packet?.at).toBe("phone")
    s = run(s, { type: "setMode", id: "radio-box", mode: "always" })
    s = settleChecked(s)
    expect(s.packet?.status).toBe("out")
    expect(s.packet?.trail).toEqual(["phone", "radio-box"])
  })

  it("when the node after the relay goes silent, it waits at the phone, not on the relay", () => {
    let s = run(createInitialState(), { type: "send" })
    s = tick(s)
    expect(s.packet?.at).toBe("relay")
    s = run(s, { type: "setRange", id: "home-server", inRange: false })
    s = tick(s)
    expect(s.packet).toMatchObject({ at: "phone", status: "waiting", reason: "no-answer" })
    expect(s.notice).toContain("the home server went silent")
    s = settleChecked(s)
    expect(s.packet?.status).toBe("out")
    expect(s.packet?.at).toBe("laptop")
  })

  it("never steps onto a relay whose next node is silent", () => {
    const nodes: Nodes = { ...INITIAL_NODES, "home-server": { mode: "always", outSince: 0 } }
    expect(blockerOf(nodes, ["phone", "relay", "home-server"], 1)).toBe("home-server")
    expect(blockerOf(nodes, ["phone", "laptop", "relay", "home-server"], 1)).toBeNull()
    const d = decide(nodes, "phone", 1, "home-server")
    expect(d).toMatchObject({ kind: "wait", reason: "no-answer", route: ["phone", "relay", "home-server"] })
  })

  it("whatever is changed mid-trip, no relay is ever left holding it", () => {
    const disruptions: PresenceAction[][] = [
      [{ type: "setRange", id: "relay", inRange: false }],
      [{ type: "setRange", id: "home-server", inRange: false }],
      [{ type: "setMode", id: "home-server", mode: "none" }],
      [{ type: "setMode", id: "home-server", mode: "none" }, { type: "setMode", id: "laptop", mode: "none" }],
      [{ type: "setMode", id: "home-server", mode: "sometimes" }],
      [{ type: "setRange", id: "phone", inRange: false }, { type: "setRange", id: "relay", inRange: false }],
    ]
    for (let start = 0; start < BURST_PERIOD; start++) {
      for (const disrupt of disruptions) {
        for (const after of [0, 1, 2]) {
          let s = ticks(createInitialState(), start)
          s = ticks(run(s, { type: "send" }), after)
          s = run(s, ...disrupt)
          expect(relayKeeps(settleChecked(s))).toBe(false)
        }
      }
    }
  })
})

describe("send to the outside", () => {
  it("goes hop by hop along the path and out through the always-on gateway", () => {
    let s = run(createInitialState(), { type: "send" })
    expect(s.packet?.at).toBe("phone")
    expect(s.notice).toContain("a path formed from what is reachable now")
    expect(s.packet && pathLine(s.nodes, s.packet)).toBe("phone → relay → home server → wider world")
    s = tick(s)
    expect(s.packet?.at).toBe("relay")
    s = tick(s)
    expect(s.packet?.at).toBe("home-server")
    s = tick(s)
    expect(s.packet?.status).toBe("out")
    expect(s.notice).toContain("always-on gateway")
  })

  it("a sometimes-gateway keeps it in its queue and flushes it when it gets online", () => {
    let s = run(createInitialState(), { type: "setMode", id: "home-server", mode: "none" }, { type: "send" })
    s = tick(s)
    expect(s.packet?.at).toBe("laptop")
    expect(s.packet?.reason).toBe("queue")
    expect(s.notice).toContain("queue")
    expect(isActive(s)).toBe(true)
    while (s.packet?.status !== "out" && s.beat < 40) s = tick(s)
    expect(s.packet?.status).toBe("out")
    expect(isOnline("laptop", "sometimes", s.beat)).toBe(true)
    expect(s.notice).toContain("flushed its queue")
  })

  it("with no gateway online it waits at the last node and resumes when one appears", () => {
    let s = run(
      createInitialState(),
      { type: "setMode", id: "laptop", mode: "none" },
      { type: "setMode", id: "home-server", mode: "none" },
      { type: "send" },
    )
    expect(s.packet?.status).toBe("waiting")
    expect(s.packet?.reason).toBe("no-gateway")
    s = settle(s)
    expect(isActive(s)).toBe(false)
    expect(s.packet?.at).toBe("phone")
    expect(s.packet?.status).toBe("waiting")
    s = run(s, { type: "setMode", id: "radio-box", mode: "always" })
    s = tick(s)
    expect(s.packet?.at).toBe("radio-box")
    expect(s.notice).toContain("Moving on")
    s = tick(s)
    expect(s.packet?.status).toBe("out")
  })

  it("says 'flushed its queue' only when it really waited in that queue", () => {
    const base = settle(run(createInitialState(), { type: "setMode", id: "home-server", mode: "none" }))
    // Sent while the laptop is online: it goes straight out, no queue.
    const online = firstBeat(base.beat, (b) => isOnline("laptop", "sometimes", b) && isOnline("laptop", "sometimes", b + 2))
    let s = run(ticks(base, online - base.beat), { type: "send" })
    expect(s.packet?.route).toEqual(["phone", "laptop"])
    s = ticks(s, 2)
    expect(s.packet?.status).toBe("out")
    expect(s.notice).toContain("Out to the wider world through the laptop while it is online.")
    expect(s.notice).not.toContain("flushed")

    // The same packet, had it waited in the queue while the laptop was offline.
    const queued: Packet = { id: 9, at: "laptop", status: "waiting", reason: "queue", route: ["laptop"], target: "laptop", trail: ["phone", "laptop"] }
    expect(exitLine(base.nodes, queued)).toBe("The laptop got online and flushed its queue: out to the wider world.")
    expect(exitLine(base.nodes, { ...queued, reason: "no-gateway" })).toContain("while it is online")
    expect(exitLine(INITIAL_NODES, { ...queued, at: "home-server" })).toContain("always-on gateway")
  })

  it("a phone that is online when sending sends it out itself, without a queue", () => {
    const base = settle(run(createInitialState(), { type: "setMode", id: "phone", mode: "sometimes" }))
    const online = firstBeat(base.beat, (b) => isOnline("phone", "sometimes", b) && isOnline("phone", "sometimes", b + 1))
    let s = run(ticks(base, online - base.beat), { type: "send" })
    s = tick(s)
    expect(s.packet).toMatchObject({ status: "out", at: "phone", trail: ["phone"] })
    expect(s.notice).toBe("Out to the wider world through the phone while it is online.")
  })

  it("a fresh send replaces the old packet", () => {
    const s = run(createInitialState(), { type: "send" }, { type: "tick" }, { type: "send" })
    expect(s.packet?.id).toBe(2)
    expect(s.packet?.at).toBe("phone")
    expect(s.packet?.trail).toEqual(["phone"])
  })

  it("a node holding the packet can flush it while out of range if it gets online", () => {
    let s = run(createInitialState(), { type: "setMode", id: "home-server", mode: "none" }, { type: "send" })
    s = tick(s)
    s = run(s, { type: "setRange", id: "laptop", inRange: false })
    s = tick(s)
    expect(s.packet?.reason).toBe("carried")
    expect(isActive(s)).toBe(true)
    s = settle(s)
    expect(s.packet?.status).toBe("out")
  })
})

describe("heartbeat lanes: scripted from the map, never random", () => {
  it("always = solid, sometimes = bursts, none = a heartbeat now and then", () => {
    const lanes = lanesFor(INITIAL_NODES, 0)
    for (const id of NODE_IDS) expect(lanes[id]).toHaveLength(LANE_BEATS)
    expect(lanes["home-server"].every((c) => c === "heard")).toBe(true)
    expect(Math.max(...runs(lanes.laptop, "heard"))).toBeGreaterThanOrEqual(BURST_ON)
    expect(lanes.laptop).toContain("quiet")
    for (const id of ["phone", "relay", "radio-box"] as const) {
      const heard = lanes[id].filter((c) => c === "heard").length
      expect(heard).toBeGreaterThanOrEqual(Math.floor(LANE_BEATS / TICK_PERIOD))
      expect(heard).toBeLessThanOrEqual(Math.ceil(LANE_BEATS / TICK_PERIOD))
      // Lone ticks, one heartbeat period apart.
      expect(Math.max(...runs(lanes[id], "heard"))).toBe(1)
      const inner = runs(lanes[id], "quiet").slice(1, -1)
      for (const gap of inner) expect(gap).toBe(TICK_PERIOD - 1)
    }
    // The three mesh nodes tick on different beats, so the lanes stay staggered.
    const now = (id: NodeId) => lanes[id].findIndex((c) => c === "heard")
    expect(new Set([now("phone"), now("relay"), now("radio-box")]).size).toBe(3)
  })

  it("out of range = gone", () => {
    for (let b = 0; b < 10; b++) expect(laneCell("home-server", "always", false, b)).toBe("gone")
    let s = run(createInitialState(), { type: "setRange", id: "home-server", inRange: false })
    expect(s.lanes["home-server"][LANE_BEATS - 1]).toBe("gone")
    expect(s.lanes["home-server"][LANE_BEATS - 2]).toBe("heard")
    s = ticks(s, 4)
    expect(s.lanes["home-server"].slice(-5).every((c) => c === "gone")).toBe(true)
    expect(s.lanes["home-server"][LANE_BEATS - 6]).toBe("heard")
  })

  it("advancing the clock keeps following the script", () => {
    const s = ticks(createInitialState(), 11)
    expect(s.lanes).toEqual(lanesFor(INITIAL_NODES, s.beat))
  })

  it("a change rewrites only the current beat of that node", () => {
    const start = createInitialState()
    const s = run(start, { type: "setMode", id: "phone", mode: "always" })
    expect(s.lanes.phone.slice(0, -1)).toEqual(start.lanes.phone.slice(0, -1))
    expect(s.lanes.phone[LANE_BEATS - 1]).toBe("heard")
    expect(s.lanes.laptop).toBe(start.lanes.laptop)
  })
})

describe("clock: motion only in response to a click", () => {
  it("is idle on load and after a plain selection", () => {
    const start = createInitialState()
    expect(isActive(start)).toBe(false)
    expect(start.pulseBeat).toBeNull()
    expect(isActive(run(start, { type: "select", id: "phone" }))).toBe(false)
    expect(settle(start)).toBe(start)
  })

  it("runs for a few beats after a change, then stops", () => {
    const s = run(createInitialState(), { type: "setMode", id: "phone", mode: "sometimes" })
    expect(isActive(s)).toBe(true)
    const done = settle(s)
    expect(isActive(done)).toBe(false)
    expect(done.beat).toBe(SETTLE_BEATS)
  })

  it("setting the same internet again does not start it", () => {
    const start = createInitialState()
    expect(run(start, { type: "setMode", id: "laptop", mode: "sometimes" })).toBe(start)
  })

  it("rings show only on a ticked beat", () => {
    const s = tick(run(createInitialState(), { type: "send" }))
    expect(s.pulseBeat).toBe(s.beat)
  })

  it("always settles within the cap, whatever the map and whenever it is sent", () => {
    const modes: InternetMode[] = ["none", "sometimes", "always"]
    const capable = ["laptop", "home-server", "phone", "radio-box"] as const
    for (let mix = 0; mix < 3 ** capable.length; mix++) {
      const chosen = capable.map((_, i) => modes[Math.floor(mix / 3 ** i) % 3])
      for (const relayOut of [false, true]) {
        for (let wait = 0; wait < BURST_PERIOD; wait++) {
          let s = settle(run(createInitialState(), { type: "setMode", id: "phone", mode: "sometimes" }))
          s = ticks(s, wait)
          s = run(s, ...capable.map((id, i): PresenceAction => ({ type: "setMode", id, mode: chosen[i] })))
          if (relayOut) s = run(s, { type: "setRange", id: "relay", inRange: false })
          s = settle(run(s, { type: "send" }))
          expect(isActive(s)).toBe(false)
          expect(s.packet?.status).toBe(chosen.some((m) => m !== "none") ? "out" : "waiting")
        }
      }
    }
  })
})

describe("reduced motion: every lesson resolves to its final state", () => {
  it("a send prints the whole trip at once", () => {
    const s = run(createInitialState(), { type: "send", settle: true })
    expect(s.packet?.status).toBe("out")
    expect(s.packet?.trail).toEqual(["phone", "relay", "home-server"])
    expect(isActive(s)).toBe(false)
    expect(s.pulseBeat).toBeNull()
  })

  it("moving out of range lands straight on unreachable", () => {
    const s = run(createInitialState(), { type: "setRange", id: "radio-box", inRange: false, settle: true })
    expect(reachOf(s.nodes["radio-box"], s.beat)).toBe("unreachable")
    expect(isActive(s)).toBe(false)
  })
})
