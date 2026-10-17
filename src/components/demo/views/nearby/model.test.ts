import { describe, expect, it } from "vitest"
import { NEARBY_COPY } from "../../copy/nearby"
import type { HeardEntry } from "../../engine/core"
import { DEMO_WORLD, type DemoService } from "../../engine/world"
import { causeLines, groupHeading, groupHeard, isRelay, nearbyPage, pathText, relayOf, sortedHeard } from "./model"
import { RADAR, radarNodes, ringOf, shouldPulse } from "./radar-model"

const svc = (id: "radio" | "mesh", state: DemoService["state"], reason = ""): DemoService => ({
  ...(DEMO_WORLD.services.find((s) => s.id === id) as DemoService),
  state,
  reason,
})

const entry = (id: HeardEntry["id"], over: Partial<HeardEntry> = {}): HeardEntry => ({
  id,
  via: "radio",
  cause: "radio-ready",
  firstCause: "radio-ready",
  firstAt: 0,
  lastAt: 0,
  count: 1,
  blip: 1,
  ...over,
})

describe("nearbyPage: the honest empty states (real nearbyState)", () => {
  const mesh = svc("mesh", "live")
  it("no radio board yet: the no-board state, never a list", () => {
    const p = nearbyPage({ neighbours: 0, radio: null, radioService: svc("radio", "unset"), meshService: mesh })
    expect(p).toMatchObject({ kind: "no-board", title: NEARBY_COPY.empty.noBoard.title, text: NEARBY_COPY.empty.noBoard.text })
  })
  it("a board plugged in but not set up: unbound", () => {
    expect(nearbyPage({ neighbours: 0, radio: { stage: "identified" }, radioService: svc("radio", "unset"), meshService: mesh }).kind).toBe("unbound")
  })
  it("starting, error (with its reason), and listening with nobody heard", () => {
    expect(nearbyPage({ neighbours: 0, radio: { stage: "ready" }, radioService: svc("radio", "starting"), meshService: mesh }).kind).toBe("starting")
    const err = nearbyPage({ neighbours: 0, radio: { stage: "ready" }, radioService: svc("radio", "error", "The board stopped."), meshService: mesh })
    expect(err).toMatchObject({ kind: "error", text: "The board stopped." })
    expect(nearbyPage({ neighbours: 0, radio: { stage: "ready" }, radioService: svc("radio", "live"), meshService: mesh }).kind).toBe("empty")
  })
  it("no mesh link / mesh link problem come first", () => {
    expect(nearbyPage({ neighbours: 0, radio: null, radioService: undefined, meshService: svc("mesh", "unset") }).kind).toBe("no-mesh")
    expect(nearbyPage({ neighbours: 0, radio: null, radioService: undefined, meshService: svc("mesh", "error") }).text).toBe(NEARBY_COPY.empty.meshError.fallback)
  })
  it("a list, with the 'last known list' line when the radio or the mesh link is not well", () => {
    expect(nearbyPage({ neighbours: 2, radio: { stage: "ready" }, radioService: svc("radio", "live"), meshService: mesh })).toMatchObject({ kind: "list", text: null })
    expect(nearbyPage({ neighbours: 2, radio: { stage: "ready" }, radioService: svc("radio", "error"), meshService: mesh }).text).toBe(NEARBY_COPY.stale.radioError)
    expect(nearbyPage({ neighbours: 2, radio: { stage: "ready" }, radioService: svc("radio", "starting"), meshService: mesh }).text).toBe(NEARBY_COPY.stale.radioStarting)
    expect(nearbyPage({ neighbours: 2, radio: { stage: "ready" }, radioService: svc("radio", "live"), meshService: svc("mesh", "error") }).text).toBe(NEARBY_COPY.stale.mesh)
  })
})

describe("how a heard node reads", () => {
  it("the path, never a distance: the ridge repeater directly, the others through it", () => {
    expect(relayOf(entry("ridge-repeater"))).toBeNull()
    expect(pathText(entry("ridge-repeater"), DEMO_WORLD)).toBe(NEARBY_COPY.path.direct)
    expect(pathText(entry("bram"), DEMO_WORLD)).toBe(NEARBY_COPY.path.through("Ridge repeater"))
    expect(relayOf(entry("bram", { via: "wifi" }))).toBeNull()
  })
  it("only the relay forwards sealed traffic and cannot read it", () => {
    expect(isRelay("ridge-repeater", DEMO_WORLD)).toBe(true)
    expect(isRelay("valley-hub", DEMO_WORLD)).toBe(false)
    expect(isRelay("ada", DEMO_WORLD)).toBe(false)
  })
  it("why it was heard: the first cause, plus the latest once it differs", () => {
    expect(causeLines(entry("bram"))).toEqual([NEARBY_COPY.firstHeard(NEARBY_COPY.cause["radio-ready"])])
    expect(causeLines(entry("bram", { cause: "listen-burst", count: 2 }))).toEqual([
      NEARBY_COPY.firstHeard(NEARBY_COPY.cause["radio-ready"]),
      NEARBY_COPY.latest(NEARBY_COPY.cause["listen-burst"]),
    ])
    expect(causeLines(entry("bram", { cause: "fault", firstCause: "fault" }))).toEqual([NEARBY_COPY.firstHeard(NEARBY_COPY.cause.other)])
  })
  it("order: heard directly first, then by name; grouped by way of hearing", () => {
    const list = [entry("valley-hub"), entry("bram"), entry("ridge-repeater")]
    expect(sortedHeard(list, DEMO_WORLD).map((h) => h.id)).toEqual(["ridge-repeater", "bram", "valley-hub"])
    const groups = groupHeard([...list, entry("ada", { via: "wifi" })], DEMO_WORLD)
    expect(groups.map((g) => g.medium)).toEqual(["radio", "wifi"])
    expect(groupHeading("radio", { alias: "roof board", name: "USB radio board" })).toBe(NEARBY_COPY.source.radio("roof board"))
    expect(groupHeading("radio", null)).toBe(NEARBY_COPY.source.radio("USB radio board"))
  })
})

describe("radar geometry: drawn only from what was heard", () => {
  it("rings by path; a dashed line from the relay when it is on the radar too", () => {
    const nodes = radarNodes([entry("ridge-repeater"), entry("bram", { blip: 2 })], DEMO_WORLD)
    expect(nodes.map((n) => [n.id, n.ring])).toEqual([
      ["ridge-repeater", 1],
      ["bram", 2],
    ])
    expect(nodes[1].relayFrom).toEqual({ x: nodes[0].x, y: nodes[0].y })
    expect(radarNodes([entry("bram")], DEMO_WORLD)[0].relayFrom).toBeNull()
    expect(ringOf(entry("valley-hub"))).toBe(2)
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(RADAR.width)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(RADAR.height)
    }
  })
  it("a pulse only for a hear after mount (or just before it), never under reduced motion", () => {
    const base = { blip: 3, now: 10_000 }
    expect(shouldPulse({ blip: 4, lastAt: 10_500 }, base, false)).toBe(true)
    expect(shouldPulse({ blip: 2, lastAt: 9_000 }, base, false)).toBe(true)
    expect(shouldPulse({ blip: 2, lastAt: 1_000 }, base, false)).toBe(false)
    expect(shouldPulse({ blip: 4, lastAt: 10_500 }, base, true)).toBe(false)
  })
})
