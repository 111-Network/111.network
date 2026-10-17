// The Bridge slice through a memory store and the virtual scheduler (plan §6.4 Bridge, §6.8): it
// starts NOT SET "Needs a radio.", the radio runs on the same core actions as Devices, the bootstrap
// rule gates the role, one sample crossing at a time swaps only the wrapper, and the bridge follows
// the radio (pauses honestly, turns back on by cause, never by a timer of its own).
import { describe, expect, it } from "vitest"
import { BRIDGE_COPY } from "../../copy/bridge"
import { BRIDGE_REASON } from "../../copy/core"
import { TIMING } from "../core"
import { createDemoStore } from "../store"
import { NO_NEEDS } from "../types"
import { DEMO_WORLD, type World } from "../world"
import { BRIDGE_TIMING, CROSS_KEY, crossingUnderWay, initialBridge, needsBridge, sidesOf } from "./bridge"

type Store = ReturnType<typeof createDemoStore>

const newStore = (world: World = DEMO_WORLD): Store => {
  const store = createDemoStore(world, { router: "memory", driver: null })
  store.start()
  return store
}

const bridgeOf = (store: Store) => store.getSnapshot().core.services.find((s) => s.id === "bridge")!
const radioOf = (store: Store) => store.getSnapshot().core.services.find((s) => s.id === "radio")!
const causes = (store: Store) => store.getSnapshot().core.events.map((e) => e.cause)

/** Plug, allow, flash and set the region, each at its end state (reduced motion). */
function radioUp(store: Store): void {
  store.dispatch({ type: "core/radioPlugged" })
  store.dispatch({ type: "core/radioAllowed", instant: true })
  store.dispatch({ type: "core/radioFlash", instant: true })
  store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
}

function bridgeOn(store: Store): void {
  radioUp(store)
  store.dispatch({ type: "bridge/setRole", on: true, instant: true })
}

describe("bridge slice: opening state", () => {
  it("starts NOT SET with the plain 'Needs a radio.' reason and an idle diagram", () => {
    const store = newStore()
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: "Needs a radio." })
    expect(store.getSnapshot().bridge).toEqual(initialBridge())
    expect(store.getSnapshot().bridge).toMatchObject({ selected: "bridge", direction: "radio-to-wifi", crossing: null, paused: false })
  })

  it("adds no needs-you rows of its own", () => {
    expect(needsBridge()).toBe(NO_NEEDS)
  })

  it("the buffer sentence is the plan's, verbatim (§6.8)", () => {
    expect(BRIDGE_REASON.buffer.toLowerCase()).toBe(
      "nothing is discarded by policy; a full buffer refuses new frames until space frees, and the sender retries.",
    )
  })
})

