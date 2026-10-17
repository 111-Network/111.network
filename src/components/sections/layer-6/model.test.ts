import { describe, expect, it } from "vitest"
import { createRng } from "@/lib/prng"
import {
  BRIDGE_DOES,
  BRIDGE_DOES_NOT,
  BRIDGE_SIDES,
  DEFAULT_IN_RANGE,
  ENCODER_RULE,
  HEARTBEATS,
  INITIAL_BRIDGE,
  INITIAL_SEEK,
  NETWORKS,
  NONE_IN_RANGE,
  PAYLOAD_LENGTH,
  REFUSED_LINE,
  RUNG_LABEL,
  SCOPE_CAPTION,
  bridgeDelay,
  bridgeNarration,
  bridgeReducer,
  encoderOutput,
  heartbeatStatus,
  networkName,
  otherSide,
  packetSpot,
  priorityEncode,
  rungStates,
  scopeAnimates,
  scopeLabel,
  scopeMode,
  sealedPayload,
  seekDelay,
  seekNarration,
  seekReducer,
  settleBridge,
  settleSeek,
  stepBridge,
  stepSeek,
  type BridgeState,
  type InRange,
  type SeekState,
  type Side,
} from "./model"
import {
  CARRIER_START,
  MAX_FRAME_SECONDS,
  PULSE_SECONDS,
  carrierY,
  heartbeatPulse,
  tickCarrier,
  traceY,
  type CarrierClock,
} from "./scope-draw"

/** All sixteen in-range combinations of the four networks. */
const ALL_COMBOS: InRange[] = Array.from({ length: 16 }, (_, mask) => [
  Boolean(mask & 1),
  Boolean(mask & 2),
  Boolean(mask & 4),
  Boolean(mask & 8),
])

function withRange(inRange: InRange): SeekState {
  return { ...INITIAL_SEEK, inRange }
}

/** Every state a seek passes through, from the SEEK press to rest. */
function seekTrace(inRange: InRange): SeekState[] {
  const states = [seekReducer(withRange(inRange), { type: "seek" })]
  while (seekDelay(states[states.length - 1]) !== null) {
    states.push(seekReducer(states[states.length - 1], { type: "step" }))
    if (states.length > 50) throw new Error("seek never settles")
  }
  return states
}

/** Every state a packet passes through, from the press to delivery. */
function bridgeTrace(from: Side, start: BridgeState = INITIAL_BRIDGE): BridgeState[] {
  const states = [bridgeReducer(start, { type: "send", from })]
  while (bridgeDelay(states[states.length - 1]) !== null) {
    states.push(bridgeReducer(states[states.length - 1], { type: "step" }))
    if (states.length > 50) throw new Error("packet never arrives")
  }
  return states
}

describe("preferred list", () => {
  it("has four example networks, A to D, named only by generic medium", () => {
    expect(NETWORKS.map((n) => n.letter)).toEqual(["A", "B", "C", "D"])
    for (const net of NETWORKS) expect(["long-range radio", "Wi-Fi", "Bluetooth"]).toContain(net.medium)
    expect(networkName(0)).toBe("Network A")
    expect(networkName(3)).toBe("Network D")
  })

  it("offers no email or satellite transport", () => {
    for (const net of NETWORKS) expect(net.medium).not.toMatch(/mail|satellite/i)
    for (const side of Object.values(BRIDGE_SIDES)) expect(side.medium).not.toMatch(/mail|satellite/i)
  })

  it("starts with something in range further down the list, so the first seek falls back", () => {
    expect(DEFAULT_IN_RANGE[0]).toBe(false)
    expect(priorityEncode(DEFAULT_IN_RANGE)).toBeGreaterThan(0)
  })
})

