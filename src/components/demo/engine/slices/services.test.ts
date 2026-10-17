// The services slice (service page template): the sample logs, the caused log lines, and Restart going
// STARTING -> LIVE through core and the scheduler. Every rule of the services-template brief.
import { describe, expect, it } from "vitest"
import { TIMING } from "../core"
import { createDemoStore } from "../store"
import { NO_NEEDS, type ServiceId } from "../types"
import { DEMO_WORLD } from "../world"
import {
  canRestartService,
  eventLogTargets,
  initialServices,
  isTemplateService,
  LOG_KEEP,
  needsServices,
  RESTART_LIVE_MS,
  TEMPLATE_SERVICES,
} from "./services"

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
const stateOf = (store: ReturnType<typeof newStore>, id: ServiceId) => store.getSnapshot().core.services.find((s) => s.id === id)?.state
const logOf = (store: ReturnType<typeof newStore>, id: (typeof TEMPLATE_SERVICES)[number]) => store.getSnapshot().services.logs[id]

/** Plug, allow, identify, flash, pick a region: the radio board's whole setup, instantly. */
function setUpRadio(store: ReturnType<typeof newStore>) {
  store.dispatch({ type: "core/radioPlugged" })
  store.dispatch({ type: "core/radioAllowed", instant: true })
  store.dispatch({ type: "core/radioFlash", instant: true })
  store.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0], instant: true })
}

describe("services slice: template services", () => {
  it("covers the six template services and none of the custom pages", () => {
    expect(TEMPLATE_SERVICES).toEqual(["agent", "model", "mesh", "radio", "kb", "messaging"])
    for (const id of ["gateway", "bridge", "storage", "repairs"]) expect(isTemplateService(id)).toBe(false)
  })

  it("offers Restart only for the programs the node supervises (agent, model, mesh link)", () => {
    expect(TEMPLATE_SERVICES.filter(canRestartService)).toEqual(["agent", "model", "mesh"])
    expect(canRestartService("bridge")).toBe(false)
  })

  it("adds no needs-you rows of its own", () => {
    expect(needsServices()).toBe(NO_NEEDS)
  })
})

describe("services slice: sample logs", () => {
  it("opens every log with a short history from before the demo opened, oldest first, ids not from the clock", () => {
    const logs = initialServices(DEMO_WORLD).logs
    for (const id of TEMPLATE_SERVICES) {
      const lines = logs[id]
      expect(lines.length).toBeGreaterThan(0)
      expect(lines.length).toBeLessThanOrEqual(8)
      for (const l of lines) {
        expect(l.at).toBeLessThan(0)
        expect(l.id).toMatch(new RegExp(`^h-${id}-\\d+$`))
        expect(l.text).not.toBe("")
      }
      expect([...lines].sort((a, b) => a.at - b.at)).toEqual(lines)
    }
  })

  it("the radio and mesh histories say there is no board and no network in range yet", () => {
    const logs = initialServices(DEMO_WORLD).logs
    expect(logs.radio.map((l) => l.text).join(" ")).toMatch(/none found/)
    expect(logs.mesh.at(-1)?.text).toBe("None of the preferred networks is in range yet.")
    expect(logs.mesh).toHaveLength(DEMO_WORLD.networks.length + 2)
  })

  it("nothing is added while idle", () => {
    const store = newStore()
    const before = store.getSnapshot().services
    store.scheduler.runUntilIdle()
    expect(store.getSnapshot().services).toBe(before)
  })

  it("an unrelated action keeps the slice's identity (no re-render)", () => {
    const store = newStore()
    const before = store.getSnapshot().services
    store.dispatch({ type: "core/setMode", mode: "advanced" })
    store.dispatch({ type: "core/navigate", path: "/devices" })
    expect(store.getSnapshot().services).toBe(before)
  })

  it("keeps at most LOG_KEEP lines, dropping the oldest", () => {
    const store = newStore()
    for (let i = 0; i < LOG_KEEP + 5; i++) store.dispatch({ type: "core/emitEvent", cause: "message-sent", text: `sent ${i}`, ref: null })
    const lines = logOf(store, "messaging")
    expect(lines).toHaveLength(LOG_KEEP)
    expect(lines.at(-1)?.text).toBe(`sent ${LOG_KEEP + 4}`)
    expect(new Set(lines.map((l) => l.id)).size).toBe(LOG_KEEP)
  })
})