describe("bridge slice: the bootstrap rule gates the role", () => {
  it("turning the bridge on is refused while there is no running radio", () => {
    const store = newStore()
    const before = store.getSnapshot()
    store.dispatch({ type: "bridge/setRole", on: true })
    expect(bridgeOf(store).state).toBe("unset")
    expect(store.getSnapshot().bridge).toBe(before.bridge)
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "bridge/setRole", on: true })
    expect(bridgeOf(store).state).toBe("unset")
  })

  it("the radio steps through the scheduler on the same core actions as Devices, then the bridge is ready to set up", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    expect(store.getSnapshot().core.radio?.stage).toBe("plugged")
    store.dispatch({ type: "core/radioAllowed" })
    expect(store.getSnapshot().core.radio?.stage).toBe("identifying")
    store.scheduler.advance(TIMING.identifyMs)
    expect(store.getSnapshot().core.radio?.stage).toBe("identified")
    store.dispatch({ type: "core/radioFlash" })
    store.scheduler.advance(TIMING.flashMs)
    expect(store.getSnapshot().core.radio?.stage).toBe("flashed")
    store.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    expect(radioOf(store).state).toBe("starting")
    expect(bridgeOf(store).reason).toBe("Needs a radio.")
    store.scheduler.advance(TIMING.startingMs)
    expect(radioOf(store).state).toBe("live")
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: BRIDGE_REASON.ready })
  })

  it("once the radio runs, the preferred networks are tried in order: first hit wins, heartbeats on Network A", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    store.scheduler.advance(TIMING.startingMs)
    expect(store.getSnapshot().core.transport).toMatchObject({ joined: null, seeking: true, tries: { "network-a": "trying", "network-b": "not tried", "network-c": "not tried" } })
    store.scheduler.advance(TIMING.seekStepMs)
    expect(store.getSnapshot().core.transport).toEqual({
      joined: "network-a",
      seeking: false,
      tries: { "network-a": "found", "network-b": "not tried", "network-c": "not tried" },
    })
    expect(causes(store)).toContain("network-joined")
  })

  it("on: STARTING then LIVE through the scheduler; instant lands LIVE in the same dispatch", () => {
    const store = newStore()
    radioUp(store)
    store.dispatch({ type: "bridge/setRole", on: true })
    expect(bridgeOf(store).state).toBe("starting")
    store.scheduler.advance(TIMING.startingMs)
    expect(bridgeOf(store).state).toBe("live")
    expect(bridgeOf(store).reason).toBe("Passing sealed traffic between long-range radio and Wi-Fi.")

    const quick = newStore()
    bridgeOn(quick)
    expect(bridgeOf(quick).state).toBe("live")
  })

  it("off: back to NOT SET 'Ready to set up…'", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "bridge/setRole", on: false })
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: BRIDGE_REASON.ready })
  })

  it("an ethernet-only laptop can bridge; with neither a hotspot nor ethernet it never can", () => {
    const ethernet: World = { ...DEMO_WORLD, self: { ...DEMO_WORLD.self, facts: { ...DEMO_WORLD.self.facts, hotspot: false, ethernet: true } } }
    const wired = newStore(ethernet)
    bridgeOn(wired)
    expect(bridgeOf(wired).state).toBe("live")

    const neither: World = { ...DEMO_WORLD, self: { ...DEMO_WORLD.self, facts: { ...DEMO_WORLD.self.facts, hotspot: false, ethernet: false } } }
    const store = newStore(neither)
    bridgeOn(store)
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: BRIDGE_REASON.needsLink })
  })
})

describe("bridge slice: one sample crossing at a time", () => {
  it("is ignored while the bridge is not LIVE", () => {
    const store = newStore()
    radioUp(store)
    const before = store.getSnapshot().bridge
    store.dispatch({ type: "bridge/cross" })
    expect(store.getSnapshot().bridge).toBe(before)
  })

  it("steps in -> swap -> out through the scheduler and emits one 'bridge/crossed' sentence at the end", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "bridge/cross" })
    expect(store.getSnapshot().bridge.crossing).toMatchObject({ id: "x1", direction: "radio-to-wifi", step: "in" })
    expect(store.scheduler.pending().some((t) => t.key === CROSS_KEY)).toBe(true)
    store.scheduler.advance(BRIDGE_TIMING.crossStepMs)
    expect(store.getSnapshot().bridge.crossing?.step).toBe("swap")
    expect(causes(store)).not.toContain("bridge/crossed")
    store.scheduler.advance(BRIDGE_TIMING.crossStepMs)
    expect(store.getSnapshot().bridge.crossing?.step).toBe("out")
    const crossed = store.getSnapshot().core.events.filter((e) => e.cause === "bridge/crossed")
    expect(crossed).toHaveLength(1)
    expect(crossed[0]).toMatchObject({ ref: "x1", text: BRIDGE_COPY.crossedEvent("radio", "wifi") })
    expect(crossed[0].text).toContain("Only its outer wrapper changed.")
    store.scheduler.runUntilIdle()
    expect(store.getSnapshot().core.events.filter((e) => e.cause === "bridge/crossed")).toHaveLength(1)
  })

  it("a second press while one is under way does nothing; the next one gets the next id", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "bridge/cross" })
    const under = store.getSnapshot().bridge
    store.dispatch({ type: "bridge/cross" })
    expect(store.getSnapshot().bridge).toBe(under)
    store.scheduler.advance(2 * BRIDGE_TIMING.crossStepMs)
    store.dispatch({ type: "bridge/direction", direction: "wifi-to-radio" })
    store.dispatch({ type: "bridge/cross", instant: true })
    expect(store.getSnapshot().bridge.crossing).toMatchObject({ id: "x2", direction: "wifi-to-radio", step: "out" })
    expect(store.getSnapshot().core.events.at(-1)?.text).toBe(BRIDGE_COPY.crossedEvent("wifi", "radio"))
  })

  it("reduced motion: the crossing lands at its end state at once, with nothing left scheduled", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "bridge/cross", instant: true })
    expect(store.getSnapshot().bridge.crossing?.step).toBe("out")
    expect(crossingUnderWay(store.getSnapshot().bridge.crossing)).toBe(false)
    expect(store.scheduler.pending().some((t) => t.key === CROSS_KEY)).toBe(false)
  })

  it("turning the bridge off mid-crossing drops it: no step runs later and nothing is announced", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "bridge/cross" })
    store.dispatch({ type: "bridge/setRole", on: false })
    expect(store.getSnapshot().bridge.crossing).toBeNull()
    store.scheduler.runUntilIdle()
    expect(causes(store)).not.toContain("bridge/crossed")
  })

  it("select and direction return the same state when nothing changes", () => {
    const store = newStore()
    const before = store.getSnapshot().bridge
    store.dispatch({ type: "bridge/select", band: "bridge" })
    store.dispatch({ type: "bridge/direction", direction: "radio-to-wifi" })
    expect(store.getSnapshot().bridge).toBe(before)
    store.dispatch({ type: "bridge/select", band: "wifi" })
    expect(store.getSnapshot().bridge.selected).toBe("wifi")
  })

  it("sidesOf names the two sides in travel order", () => {
    expect(sidesOf("radio-to-wifi")).toEqual({ from: "radio", to: "wifi" })
    expect(sidesOf("wifi-to-radio")).toEqual({ from: "wifi", to: "radio" })
  })
})

