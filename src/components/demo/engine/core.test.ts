import { describe, expect, it } from "vitest"
import { LABEL_PATTERN } from "@/lib/labels"
import { OPENING_TRIES, TIMING } from "./core"
import { createFakeDriver } from "./scheduler"
import {
  attentionCount,
  attentionHref,
  attentionSummary,
  devicesSummary,
  homeHubHeard,
  meshNeighbours,
  needsYou,
  openProposals,
  ownDevice,
  proposalBlockedReason,
  selectDevices,
  serviceById,
  servicesHere,
  transportStatus,
  verdict,
} from "./selectors"
import { createDemoStore } from "./store"
import { allLabels, createWorld, DEMO_WORLD } from "./world"

const newStore = () => {
  const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
  store.start()
  return store
}

const causes = (store: ReturnType<typeof newStore>) => store.getSnapshot().core.events.map((e) => e.cause)

describe("world", () => {
  it("every sample label uses only a-z and 2-7, grouped 4-4-2", () => {
    const re = /^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{2}$/
    for (const seed of ["111-demo", "other", "x"]) {
      for (const label of allLabels(createWorld(seed))) {
        expect(label).toMatch(re)
        expect(label).toMatch(LABEL_PATTERN)
      }
    }
    expect(new Set(allLabels(DEMO_WORLD)).size).toBe(allLabels(DEMO_WORLD).length)
  })

  it("has the cast and the registry the plan names", () => {
    expect(DEMO_WORLD.self.name).toBe("Workshop laptop")
    expect(DEMO_WORLD.self.badge).toBe("LAPTOP")
    expect(DEMO_WORLD.cast.map((c) => c.name)).toEqual(["Ada", "Bram", "Workshop hub", "Ridge repeater", "Valley hub"])
    expect(DEMO_WORLD.services.map((s) => s.id)).toEqual(["agent", "model", "mesh", "radio", "kb", "gateway", "messaging", "bridge", "storage", "repairs"])
    const radio = DEMO_WORLD.services.find((s) => s.id === "radio")
    expect(radio).toMatchObject({ state: "unset", reason: "Needs a radio board." })
    expect(DEMO_WORLD.services.find((s) => s.id === "bridge")).toMatchObject({ state: "unset", reason: "Needs a radio." })
    expect(DEMO_WORLD.services.find((s) => s.id === "gateway")).toMatchObject({ state: "unset", setup: "none", overlay: true })
    expect(DEMO_WORLD.cast.find((c) => c.id === "ridge-repeater")).toMatchObject({ kind: "relay", canRead: false, deviceLabel: "radio relay" })
  })
})

describe("store", () => {
  it("is a factory: two stores never share state", () => {
    const a = newStore()
    const b = newStore()
    a.dispatch({ type: "core/setMode", mode: "advanced" })
    expect(a.getSnapshot().core.mode).toBe("advanced")
    expect(b.getSnapshot().core.mode).toBe("simple")
  })

  it("serves a constant server snapshot with no route", () => {
    const store = newStore()
    expect(store.getServerSnapshot().core.route).toBeNull()
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot())
    expect(store.getSnapshot().core.route?.view).toBe("overview")
  })

  it("navigates in memory, closes the drawer and counts route changes", () => {
    const store = newStore()
    const heard: number[] = []
    store.subscribe(() => heard.push(1))
    store.dispatch({ type: "core/setDrawer", open: true })
    store.navigate("/devices")
    const c = store.getSnapshot().core
    expect(c.route?.view).toBe("devices")
    expect(c.drawerOpen).toBe(false)
    expect(c.navCount).toBe(1)
    store.navigate("/devices")
    expect(store.getSnapshot().core.navCount).toBe(1)
    expect(heard).toHaveLength(2)
    expect(store.hrefFor("/devices")).toBe("/demo#/devices")
  })

  it("forced layouts ignore rail toggles", () => {
    const rail = createDemoStore(DEMO_WORLD, { router: "memory", layout: "rail", driver: null })
    rail.dispatch({ type: "core/toggleRail" })
    expect(rail.getSnapshot().core.railCollapsed).toBe(true)
    const auto = newStore()
    auto.dispatch({ type: "core/toggleRail" })
    expect(auto.getSnapshot().core.railCollapsed).toBe(true)
  })
})