describe("priority encoder", () => {
  it("prints the rule 1 > 2 > 3 > 4, first hit wins", () => {
    expect(ENCODER_RULE).toBe("1 > 2 > 3 > 4, first hit wins")
    expect(ENCODER_RULE.match(/\d/g)).toEqual(NETWORKS.map((_, i) => String(i + 1)))
  })

  it("picks the first network in range (first hit wins) for every combination", () => {
    for (const combo of ALL_COMBOS) {
      const expected = combo.findIndex(Boolean)
      expect(priorityEncode(combo)).toBe(expected === -1 ? null : expected)
    }
  })

  it("outputs JOIN #n with the 1-based list position", () => {
    expect(encoderOutput([false, true, false, true])).toBe("JOIN #2")
    expect(encoderOutput([true, true, true, true])).toBe("JOIN #1")
    expect(encoderOutput([false, false, false, true])).toBe("JOIN #4")
  })

  it("outputs NONE IN RANGE → messages wait on the device when nothing answers", () => {
    expect(NONE_IN_RANGE).toBe("NONE IN RANGE → messages wait on the device")
    expect(encoderOutput([false, false, false, false])).toBe(NONE_IN_RANGE)
  })
})

describe("seek ladder", () => {
  it("does nothing until SEEK is pressed: every rung not tried, no timer, a still readout", () => {
    expect(rungStates(INITIAL_SEEK)).toEqual(["not-tried", "not-tried", "not-tried", "not-tried"])
    expect(seekDelay(INITIAL_SEEK)).toBeNull()
    expect(scopeMode(INITIAL_SEEK)).toBe("idle")
    expect(scopeAnimates(scopeMode(INITIAL_SEEK))).toBe(false)
    expect(seekReducer(INITIAL_SEEK, { type: "step" })).toBe(INITIAL_SEEK)
  })

  it("starts at the top of the list", () => {
    const s = seekReducer(INITIAL_SEEK, { type: "seek" })
    expect(s.phase).toBe("seeking")
    expect(rungStates(s)).toEqual(["listening", "not-tried", "not-tried", "not-tried"])
    expect(s.runs).toBe(1)
  })

  it("steps down one rung at a time, never skipping, and joins the first network in range", () => {
    for (const combo of ALL_COMBOS) {
      const trace = seekTrace(combo)
      const seeking = trace.filter((s) => s.phase === "seeking").map((s) => s.cursor)
      const hit = priorityEncode(combo)
      const lastTried = hit === null ? NETWORKS.length - 1 : hit
      expect(seeking).toEqual(Array.from({ length: lastTried + 1 }, (_, i) => i))
      const end = trace[trace.length - 1]
      if (hit === null) {
        expect(end.phase).toBe("none")
      } else {
        expect(end.phase).toBe("settled")
        expect(end.cursor).toBe(hit)
      }
    }
  })

  it("marks no signal above the hit, FOUND on it and not tried below it", () => {
    const end = settleSeek(seekReducer(withRange([false, false, true, true]), { type: "seek" }))
    expect(rungStates(end)).toEqual(["no-signal", "no-signal", "found", "not-tried"])
    expect(RUNG_LABEL.found).toBe("FOUND")
    expect(RUNG_LABEL["no-signal"]).toBe("no signal")
    expect(RUNG_LABEL["not-tried"]).toBe("not tried")
  })

  it("falls through the whole list when nothing is in range: all no signal", () => {
    const end = settleSeek(seekReducer(withRange([false, false, false, false]), { type: "seek" }))
    expect(end.phase).toBe("none")
    expect(rungStates(end)).toEqual(["no-signal", "no-signal", "no-signal", "no-signal"])
    expect(seekNarration(end)).toContain("NONE IN RANGE")
    expect(seekNarration(end)).toContain("messages wait on the device")
  })

  it("agrees with the priority encoder for every combination", () => {
    for (const combo of ALL_COMBOS) {
      const end = settleSeek(seekReducer(withRange(combo), { type: "seek" }))
      const hit = priorityEncode(combo)
      expect(end.phase === "none" ? null : end.cursor).toBe(hit)
    }
  })

  it("sends a few heartbeats after joining, then settles into a static frame", () => {
    const trace = seekTrace([true, false, false, false])
    const joined = trace.filter((s) => s.phase === "joined")
    expect(joined.map((s) => s.beats)).toEqual(Array.from({ length: HEARTBEATS + 1 }, (_, i) => i))
    const end = trace[trace.length - 1]
    expect(end.phase).toBe("settled")
    expect(end.beats).toBe(HEARTBEATS)
    expect(seekDelay(end)).toBeNull()
    expect(stepSeek(end)).toBe(end)
  })

  it("shows noise while seeking, a clean carrier once joined, then a still frame", () => {
    const trace = seekTrace([false, true, false, false])
    const modes = trace.map(scopeMode)
    expect(modes[0]).toBe("noise")
    expect(modes).toContain("carrier")
    expect(modes[modes.length - 1]).toBe("settled")
    expect(modes.indexOf("carrier")).toBeGreaterThan(modes.lastIndexOf("noise"))
    for (const s of trace) {
      // Only a seek in progress moves; rest states are one frame.
      expect(scopeAnimates(scopeMode(s))).toBe(seekDelay(s) !== null)
    }
    expect(scopeMode(settleSeek(seekReducer(withRange([false, false, false, false]), { type: "seek" })))).toBe("flat")
  })

  it("resolves the whole seek at once under reduced motion, to the same end state", () => {
    for (const combo of ALL_COMBOS) {
      const instant = seekReducer(withRange(combo), { type: "seek", instant: true })
      const trace = seekTrace(combo)
      expect(instant).toEqual(trace[trace.length - 1])
      expect(seekDelay(instant)).toBeNull()
    }
  })

  it("before any seek, a toggle only sets the range and asks for SEEK", () => {
    const toggled = seekReducer(INITIAL_SEEK, { type: "toggle", index: 2 })
    expect(toggled.phase).toBe("idle")
    expect(toggled.inRange[2]).toBe(true)
    expect(toggled.change).toEqual({ index: 2, effect: "set" })
    expect(seekDelay(toggled)).toBeNull()
    expect(seekNarration(toggled)).toBe("Network C is now in range. Encoder: JOIN #2. Press SEEK to walk the list.")
  })

  it("keeps the join when a lower network comes into or leaves range", () => {
    // Default range: B and D in range, so the walk joins B (#2).
    const joined = settleSeek(seekReducer(INITIAL_SEEK, { type: "seek" }))
    const cOn = seekReducer(joined, { type: "toggle", index: 2 })
    expect(cOn.phase).toBe("settled")
    expect(cOn.cursor).toBe(1)
    expect(cOn.beats).toBe(HEARTBEATS)
    expect(rungStates(cOn)).toEqual(rungStates(joined))
    expect(scopeMode(cOn)).toBe("settled")
    expect(encoderOutput(cOn.inRange)).toBe("JOIN #2")
    expect(seekNarration(cOn)).toBe("Network C is now in range. Encoder still says JOIN #2, so the node stays on Network B.")

    const dOff = seekReducer(cOn, { type: "toggle", index: 3 })
    expect(dOff.phase).toBe("settled")
    expect(seekNarration(dOff)).toContain("Network D is now out of range")
    expect(seekNarration(dOff)).toContain("stays on Network B")
  })

  it("keeps heartbeats going through a lower toggle; the next step clears the note", () => {
    const seek = seekReducer(INITIAL_SEEK, { type: "seek" })
    const joined = stepSeek(stepSeek(seek))
    expect(joined.phase).toBe("joined")
    const kept = seekReducer(joined, { type: "toggle", index: 3 })
    expect(kept.phase).toBe("joined")
    expect(seekDelay(kept)).not.toBeNull()
    const next = stepSeek(kept)
    expect(next.change).toBeNull()
    expect(next.beats).toBe(kept.beats + 1)
  })

  it("falls back to idle when the joined network leaves range, and says a real node walks the list again", () => {
    const joined = settleSeek(seekReducer(INITIAL_SEEK, { type: "seek" }))
    const lost = seekReducer(joined, { type: "toggle", index: 1 })
    expect(lost.phase).toBe("idle")
    expect(lost.change).toEqual({ index: 1, effect: "lost" })
    expect(rungStates(lost).every((r) => r === "not-tried")).toBe(true)
    expect(seekDelay(lost)).toBeNull()
    expect(seekNarration(lost)).toContain("Network B, the network the node had joined, is now out of range")
    expect(seekNarration(lost)).toContain("falls back down the list")
    expect(seekNarration(lost)).toContain("Encoder: JOIN #4")
    expect(seekNarration(lost)).toContain("Press SEEK")
  })

  it("resets when a network above the join, or above the walk, comes into range", () => {
    const joined = settleSeek(seekReducer(INITIAL_SEEK, { type: "seek" }))
    const above = seekReducer(joined, { type: "toggle", index: 0 })
    expect(above.phase).toBe("idle")
    expect(above.change?.effect).toBe("above")
    expect(seekNarration(above)).toContain("Network A is now in range")
    expect(seekNarration(above)).toContain("Encoder: JOIN #1")

    // Mid-walk: listening on B (#2), so A (#1) is behind the walk.
    const midWalk = stepSeek(seekReducer(INITIAL_SEEK, { type: "seek" }))
    expect(midWalk.cursor).toBe(1)
    const behind = seekReducer(midWalk, { type: "toggle", index: 0 })
    expect(behind.phase).toBe("idle")
    expect(behind.change?.effect).toBe("above")
  })

  it("lets the walk carry on through a toggle it has not passed yet", () => {
    // Listening on B (#2); B goes out of range before the step lands, so the walk moves on to D.
    const midWalk = stepSeek(seekReducer(INITIAL_SEEK, { type: "seek" }))
    const bOff = seekReducer(midWalk, { type: "toggle", index: 1 })
    expect(bOff.phase).toBe("seeking")
    expect(bOff.cursor).toBe(1)
    expect(seekNarration(bOff)).toContain("carries on")
    const end = settleSeek(bOff)
    expect(end.phase).toBe("settled")
    expect(end.cursor).toBe(3)
  })

  it("resets when a network appears after nothing was in range", () => {
    const none = settleSeek(seekReducer(withRange([false, false, false, false]), { type: "seek" }))
    const appeared = seekReducer(none, { type: "toggle", index: 2 })
    expect(appeared.phase).toBe("idle")
    expect(appeared.change?.effect).toBe("appeared")
    expect(seekNarration(appeared)).toContain("Messages were waiting on the device")
    expect(seekNarration(appeared)).toContain("Encoder: JOIN #3")
  })

  it("never lets a toggle leave the board disagreeing with the encoder", () => {
    for (const combo of ALL_COMBOS) {
      for (const s of [withRange(combo), ...seekTrace(combo)]) {
        for (let i = 0; i < NETWORKS.length; i++) {
          const t = seekReducer(s, { type: "toggle", index: i })
          expect(t.inRange[i]).toBe(!s.inRange[i])
          if (t.phase === "idle") {
            expect(rungStates(t).every((r) => r === "not-tried")).toBe(true)
            continue
          }
          // A kept walk or join ends where the encoder says.
          const end = settleSeek(t)
          expect(end.phase === "none" ? null : end.cursor).toBe(priorityEncode(t.inRange))
          if (t.phase === "joined" || t.phase === "settled") expect(t.cursor).toBe(priorityEncode(t.inRange))
          // The ladder never shows a rung it got wrong.
          rungStates(t).forEach((rung, r) => {
            if (rung === "no-signal") expect(t.inRange[r]).toBe(false)
            if (rung === "found") expect(t.inRange[r]).toBe(true)
          })
        }
      }
    }
  })

  it("labels the idle readout honestly once a seek has run", () => {
    expect(scopeLabel(INITIAL_SEEK)).toBe("Signal readout: standing by, no seek yet")
    const lost = seekReducer(settleSeek(seekReducer(INITIAL_SEEK, { type: "seek" })), { type: "toggle", index: 1 })
    expect(scopeLabel(lost)).toBe("Signal readout: standing by, the range changed; press SEEK again")
  })

  it("gives every instant seek its own line, so a repeated press is announced again", () => {
    const first = seekReducer(INITIAL_SEEK, { type: "seek", instant: true })
    const second = seekReducer(first, { type: "seek", instant: true })
    expect(seekNarration(first)).not.toBe(seekNarration(second))
    expect(seekNarration(first)).toMatch(/^Seek 1 · /)
    expect(seekNarration(second)).toMatch(/^Seek 2 · /)
    expect(seekNarration(second)).toContain("Joined Network B (#2)")
    const none1 = seekReducer(withRange([false, false, false, false]), { type: "seek", instant: true })
    const none2 = seekReducer(none1, { type: "seek", instant: true })
    expect(seekNarration(none1)).not.toBe(seekNarration(none2))
  })

  it("states the heartbeat count in words, with no numbers", () => {
    expect(heartbeatStatus(INITIAL_SEEK)).toBe("none yet")
    for (const combo of ALL_COMBOS) {
      // "Layer 7" is a name, not a count.
      for (const s of seekTrace(combo)) expect(heartbeatStatus(s).replace("Layer 7", "")).not.toMatch(/\d/)
    }
    expect(heartbeatStatus(settleSeek(seekReducer(INITIAL_SEEK, { type: "seek" })))).toContain("Layer 7")
    expect(heartbeatStatus(settleSeek(seekReducer(withRange([false, false, false, false]), { type: "seek" })))).toContain(
      "nothing in range",
    )
  })

  it("ignores toggles for networks that are not on the list", () => {
    expect(seekReducer(INITIAL_SEEK, { type: "toggle", index: 4 })).toBe(INITIAL_SEEK)
    expect(seekReducer(INITIAL_SEEK, { type: "toggle", index: -1 })).toBe(INITIAL_SEEK)
  })

  it("restarts from the top when SEEK is pressed again", () => {
    const done = settleSeek(seekReducer(INITIAL_SEEK, { type: "seek" }))
    const again = seekReducer(done, { type: "seek" })
    expect(again.phase).toBe("seeking")
    expect(again.cursor).toBe(0)
    expect(again.beats).toBe(0)
    expect(again.runs).toBe(2)
  })

  it("narrates and labels every state it can reach", () => {
    for (const combo of ALL_COMBOS) {
      for (const s of [withRange(combo), ...seekTrace(combo)]) {
        const toggled = NETWORKS.map((_, i) => seekReducer(s, { type: "toggle", index: i }))
        for (const x of [s, ...toggled]) {
          expect(seekNarration(x).length).toBeGreaterThan(0)
          expect(scopeLabel(x)).toMatch(/^Signal readout: /)
          expect(SCOPE_CAPTION[scopeMode(x)].length).toBeGreaterThan(0)
          expect(heartbeatStatus(x).length).toBeGreaterThan(0)
        }
      }
    }
    const end = settleSeek(seekReducer(INITIAL_SEEK, { type: "seek" }))
    expect(seekNarration(end)).toContain("Network A: no signal")
    expect(seekNarration(end)).toContain("Joined Network B (#2)")
    expect(seekNarration(end)).toContain("Layer 7")
  })
})