describe("services slice: caused log lines", () => {
  it("routes events to the log they belong in", () => {
    const none = { heard: [] }
    expect(eventLogTargets({ cause: "message-sent", ref: null }, none)).toEqual(["messaging"])
    expect(eventLogTargets({ cause: "custody-ack", ref: null }, none)).toEqual(["messaging"])
    expect(eventLogTargets({ cause: "proposal-added", ref: null }, none)).toEqual(["agent"])
    expect(eventLogTargets({ cause: "service-live", ref: "mesh" }, none)).toEqual([])
    expect(eventLogTargets({ cause: "welcome", ref: null }, none)).toEqual([])
  })

  it("a node heard over long-range radio lands in both the mesh and the radio logs", () => {
    const heard = [{ id: "ridge-repeater", via: "radio" }] as never
    expect(eventLogTargets({ cause: "node-heard", ref: "ridge-repeater" }, { heard })).toEqual(["mesh", "radio"])
    const wifi = [{ id: "workshop-hub", via: "wifi" }] as never
    expect(eventLogTargets({ cause: "node-heard", ref: "workshop-hub" }, { heard: wifi })).toEqual(["mesh"])
  })

  it("logs a service's state change with the state word and its reason", () => {
    const store = newStore()
    const n = logOf(store, "mesh").length
    store.dispatch({ type: "core/serviceTransition", id: "mesh", to: "error", reason: "Stopped answering." })
    expect(logOf(store, "mesh").slice(n).map((l) => l.text)).toEqual(["ERROR · Stopped answering."])
  })

  it("line times come from the virtual clock, ids from the slice counter", () => {
    const store = newStore()
    store.scheduler.advance(5000)
    store.dispatch({ type: "core/emitEvent", cause: "message-sent", text: "sent", ref: null })
    const line = logOf(store, "messaging").at(-1)
    expect(line?.at).toBe(store.getSnapshot().core.now)
    expect(line?.id).toBe(`l${store.getSnapshot().services.seq}`)
  })
})