describe("core: opening state", () => {
  it("reads alone on the mesh, with the radio waiting in needs-you and nothing counted", () => {
    const s = newStore().getSnapshot()
    expect(transportStatus(s)).toBe("isolated")
    expect(verdict(s)).toEqual({ sentence: "Your node is running. It is alone on the mesh right now: no nearby nodes heard.", tone: "attention" })
    const need = needsYou(s)
    expect(need.items.map((i) => i.key)).toEqual(["setup:radio"])
    expect(need.count).toBe(0)
    expect(attentionSummary(s)).toBe("Nothing needs you")
    expect(needsYou(s)).toBe(need)
  })
})

describe("core: radio lifecycle", () => {
  it("plug in -> allow once -> identify -> flash -> region -> live -> joined -> nodes heard one by one", () => {
    const store = newStore()
    const core = () => store.getSnapshot().core
    const radioSvc = () => serviceById(store.getSnapshot(), "radio")

    // Out of order: nothing happens.
    store.dispatch({ type: "core/radioAllowed" })
    expect(core().radio).toBeNull()

    store.dispatch({ type: "core/radioPlugged" })
    expect(core().radio).toMatchObject({ stage: "plugged", consent: false })
    expect(radioSvc()?.state).toBe("unset")
    expect(radioSvc()?.reason).toContain("plugged in")

    store.dispatch({ type: "core/radioAllowed" })
    expect(core().radio).toMatchObject({ stage: "identifying", consent: true })
    store.scheduler.advance(TIMING.identifyMs)
    expect(core().radio?.stage).toBe("identified")

    // Flash is ignored before identify finished, accepted after.
    store.dispatch({ type: "core/radioFlash" })
    expect(core().radio?.stage).toBe("flashing")
    store.scheduler.advance(TIMING.flashMs)
    expect(core().radio).toMatchObject({ stage: "flashed", firmware: "mesh" })
    expect(serviceById(store.getSnapshot(), "bridge")?.reason).toBe("Needs a radio.")

    store.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    expect(radioSvc()?.state).toBe("starting")
    store.scheduler.advance(TIMING.startingMs)
    expect(radioSvc()).toMatchObject({ state: "live", reason: "Running with the Europe settings. The board is listening on the mesh." })
    expect(core().transport).toMatchObject({ joined: null, seeking: true })
    expect(serviceById(store.getSnapshot(), "bridge")?.reason).toContain("Ready to set up")

    expect(core().heard).toHaveLength(0)
    store.scheduler.advance(TIMING.seekStepMs)
    expect(core().transport.joined).toBe("network-a")
    expect(core().transport.tries).toEqual({ "network-a": "found", "network-b": "not tried", "network-c": "not tried" })
    expect(verdict(store.getSnapshot()).sentence).toBe("Your node is running and connected to nearby nodes: messages can flow.")
    // Joined and the first node heard land together: "a nearby node has been heard" is never said over an empty list.
    expect(core().heard.map((h) => h.id)).toEqual(["ridge-repeater"])
    store.scheduler.advance(TIMING.heardGapMs)
    expect(core().heard.map((h) => h.id)).toEqual(["ridge-repeater", "valley-hub"])
    store.scheduler.advance(TIMING.heardGapMs)
    expect(core().heard.map((h) => h.id)).toEqual(["ridge-repeater", "valley-hub", "bram"])
    expect(core().heard.every((h) => h.cause === "radio-ready" && h.firstCause === "radio-ready" && h.via === "radio")).toBe(true)
    expect(core().heard.map((h) => h.blip)).toEqual([1, 2, 3])

    expect(causes(store)).toEqual([
      "radio-plugged",
      "radio-identified",
      "radio-flashed",
      "service-live",
      "radio-ready",
      "network-joined",
      "node-heard",
      "node-heard",
      "node-heard",
    ])
    expect(core().events.at(-1)).toMatchObject({ cause: "node-heard", ref: "bram", text: "Heard Bram over long-range radio." })
    expect(selectDevices(store.getSnapshot())).toMatchObject([{ id: "radio-board", state: "connected", dot: "live", stateLabel: "connected" }])
    expect(devicesSummary(store.getSnapshot()).text).toBe("1 device, connected.")
    expect(ownDevice(store.getSnapshot(), store.world)).toMatchObject({ bridges: true, deviceLabel: "laptop", badge: "LAPTOP" })
    // The bridge can now be set up with the agent; the radio row is gone.
    expect(needsYou(store.getSnapshot()).items.map((i) => i.key)).toEqual(["setup:bridge"])
  })

  it("the scheduler is the only clock: paused, nothing advances", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed" })
    store.scheduler.pause()
    store.scheduler.advance(60_000)
    expect(store.getSnapshot().core.radio?.stage).toBe("identifying")
    store.scheduler.resume()
    store.scheduler.advance(TIMING.identifyMs)
    expect(store.getSnapshot().core.radio?.stage).toBe("identified")
  })

  it("removing the board puts everything back", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioRemoved" })
    expect(store.getSnapshot().core.radio).toBeNull()
    expect(serviceById(store.getSnapshot(), "radio")?.reason).toBe("Needs a radio board.")
  })

  it("removing a live board drops the radio nodes, the joined network and the bridge, and restores the ladder", () => {
    const store = newStore()
    for (const a of [{ type: "core/radioPlugged" }, { type: "core/radioAllowed", instant: true }, { type: "core/radioFlash", instant: true }] as const) store.dispatch(a)
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    store.dispatch({ type: "core/heardNode", id: "workshop-hub", via: "wifi", cause: "custody-ack" })
    store.dispatch({ type: "core/serviceTransition", id: "bridge", to: "starting", instant: true })
    expect(serviceById(store.getSnapshot(), "bridge")?.state).toBe("live")
    store.dispatch({ type: "core/radioRemoved" })
    const c = store.getSnapshot().core
    expect(c.heard.map((h) => h.id)).toEqual(["workshop-hub"])
    expect(c.transport).toEqual({ joined: null, tries: OPENING_TRIES, seeking: false })
    expect(serviceById(store.getSnapshot(), "radio")?.state).toBe("unset")
    expect(serviceById(store.getSnapshot(), "bridge")).toMatchObject({ state: "unset", reason: "Needs a radio." })
    expect(serviceById(store.getSnapshot(), "mesh")?.reason).toBe("Running. None of the preferred networks is in range yet.")
    expect(selectDevices(store.getSnapshot())).toEqual([])
    expect(store.scheduler.pending()).toEqual([])
  })

  it("instant (reduced motion): every step lands at its end state in the same dispatch", () => {
    const store = newStore()
    const seen: string[] = []
    store.subscribe(() => seen.push(store.getSnapshot().core.radio?.stage ?? "none"))
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    expect(seen).toEqual(["plugged", "identified", "flashed"])
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    const s = store.getSnapshot()
    expect(serviceById(s, "radio")?.state).toBe("live")
    expect(s.core.transport.joined).toBe("network-a")
    expect(s.core.heard.map((h) => h.id)).toEqual(["ridge-repeater", "valley-hub", "bram"])
    expect(store.scheduler.pending()).toEqual([])
    store.dispatch({ type: "core/internetConnected", instant: true })
    expect(serviceById(store.getSnapshot(), "gateway")?.state).toBe("live")
  })
})