describe("thin bridge", () => {
  it("is still until a network is pressed", () => {
    expect(INITIAL_BRIDGE.packet).toBeNull()
    expect(packetSpot(INITIAL_BRIDGE)).toBeNull()
    expect(bridgeDelay(INITIAL_BRIDGE)).toBeNull()
    expect(stepBridge(INITIAL_BRIDGE)).toBe(INITIAL_BRIDGE)
  })

  it("drops a sealed packet from A, through the bridge, to B", () => {
    const trace = bridgeTrace("a")
    expect(trace.map((s) => s.stage)).toEqual(["launch", "to-bridge", "swap", "to-dest", "delivered"])
    expect(trace.map(packetSpot)).toEqual(["a", "bridge", "bridge", "b", "b"])
  })

  it("sends one back up from B to A the same way", () => {
    const trace = bridgeTrace("b")
    expect(trace.map(packetSpot)).toEqual(["b", "bridge", "bridge", "a", "a"])
    expect(trace[trace.length - 1].packet?.wrapper).toBe("a")
  })

  it("never changes the payload on the way", () => {
    for (const from of ["a", "b"] as const) {
      const trace = bridgeTrace(from)
      const payloads = new Set(trace.map((s) => s.packet?.payload))
      expect(payloads.size).toBe(1)
      expect(trace[0].packet?.payload).toBe(sealedPayload(trace[0].runs))
    }
  })

  it("swaps only the outer wrapper, exactly once, at the bridge", () => {
    for (const from of ["a", "b"] as const) {
      const trace = bridgeTrace(from)
      const wrappers = trace.map((s) => s.packet?.wrapper)
      const swapAt = trace.findIndex((s) => s.stage === "swap")
      expect(wrappers.slice(0, swapAt)).toEqual(Array(swapAt).fill(from))
      expect(wrappers.slice(swapAt)).toEqual(Array(trace.length - swapAt).fill(otherSide(from)))
      expect(packetSpot(trace[swapAt])).toBe("bridge")
      for (const s of trace) expect(Object.keys(s.packet ?? {}).sort()).toEqual(["payload", "wrapper"])
    }
  })

  it("delivers at once under reduced motion: travel cuts to the destination with the same packet", () => {
    for (const from of ["a", "b"] as const) {
      const instant = bridgeReducer(INITIAL_BRIDGE, { type: "send", from, instant: true })
      const trace = bridgeTrace(from)
      expect(instant).toEqual(trace[trace.length - 1])
      expect(instant.stage).toBe("delivered")
      expect(bridgeDelay(instant)).toBeNull()
      expect(settleBridge(trace[1])).toEqual(instant)
    }
  })

  it("starts a fresh packet from the pressed side, even mid-trip", () => {
    const mid = stepBridge(stepBridge(bridgeReducer(INITIAL_BRIDGE, { type: "send", from: "a" })))
    const fresh = bridgeReducer(mid, { type: "send", from: "b" })
    expect(fresh.stage).toBe("launch")
    expect(fresh.packet?.wrapper).toBe("b")
    expect(packetSpot(fresh)).toBe("b")
    expect(fresh.runs).toBe(2)
  })

  it("draws a deterministic sealed payload from block glyphs only", () => {
    expect(sealedPayload(1)).toBe(sealedPayload(1))
    for (let run = 1; run <= 20; run++) {
      expect(sealedPayload(run)).toMatch(new RegExp(`^[░▒▓█]{${PAYLOAD_LENGTH}}$`))
    }
  })

  it("shows its detail from the start (does / does not), and the bridge band folds it away and back", () => {
    expect(BRIDGE_DOES).toBe("carry the bare minimum across, buffer briefly")
    expect(BRIDGE_DOES_NOT).toBe("reinvent the radio, reinvent routing, read the payload")
    expect(INITIAL_BRIDGE.detailOpen).toBe(true)
    const closed = bridgeReducer(INITIAL_BRIDGE, { type: "toggle-detail" })
    expect(closed.detailOpen).toBe(false)
    expect(bridgeNarration(closed)).toBe("Bridge detail closed.")
    const reopened = bridgeReducer(closed, { type: "toggle-detail" })
    expect(reopened.detailOpen).toBe(true)
    expect(bridgeNarration(reopened)).not.toBe(bridgeNarration(closed))
    expect(bridgeDelay(closed)).toBeNull()
  })

  it("refuses to do more: bridges stay thin, and says so anew on every press", () => {
    expect(REFUSED_LINE).toBe("REFUSED: bridges stay thin")
    expect(INITIAL_BRIDGE.refusals).toBe(0)
    const once = bridgeReducer(INITIAL_BRIDGE, { type: "do-more" })
    const twice = bridgeReducer(once, { type: "do-more" })
    expect(once.refusals).toBe(1)
    expect(twice.refusals).toBe(2)
    expect(bridgeNarration(once)).toContain(REFUSED_LINE)
    expect(bridgeNarration(twice)).toContain(REFUSED_LINE)
    expect(bridgeNarration(twice)).not.toBe(bridgeNarration(once))
    expect(bridgeDelay(twice)).toBeNull()
  })

  it("names each packet, so two instant trips the same way are both announced", () => {
    const first = bridgeReducer(INITIAL_BRIDGE, { type: "send", from: "a", instant: true })
    const second = bridgeReducer(first, { type: "send", from: "a", instant: true })
    expect(bridgeNarration(first)).toMatch(/^Packet 1 arrived on Network B/)
    expect(bridgeNarration(second)).toMatch(/^Packet 2 arrived on Network B/)
    expect(bridgeNarration(second)).not.toBe(bridgeNarration(first))
    // And a fresh packet from the same side mid-trip reads differently from the one it replaced.
    const launched = bridgeReducer(INITIAL_BRIDGE, { type: "send", from: "a" })
    expect(bridgeNarration(bridgeReducer(launched, { type: "send", from: "a" }))).not.toBe(bridgeNarration(launched))
  })

  it("narrates the wrapper swap and the unchanged payload", () => {
    const trace = bridgeTrace("a")
    const swap = trace.find((s) => s.stage === "swap")
    expect(swap && bridgeNarration(swap)).toContain("long-range radio wrapper off, Wi-Fi / Bluetooth wrapper on")
    expect(bridgeNarration(trace[trace.length - 1])).toContain("Only the wrapper changed")
    for (const s of trace) expect(bridgeNarration(s).length).toBeGreaterThan(0)
    expect(bridgeNarration(INITIAL_BRIDGE).length).toBeGreaterThan(0)
  })
})