describe("bridge slice: it follows the radio", () => {
  it("a radio that stops pauses the bridge honestly, and the bridge turns back on once the radio runs again", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "error", reason: "The radio board stopped answering." })
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: BRIDGE_COPY.pausedReason })
    expect(store.getSnapshot().bridge.paused).toBe(true)

    // Nothing happens by time alone: the bridge waits for the radio.
    store.scheduler.runUntilIdle()
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: BRIDGE_COPY.pausedReason })

    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "starting" })
    expect(bridgeOf(store).reason).toBe(BRIDGE_COPY.pausedReason)
    store.scheduler.advance(TIMING.startingMs)
    expect(radioOf(store).state).toBe("live")
    expect(bridgeOf(store).state).toBe("starting")
    expect(store.getSnapshot().bridge.paused).toBe(false)
    store.scheduler.advance(TIMING.startingMs)
    expect(bridgeOf(store).state).toBe("live")
  })

  it("a crossing under way stops when the radio stops", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "bridge/cross" })
    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "error" })
    expect(store.getSnapshot().bridge.crossing).toBeNull()
    store.scheduler.runUntilIdle()
    expect(causes(store)).not.toContain("bridge/crossed")
  })

  it("turning the bridge off while paused means it stays off when the radio comes back", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "error" })
    store.dispatch({ type: "bridge/setRole", on: false })
    expect(store.getSnapshot().bridge.paused).toBe(false)
    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "starting", instant: true })
    expect(radioOf(store).state).toBe("live")
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: BRIDGE_REASON.ready })
  })

  it("unplugging the board leaves nothing to resume: NOT SET 'Needs a radio.', the opening ladder", () => {
    const store = newStore()
    bridgeOn(store)
    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "error" })
    store.dispatch({ type: "core/radioRemoved" })
    expect(bridgeOf(store)).toMatchObject({ state: "unset", reason: "Needs a radio." })
    expect(store.getSnapshot().bridge.paused).toBe(false)
    expect(store.getSnapshot().core.transport).toMatchObject({ joined: null, seeking: false })

    const live = newStore()
    bridgeOn(live)
    live.dispatch({ type: "core/radioRemoved" })
    expect(bridgeOf(live)).toMatchObject({ state: "unset", reason: "Needs a radio." })
    expect(live.getSnapshot().bridge.paused).toBe(false)
  })
})