describe("core: internet", () => {
  it("connect -> gateway STARTING -> LIVE, a caused event, the laptop chip unchanged", () => {
    const store = newStore()
    store.dispatch({ type: "core/internetConnected" })
    const s1 = store.getSnapshot()
    expect(s1.core.internet).toBe("connected")
    expect(serviceById(s1, "gateway")?.state).toBe("starting")
    expect(s1.core.events.at(-1)).toMatchObject({ cause: "internet-connected", ref: "gateway" })
    store.scheduler.advance(TIMING.startingMs)
    const s2 = store.getSnapshot()
    expect(serviceById(s2, "gateway")?.state).toBe("live")
    expect(verdict(s2).sentence.endsWith(" It can reach the internet.")).toBe(true)
    expect(store.world.self.badge).toBe("LAPTOP")

    store.dispatch({ type: "core/internetLost" })
    expect(serviceById(store.getSnapshot(), "gateway")?.state).toBe("unset")
    expect(causes(store).slice(-1)).toEqual(["internet-lost"])
  })

  it("a gateway cannot start without the internet", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "gateway", to: "starting" })
    expect(serviceById(store.getSnapshot(), "gateway")?.state).toBe("unset")
  })
})

describe("core: proposals and needs-you", () => {
  it("accept -> target STARTING -> LIVE; the badge and needs-you update at once", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "mesh", to: "error" })
    store.dispatch({
      type: "core/proposalAdded",
      proposal: { id: "repairs-fix-1", kind: "fix", title: "Restart the mesh link", body: "It stopped answering.", target: "mesh", from: "repairs", cause: "fault" },
    })
    let s = store.getSnapshot()
    expect(verdict(s)).toMatchObject({ sentence: "Your node is running, but the mesh link has a problem.", tone: "error" })
    expect(attentionCount(s)).toBe(2)
    expect(attentionSummary(s)).toBe("1 proposal, 1 service error")
    expect(attentionHref(s)).toBe("/overview#needs-you")
    expect(needsYou(s).items.map((i) => i.kind)).toEqual(["proposal", "service", "setup"])

    store.dispatch({ type: "core/proposalAccepted", id: "repairs-fix-1" })
    s = store.getSnapshot()
    expect(serviceById(s, "mesh")?.state).toBe("starting")
    expect(attentionCount(s)).toBe(0)
    expect(s.core.proposals[0].decision?.decision).toBe("accepted")

    store.scheduler.advance(TIMING.startingMs)
    s = store.getSnapshot()
    expect(serviceById(s, "mesh")?.state).toBe("live")
    expect(transportStatus(s)).toBe("isolated")

    // A decided proposal cannot be decided again.
    store.dispatch({ type: "core/proposalDismissed", id: "repairs-fix-1" })
    expect(store.getSnapshot().core.proposals[0].decision?.decision).toBe("accepted")
    expect(causes(store)).toEqual(["service-error", "proposal-added", "proposal-accepted", "service-live"])
  })

  it("accept is refused while the target cannot start: the proposal stays open and the log says why", () => {
    const store = newStore()
    store.dispatch({ type: "core/proposalAdded", proposal: { id: "radio-1", kind: "setup", title: "Set up the long-range radio", body: "", target: "radio" } })
    expect(proposalBlockedReason(store.getSnapshot(), store.world, "radio-1")).toBe("Needs a radio board.")
    store.dispatch({ type: "core/proposalAccepted", id: "radio-1" })
    let s = store.getSnapshot()
    expect(s.core.proposals[0].decision).toBeNull()
    expect(openProposals(s).map((p) => p.id)).toEqual(["radio-1"])
    expect(attentionCount(s)).toBe(1)
    expect(serviceById(s, "radio")?.state).toBe("unset")
    expect(s.core.events.at(-1)).toMatchObject({ cause: "proposal-blocked", ref: "radio-1", text: "Long-range radio cannot start yet. Needs a radio board." })

    // The bridge: refused before the radio is live, accepted (STARTING -> LIVE) once it is.
    store.dispatch({ type: "core/proposalAdded", proposal: { id: "bridge-1", kind: "setup", title: "Set up the bridge", body: "", target: "bridge" } })
    store.dispatch({ type: "core/proposalAccepted", id: "bridge-1" })
    expect(serviceById(store.getSnapshot(), "bridge")?.state).toBe("unset")
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(proposalBlockedReason(store.getSnapshot(), store.world, "bridge-1")).toBeNull()
    store.dispatch({ type: "core/proposalAccepted", id: "bridge-1" })
    s = store.getSnapshot()
    expect(serviceById(s, "bridge")?.state).toBe("starting")
    expect(s.core.proposals.find((p) => p.id === "bridge-1")?.decision?.decision).toBe("accepted")
    store.scheduler.advance(TIMING.startingMs)
    expect(serviceById(store.getSnapshot(), "bridge")?.state).toBe("live")
    // The radio proposal: its target is live now, so accepting only records the decision.
    store.dispatch({ type: "core/proposalAccepted", id: "radio-1" })
    expect(store.getSnapshot().core.proposals[0].decision?.decision).toBe("accepted")
  })

  it("dismiss leaves the service as it was", () => {
    const store = newStore()
    store.dispatch({ type: "core/proposalAdded", proposal: { id: "p1", kind: "setup", title: "Set up the bridge", body: "", target: "bridge" } })
    store.dispatch({ type: "core/proposalDismissed", id: "p1" })
    expect(serviceById(store.getSnapshot(), "bridge")?.state).toBe("unset")
    expect(attentionCount(store.getSnapshot())).toBe(0)
  })

  it("an error moving to STARTING cancels nothing it should not, and an error cancels a pending LIVE", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "storage", to: "starting" })
    store.dispatch({ type: "core/serviceTransition", id: "storage", to: "error", reason: "Store full: new data refused." })
    store.scheduler.advance(TIMING.startingMs * 2)
    expect(serviceById(store.getSnapshot(), "storage")).toMatchObject({ state: "error", reason: "Store full: new data refused." })
  })
})

