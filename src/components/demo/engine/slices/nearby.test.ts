import { describe, expect, it } from "vitest"
import { NEARBY_COPY } from "../../copy/nearby"
import { MIN, SEC } from "../clock"
import { homeHubHeard, meshNeighbours } from "../selectors"
import { createDemoStore, type DemoStore } from "../store"
import { DEMO_WORLD } from "../world"
import type { DemoState } from "./index"
import { heardNames, initialNearby, LISTEN_MS, LISTEN_OFFSETS, listenPlan, needsNearby, radioListening } from "./nearby"
import { NO_NEEDS } from "../types"

function setup(path = "/nearby"): DemoStore {
  return createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: path })
}
const snap = (s: DemoStore): DemoState => s.getSnapshot()
const causes = (s: DemoStore): string[] => snap(s).core.events.map((e) => e.cause)
const nearbySteps = (s: DemoStore) => s.scheduler.pending().filter((p) => p.key?.startsWith("nearby:"))

/** Plug, allow, flash and set the region with reduced motion: the radio is LIVE and the first nodes are heard. */
function radioUp(s: DemoStore): void {
  s.dispatch({ type: "core/radioPlugged" })
  s.dispatch({ type: "core/radioAllowed", instant: true })
  s.dispatch({ type: "core/radioFlash", instant: true })
  s.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0], instant: true })
  // Let what the first hears set off elsewhere (a message to Bram moving on) settle first.
  s.scheduler.runUntilIdle()
}

describe("nearby slice: the view's own state", () => {
  it("opens on RADAR with no listen; RADAR | LIST survives, and the same mode is a no-op", () => {
    const s = setup()
    expect(snap(s).nearby).toEqual(initialNearby())
    expect(snap(s).nearby.mode).toBe("radar")
    s.dispatch({ type: "nearby/setMode", mode: "list" })
    expect(snap(s).nearby.mode).toBe("list")
    const before = snap(s)
    s.dispatch({ type: "nearby/setMode", mode: "list" })
    expect(snap(s)).toBe(before)
    s.dispatch({ type: "core/navigate", path: "/overview" })
    s.dispatch({ type: "core/navigate", path: "/nearby" })
    expect(snap(s).nearby.mode).toBe("list")
  })

  it("adds nothing to needs-you", () => {
    expect(needsNearby()).toBe(NO_NEEDS)
  })
})

describe("nearby: before the radio, the honest empty state", () => {
  it("nothing is heard and nothing is scheduled while idle", () => {
    const s = setup()
    expect(snap(s).core.heard).toEqual([])
    expect(s.scheduler.pending()).toEqual([])
  })

  it("listen is ignored without a running radio (nothing to listen with)", () => {
    const s = setup()
    const before = snap(s)
    s.dispatch({ type: "nearby/listen" })
    expect(snap(s)).toBe(before)
    expect(nearbySteps(s)).toEqual([])
    expect(radioListening(snap(s).core)).toBe(false)
  })
})

describe("nearby: blips only from named causes", () => {
  it("(1) after the radio board is set up, the first nodes blip in one by one, cause radio-ready", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "core/radioAllowed" })
    s.scheduler.runUntilIdle()
    s.dispatch({ type: "core/radioFlash" })
    s.scheduler.runUntilIdle()
    s.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0] })
    s.scheduler.runUntilIdle()
    const heard = meshNeighbours(snap(s), DEMO_WORLD)
    expect(heard.map((h) => h.id)).toEqual(["ridge-repeater", "valley-hub", "bram"])
    expect(heard.every((h) => h.cause === "radio-ready" && h.via === "radio")).toBe(true)
    // one by one: distinct times and distinct blips
    expect(new Set(heard.map((h) => h.firstAt)).size).toBe(3)
    expect(new Set(heard.map((h) => h.blip)).size).toBe(3)
    expect(s.scheduler.pending()).toEqual([])
  })

  it("(2) a SEND lands the home hub's custody blip apart from the mesh neighbours", () => {
    const s = setup()
    s.dispatch({ type: "messages/send", peer: "ada", text: "hello" })
    s.scheduler.runUntilIdle()
    const home = homeHubHeard(snap(s), DEMO_WORLD)
    expect(home).not.toBeNull()
    expect(home?.cause).toBe("custody-ack")
    expect(meshNeighbours(snap(s), DEMO_WORLD)).toHaveLength(0)
  })

  it("(3) connecting to the internet turns on the gateway overlay (no blip, no chip change)", () => {
    const s = setup()
    s.dispatch({ type: "core/internetConnected", instant: true })
    expect(snap(s).core.services.find((x) => x.id === "gateway")?.state).toBe("live")
    expect(snap(s).core.heard).toEqual([])
  })
})