describe("services slice: Restart", () => {
  it("LIVE -> STARTING at once, then LIVE through the scheduler after the starting time", () => {
    const store = newStore()
    store.dispatch({ type: "services/restart", id: "mesh" })
    expect(stateOf(store, "mesh")).toBe("starting")
    expect(store.getSnapshot().services.restarting).toEqual(["mesh"])
    const events = store.getSnapshot().core.events
    expect(events.at(-1)).toMatchObject({ cause: "services/restart", text: "Restarting Mesh link.", ref: "mesh" })

    store.scheduler.advance(TIMING.startingMs - 1)
    expect(stateOf(store, "mesh")).toBe("starting")
    store.scheduler.advance(1)
    expect(stateOf(store, "mesh")).toBe("live")
    expect(store.getSnapshot().services.restarting).toEqual([])
    expect(store.getSnapshot().core.events.map((e) => e.cause)).toContain("service-live")
  })

  it("leaves the press, STARTING and LIVE in the service's log", () => {
    const store = newStore()
    const n = logOf(store, "agent").length
    store.dispatch({ type: "services/restart", id: "agent" })
    store.scheduler.runUntilIdle()
    const added = logOf(store, "agent").slice(n).map((l) => l.text)
    expect(added[0]).toBe("Restart asked for from the dashboard.")
    expect(added[1]).toMatch(/^STARTING · /)
    expect(added[2]).toMatch(/^LIVE · /)
    expect(added).toHaveLength(3)
  })

  it("the model takes longer to load than a program takes to start", () => {
    expect(RESTART_LIVE_MS.model).toBeGreaterThan(TIMING.startingMs)
    const store = newStore()
    store.dispatch({ type: "services/restart", id: "model" })
    store.scheduler.advance(TIMING.startingMs)
    expect(stateOf(store, "model")).toBe("starting")
    store.scheduler.advance((RESTART_LIVE_MS.model ?? 0) - TIMING.startingMs)
    expect(stateOf(store, "model")).toBe("live")
  })

  it("under reduced motion the end state lands in the same dispatch", () => {
    const store = newStore()
    store.dispatch({ type: "services/restart", id: "mesh", instant: true })
    expect(stateOf(store, "mesh")).toBe("live")
    expect(store.getSnapshot().services.restarting).toEqual([])
  })

  it("a second press while restarting is ignored", () => {
    const store = newStore()
    store.dispatch({ type: "services/restart", id: "mesh" })
    const mid = store.getSnapshot().services
    store.dispatch({ type: "services/restart", id: "mesh" })
    expect(store.getSnapshot().services).toBe(mid)
    expect(store.getSnapshot().core.events.filter((e) => e.cause === "services/restart")).toHaveLength(1)
  })

  it("restarts a service in ERROR back to LIVE", () => {
    const store = newStore()
    store.dispatch({ type: "core/serviceTransition", id: "agent", to: "error", reason: "Stopped answering." })
    store.dispatch({ type: "services/restart", id: "agent" })
    store.scheduler.runUntilIdle()
    expect(stateOf(store, "agent")).toBe("live")
  })

  it("is ignored for built-in parts, the radio, the custom pages and a NOT SET service", () => {
    const store = newStore()
    const before = store.getSnapshot()
    for (const id of ["kb", "messaging", "radio", "bridge", "storage", "gateway", "repairs"] as const) store.dispatch({ type: "services/restart", id })
    const after = store.getSnapshot()
    expect(after.services).toBe(before.services)
    expect(after.core.services).toBe(before.core.services)
  })
})

describe("services slice: long-range radio", () => {
  it("stays NOT SET until the board is flashed and a region is picked, then goes STARTING -> LIVE", () => {
    const store = newStore()
    expect(stateOf(store, "radio")).toBe("unset")
    store.dispatch({ type: "core/radioPlugged" })
    expect(stateOf(store, "radio")).toBe("unset")
    store.dispatch({ type: "core/radioAllowed" })
    store.scheduler.advance(TIMING.identifyMs)
    expect(stateOf(store, "radio")).toBe("unset")
    store.dispatch({ type: "core/radioFlash" })
    store.scheduler.advance(TIMING.flashMs)
    expect(store.getSnapshot().core.radio?.stage).toBe("flashed")
    expect(stateOf(store, "radio")).toBe("unset")
    store.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0] })
    expect(stateOf(store, "radio")).toBe("starting")
    store.scheduler.advance(TIMING.startingMs)
    expect(stateOf(store, "radio")).toBe("live")
  })

  it("its log gains the setup's reasons and the nodes heard over radio", () => {
    const store = newStore()
    const n = logOf(store, "radio").length
    setUpRadio(store)
    store.scheduler.runUntilIdle()
    const added = logOf(store, "radio").slice(n).map((l) => l.text)
    expect(added.some((t) => t.startsWith("LIVE · "))).toBe(true)
    expect(added.filter((t) => t.startsWith("Heard ")).length).toBeGreaterThanOrEqual(3)
    // The same nodes are in the mesh link's log; the slice never invents lines while idle afterwards.
    const settled = store.getSnapshot().services
    store.scheduler.runUntilIdle()
    expect(store.getSnapshot().services).toBe(settled)
  })
})