describe("core: prefill and events", () => {
  it("agentPrefill opens the Agent with the prompt; prefillTaken clears it", () => {
    const store = newStore()
    store.dispatch({ type: "core/agentPrefill", text: "Tell me about identity on this node.", from: "Identity · L2" })
    let c = store.getSnapshot().core
    expect(c.route?.view).toBe("agent")
    expect(c.prefill).toEqual({ seq: 1, text: "Tell me about identity on this node.", from: "Identity · L2" })
    store.dispatch({ type: "core/prefillTaken" })
    c = store.getSnapshot().core
    expect(c.prefill).toBeNull()
  })

  it("events carry a seq, the virtual time and the default sentence", () => {
    const store = newStore()
    store.scheduler.advance(5000)
    store.dispatch({ type: "core/emitEvent", cause: "listen-burst", ref: "ridge-repeater" })
    store.dispatch({ type: "core/emitEvent", cause: "nearby/custom", text: "Something specific." })
    const [a, b] = store.getSnapshot().core.events
    expect(a).toEqual({ seq: 1, cause: "listen-burst", at: 5000, text: "Listened for a minute and noted what was in range.", ref: "ridge-repeater" })
    expect(b).toMatchObject({ seq: 2, cause: "nearby/custom", text: "Something specific.", ref: null })
  })

  it("an ignored action keeps the same state and wakes nobody, even with the clock running", () => {
    const d = createFakeDriver()
    const store = createDemoStore(DEMO_WORLD, { router: "memory", driver: d })
    store.start()
    d.advance(5000)
    let woken = 0
    store.subscribe(() => woken++)
    const before = store.getSnapshot()
    const here = servicesHere(before)
    store.dispatch({ type: "core/radioAllowed" })
    store.dispatch({ type: "core/prefillTaken" })
    store.dispatch({ type: "core/setMode", mode: "simple" })
    expect(store.getSnapshot()).toBe(before)
    expect(woken).toBe(0)
    // A core change that leaves the registry and the verdict alone keeps their references.
    const v = verdict(before)
    const need = needsYou(before)
    d.advance(1000)
    store.dispatch({ type: "core/setDrawer", open: true })
    const after = store.getSnapshot()
    expect(after.core.now).toBe(6000)
    expect(woken).toBe(1)
    expect(servicesHere(after)).toBe(here)
    expect(verdict(after)).toBe(v)
    expect(needsYou(after)).toBe(need)
    store.stop()
  })

  it("renames the node; empty goes back to the world's name; a no-op wakes nobody", () => {
    const store = newStore()
    let woken = 0
    store.subscribe(() => woken++)
    store.dispatch({ type: "core/renameNode", alias: "  Bench node " })
    expect(store.getSnapshot().core.alias).toBe("Bench node")
    store.dispatch({ type: "core/renameNode", alias: "" })
    expect(store.getSnapshot().core.alias).toBe("Workshop laptop")
    const before = store.getSnapshot()
    store.dispatch({ type: "core/setMode", mode: "simple" })
    expect(store.getSnapshot()).toBe(before)
    expect(woken).toBe(2)
  })

  it("heardNode upserts, keeps every blip's cause and logs it unless quiet", () => {
    const store = newStore()
    store.dispatch({ type: "core/heardNode", id: "workshop-hub", via: "wifi", cause: "custody-ack" })
    store.scheduler.advance(1000)
    store.dispatch({ type: "core/heardNode", id: "workshop-hub", via: "wifi", cause: "listen-burst" })
    store.dispatch({ type: "core/heardNode", id: "valley-hub", via: "radio", cause: "listen-burst", quiet: true })
    const heard = store.getSnapshot().core.heard
    expect(heard).toHaveLength(2)
    expect(heard[0]).toMatchObject({ cause: "listen-burst", firstCause: "custody-ack", count: 2, firstAt: 0, lastAt: 1000, blip: 2 })
    expect(heard[1]).toMatchObject({ cause: "listen-burst", blip: 3 })
    expect(store.getSnapshot().core.blipSeq).toBe(3)
    expect(causes(store)).toEqual(["node-heard", "node-heard"])
    expect(store.getSnapshot().core.events[0]).toMatchObject({ ref: "workshop-hub", text: "Heard Workshop hub over Wi-Fi." })
  })

  it("the home hub heard over Wi-Fi is the home link, not a mesh neighbour", () => {
    const store = newStore()
    store.dispatch({ type: "core/heardNode", id: "workshop-hub", via: "wifi", cause: "custody-ack" })
    const s = store.getSnapshot()
    expect(meshNeighbours(s, store.world)).toEqual([])
    expect(meshNeighbours(s, store.world)).toBe(meshNeighbours(s, store.world))
    expect(homeHubHeard(s, store.world)).toMatchObject({ id: "workshop-hub", cause: "custody-ack" })
    expect(verdict(s).sentence).toBe("Your node is running. It is alone on the mesh right now: no nearby nodes heard.")
    store.dispatch({ type: "core/heardNode", id: "valley-hub", via: "radio", cause: "listen-burst" })
    expect(meshNeighbours(store.getSnapshot(), store.world).map((h) => h.id)).toEqual(["valley-hub"])
  })
})

describe("core: devices", () => {
  it("no attached device until the board is plugged in; the board needs setup until its region is set", () => {
    const store = newStore()
    expect(selectDevices(store.getSnapshot())).toEqual([])
    expect(devicesSummary(store.getSnapshot())).toEqual({ total: 0, connected: 0, needSetup: 0, error: 0, text: "Nothing attached or paired yet." })
    expect(ownDevice(store.getSnapshot(), store.world)).toMatchObject({ id: "workshop-laptop", name: "Workshop laptop", bridges: false })
    store.dispatch({ type: "core/radioPlugged" })
    const s = store.getSnapshot()
    expect(selectDevices(s)).toEqual([
      {
        id: "radio-board",
        name: "USB radio board",
        kind: "long-range radio board",
        state: "needs setup",
        dot: "unset",
        stateLabel: "needs setup",
        reason: "A radio board is plugged in. Allow the node to identify it, once.",
        href: "/devices/radio-board",
        stage: "plugged",
      },
    ])
    expect(devicesSummary(s).text).toBe("1 device: 1 needs setup.")
    expect(selectDevices(s)).toBe(selectDevices(s))
    expect(ownDevice(s, store.world).facts.at(-1)).toBe("a radio board on USB")
  })
})