describe("nearby: (4) listen for a minute is ONE finite burst", () => {
  it("plans relays first, each relay heard twice, capped by the offsets", () => {
    const plan = listenPlan(DEMO_WORLD)
    expect(plan).toEqual(["ridge-repeater", "valley-hub", "bram", "ridge-repeater"])
    expect(plan.length).toBeLessThanOrEqual(LISTEN_OFFSETS.length)
    expect(LISTEN_OFFSETS.every((t) => t < LISTEN_MS)).toBe(true)
  })

  it("schedules each hear and the end on the demo scheduler; quiet hears; one listen-burst event at the end", () => {
    const s = setup()
    radioUp(s)
    const eventsBefore = snap(s).core.events.length
    const countsBefore = new Map(snap(s).core.heard.map((h) => [h.id, h.count]))
    s.dispatch({ type: "nearby/listen" })
    const run = snap(s).nearby.listen
    expect(run).toMatchObject({ n: 1, heard: [] })
    expect(nearbySteps(s)).toHaveLength(listenPlan(DEMO_WORLD).length + 1)

    s.scheduler.advance(LISTEN_OFFSETS[0])
    expect(snap(s).nearby.listen?.heard).toEqual(["ridge-repeater"])
    expect(snap(s).core.heard.find((h) => h.id === "ridge-repeater")?.cause).toBe("listen-burst")

    s.scheduler.advance(LISTEN_MS)
    const after = snap(s)
    expect(after.nearby.listen).toBeNull()
    expect(after.nearby.last).toMatchObject({ n: 1, outcome: "done" })
    expect(after.nearby.last?.text).toBe(NEARBY_COPY.listen.done(heardNames(listenPlan(DEMO_WORLD), DEMO_WORLD)))
    const newCauses = after.core.events.slice(eventsBefore).map((e) => e.cause)
    expect(newCauses.filter((c) => c === "listen-burst")).toHaveLength(1)
    expect(newCauses).not.toContain("node-heard")
    expect(after.core.heard.find((h) => h.id === "ridge-repeater")?.count).toBe((countsBefore.get("ridge-repeater") ?? 0) + 2)
    // finite: nothing repeats by itself
    expect(nearbySteps(s)).toEqual([])
    s.scheduler.advance(10 * MIN)
    expect(snap(s).core.events.length).toBe(after.core.events.length)
  })

  it("a second press while listening is ignored; a later press starts listen 2", () => {
    const s = setup()
    radioUp(s)
    s.dispatch({ type: "nearby/listen" })
    const during = snap(s)
    s.dispatch({ type: "nearby/listen" })
    expect(snap(s)).toBe(during)
    s.scheduler.runUntilIdle()
    s.dispatch({ type: "nearby/listen" })
    expect(snap(s).nearby.listen?.n).toBe(2)
  })

  it("stop listening ends it early, drops what is pending and says so once", () => {
    const s = setup()
    radioUp(s)
    s.dispatch({ type: "nearby/listen" })
    s.scheduler.advance(7 * SEC)
    s.dispatch({ type: "nearby/stopListening" })
    expect(nearbySteps(s)).toEqual([])
    const last = snap(s).nearby.last
    expect(last?.outcome).toBe("stopped")
    expect(last?.heard).toEqual(["ridge-repeater", "valley-hub"])
    expect(causes(s).filter((c) => c === "listen-burst")).toHaveLength(1)
  })

  it("unplugging the radio mid-listen ends it with 'lost'", () => {
    const s = setup()
    radioUp(s)
    s.dispatch({ type: "nearby/listen" })
    s.scheduler.advance(3 * SEC)
    s.dispatch({ type: "core/radioRemoved" })
    expect(snap(s).nearby.listen).toBeNull()
    expect(snap(s).nearby.last).toMatchObject({ outcome: "lost", text: NEARBY_COPY.listen.lost })
    expect(nearbySteps(s)).toEqual([])
    s.scheduler.runUntilIdle()
    expect(snap(s).core.heard.filter((h) => h.via === "radio")).toEqual([])
  })

  it("reduced motion: the whole burst and its end land in the same dispatch", () => {
    const s = setup()
    radioUp(s)
    s.dispatch({ type: "nearby/listen", instant: true })
    expect(snap(s).nearby.listen).toBeNull()
    expect(snap(s).nearby.last).toMatchObject({ outcome: "done", heard: listenPlan(DEMO_WORLD) })
    expect(nearbySteps(s)).toEqual([])
  })
})

describe("nearby: plain sentences", () => {
  it("names each node once, in first-heard order, with how often", () => {
    expect(heardNames([], DEMO_WORLD)).toBe("")
    expect(heardNames(["bram"], DEMO_WORLD)).toBe("Bram")
    expect(heardNames(["ridge-repeater", "bram", "ridge-repeater"], DEMO_WORLD)).toBe("Ridge repeater twice and Bram")
  })

  it("the relay line is the §6.8 copy verbatim, with no read counter", () => {
    expect(NEARBY_COPY.relay).toBe("forwards sealed traffic; cannot read it")
    expect(JSON.stringify(NEARBY_COPY)).not.toMatch(/read 0/i)
  })
})