describe("readout trace", () => {
  const rng = createRng("l6-test")

  it("is flat while standing by and when nothing is in range", () => {
    for (const u of [0, 0.25, 0.5, 1]) {
      expect(traceY("idle", u, 1, rng, null)).toBe(0)
      expect(traceY("flat", u, 1, rng, null)).toBe(0)
    }
  })

  it("stays inside the window in every mode", () => {
    for (const mode of ["noise", "carrier", "settled"] as const) {
      for (let i = 0; i <= 120; i++) {
        const y = traceY(mode, i / 120, 0.3, rng, PULSE_SECONDS / 2)
        expect(Math.abs(y)).toBeLessThanOrEqual(1)
      }
    }
  })

  it("freezes the settled frame on the carrier's phase, without a burst", () => {
    for (const t of [0, 1.3, 2.7]) {
      expect(traceY("settled", 0.3, t, rng, 0.2)).toBe(traceY("carrier", 0.3, t, rng, null))
      expect(traceY("settled", 0.3, t, rng, 0.2)).toBe(carrierY(0.3, t))
    }
  })

  it("adds a heartbeat burst only inside its window", () => {
    expect(heartbeatPulse(0.5, 0)).toBe(0)
    expect(heartbeatPulse(0.5, PULSE_SECONDS)).toBe(0)
    expect(Math.abs(heartbeatPulse(0.505, PULSE_SECONDS / 2))).toBeGreaterThan(0.1)
    expect(traceY("carrier", 0.5, 2, rng, 2)).toBe(traceY("carrier", 0.5, 2, rng, null))
  })

  it("runs the carrier on one continuous clock: a heartbeat restarts only its burst", () => {
    const dt = 1 / 60
    let clock: CarrierClock = CARRIER_START
    let prevT = clock.t
    // Join (beats 0), then three heartbeats, a frame every 1/60 s.
    for (let frame = 0; frame < 240; frame++) {
      const beats = Math.min(Math.floor(frame / 40), HEARTBEATS)
      const before = clock
      clock = tickCarrier(clock, dt, beats)
      expect(clock.t).toBeCloseTo(prevT + dt, 10)
      prevT = clock.t
      if (beats !== before.beat) expect(clock.beatT).toBe(beats > 0 ? 0 : null)
      else if (before.beatT !== null) expect(clock.beatT).toBeCloseTo(before.beatT + dt, 10)
      // The carrier itself never jumps between two frames.
      expect(Math.abs(carrierY(0.25, clock.t) - carrierY(0.25, before.t))).toBeLessThan(0.05)
    }
    expect(clock.beat).toBe(HEARTBEATS)
  })

  it("caps a stalled frame, so a pause never makes the carrier jump", () => {
    expect(tickCarrier(CARRIER_START, 5, 0).t).toBe(MAX_FRAME_SECONDS)
    expect(tickCarrier(CARRIER_START, -1, 0).t).toBe(0)
    expect(tickCarrier(CARRIER_START, 0.01, 0).beatT).toBeNull()
  })
})
