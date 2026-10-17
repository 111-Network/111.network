// The devices slice through a memory store and the virtual scheduler: the radio board's whole flow
// (plug in -> consent -> identify -> flash with the typed device-name confirm -> region -> the
// Long-range radio service STARTING -> LIVE), the human gate on the flash, "Not now", unplugging,
// and the bootstrap rule for this laptop's "also bridges radio and Wi-Fi".
import { describe, expect, it } from "vitest"
import { DEVICE_COPY } from "../../copy/core"
import { RADIO_BOARD_ID, TIMING } from "../core"
import { ownDevice, selectDevices, serviceById } from "../selectors"
import { createDemoStore, type DemoStore } from "../store"
import { DEMO_WORLD, createWorld } from "../world"
import { confirmMissing, confirmValid, EMPTY_CONFIRM, flashName, nameMatches, needsDevices, type FlashConfirm } from "./devices"
import type { DemoState } from "./index"

const setup = (world = DEMO_WORLD): DemoStore => createDemoStore(world, { router: "memory", driver: null, initialPath: "/devices" })
const snap = (s: DemoStore): DemoState => s.getSnapshot()
const stage = (s: DemoStore) => snap(s).core.radio?.stage ?? null
const causes = (s: DemoStore): string[] => snap(s).core.events.map((e) => e.cause)
const radioState = (s: DemoStore) => serviceById(snap(s), "radio")?.state

const full = (typed: string): FlashConfirm => ({ checks: { erase: true, own: true }, typed })

/** Plug in, allow, and let the identify finish. */
function identified(s: DemoStore): void {
  s.dispatch({ type: "core/radioPlugged" })
  s.dispatch({ type: "core/radioAllowed" })
  s.scheduler.advance(TIMING.identifyMs)
}

describe("the flash confirmation (real flash-model rules)", () => {
  it("the name matches trimmed, case-sensitive and never empty", () => {
    expect(nameMatches("  USB radio board ", "USB radio board")).toBe(true)
    expect(nameMatches("usb radio board", "USB radio board")).toBe(false)
    expect(nameMatches("", "")).toBe(false)
    expect(nameMatches("x", "   ")).toBe(false)
  })

  it("lists what is missing in form order and is valid only when complete", () => {
    expect(confirmMissing(EMPTY_CONFIRM, "Bench")).toEqual(["erase", "own", "name"])
    expect(confirmMissing({ checks: { erase: true, own: false }, typed: "Bench" }, "Bench")).toEqual(["own"])
    expect(confirmValid(full("Bench"), "Bench")).toBe(true)
    expect(confirmValid(full("bench"), "Bench")).toBe(false)
  })

  it("asks for the name the page shows: the alias, else the detected name", () => {
    expect(flashName({ alias: null, name: "USB radio board" })).toBe("USB radio board")
    expect(flashName({ alias: "Bench radio", name: "USB radio board" })).toBe("Bench radio")
  })
})

describe("devices slice: the radio board flow", () => {
  it("opens with no devices, no board and nothing of its own in needs-you", () => {
    const s = setup()
    expect(selectDevices(snap(s))).toEqual([])
    expect(snap(s).devices).toEqual({ boardSeq: 0, pluggedAt: null, consentAt: null, consentDeclined: false, flashOpen: false })
    expect(needsDevices()).toEqual([])
  })

  it("a plugged board appears as needing setup, likely, waiting for the one-time consent; nothing is scheduled", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    const [board] = selectDevices(snap(s))
    expect(board).toMatchObject({ id: RADIO_BOARD_ID, state: "needs setup", dot: "unset", stage: "plugged" })
    expect(snap(s).devices.boardSeq).toBe(1)
    expect(snap(s).devices.pluggedAt).toBe(snap(s).core.now)
    expect(causes(s)).toContain("radio-plugged")
    // A real node waits indefinitely at a human gate: nothing moves until "Allow once".
    expect(s.scheduler.pending()).toHaveLength(0)
    s.scheduler.runUntilIdle()
    expect(stage(s)).toBe("plugged")
  })

  it("Not now leaves the board alone; Identify it… brings the question back", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "devices/notNow" })
    expect(snap(s).devices.consentDeclined).toBe(true)
    expect(snap(s).core.radio?.consent).toBe(false)
    expect(s.scheduler.pending()).toHaveLength(0)
    s.dispatch({ type: "devices/askAgain" })
    expect(snap(s).devices.consentDeclined).toBe(false)
  })

  it("Allow once identifies the board through the scheduler and records when consent was given", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.scheduler.advance(5000)
    s.dispatch({ type: "core/radioAllowed" })
    expect(stage(s)).toBe("identifying")
    expect(snap(s).devices.consentAt).toBe(5000)
    s.scheduler.advance(TIMING.identifyMs - 1)
    expect(stage(s)).toBe("identifying")
    s.scheduler.advance(1)
    expect(stage(s)).toBe("identified")
    expect(causes(s)).toContain("radio-identified")
  })

  it("Not now is ignored once consent is given", () => {
    const s = setup()
    identified(s)
    s.dispatch({ type: "devices/notNow" })
    expect(snap(s).devices.consentDeclined).toBe(false)
  })

  it("the flash only opens on an identified board", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "devices/openFlash" })
    expect(snap(s).devices.flashOpen).toBe(false)
    s.dispatch({ type: "core/radioAllowed" })
    s.scheduler.advance(TIMING.identifyMs)
    s.dispatch({ type: "devices/openFlash" })
    expect(snap(s).devices.flashOpen).toBe(true)
    s.dispatch({ type: "devices/closeFlash" })
    expect(snap(s).devices.flashOpen).toBe(false)
  })

  it("the human gate: no flash without the open confirmation, both boxes and the exact typed name", () => {
    const s = setup()
    identified(s)
    const name = flashName(snap(s).core.radio ?? { alias: null, name: "" })
    // Not opened: refused even when complete.
    s.dispatch({ type: "devices/flash", confirm: full(name) })
    expect(stage(s)).toBe("identified")
    s.dispatch({ type: "devices/openFlash" })
    s.dispatch({ type: "devices/flash", confirm: { checks: { erase: true, own: false }, typed: name } })
    s.dispatch({ type: "devices/flash", confirm: full(name.toLowerCase()) })
    s.dispatch({ type: "devices/flash", confirm: full("") })
    expect(stage(s)).toBe("identified")
    expect(snap(s).devices.flashOpen).toBe(true)
  })

  it("a renamed board asks for its new name", () => {
    const s = setup()
    identified(s)
    s.dispatch({ type: "core/radioRenamed", alias: "Bench radio" })
    s.dispatch({ type: "devices/openFlash" })
    s.dispatch({ type: "devices/flash", confirm: full(DEMO_WORLD.radioBoardName) })
    expect(stage(s)).toBe("identified")
    s.dispatch({ type: "devices/flash", confirm: full("Bench radio") })
    expect(stage(s)).toBe("flashing")
  })

  it("a complete confirmation flashes through core, closes the confirmation and emits radio-flashed (Nearby uses it)", () => {
    const s = setup()
    identified(s)
    s.dispatch({ type: "devices/openFlash" })
    s.dispatch({ type: "devices/flash", confirm: full(DEMO_WORLD.radioBoardName) })
    expect(stage(s)).toBe("flashing")
    expect(snap(s).devices.flashOpen).toBe(false)
    expect(causes(s)).not.toContain("radio-flashed")
    s.scheduler.advance(TIMING.flashMs)
    expect(stage(s)).toBe("flashed")
    expect(snap(s).core.radio?.firmware).toBe("mesh")
    expect(causes(s)).toContain("radio-flashed")
    // Flashed is not transmitting: the board waits for its region, indefinitely.
    expect(s.scheduler.pending()).toHaveLength(0)
    expect(radioState(s)).toBe("unset")
  })

  it("the region starts the Long-range radio service: STARTING, then LIVE through the scheduler", () => {
    const s = setup()
    identified(s)
    s.dispatch({ type: "devices/openFlash" })
    s.dispatch({ type: "devices/flash", confirm: full(DEMO_WORLD.radioBoardName) })
    s.scheduler.advance(TIMING.flashMs)
    s.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0] })
    expect(stage(s)).toBe("ready")
    expect(radioState(s)).toBe("starting")
    s.scheduler.advance(TIMING.startingMs)
    expect(radioState(s)).toBe("live")
    const [board] = selectDevices(snap(s))
    expect(board).toMatchObject({ state: "connected", dot: "live", reason: DEVICE_COPY.radioReady })
  })

  it("reduced motion: every step lands in the same dispatch, so only end states are seen", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "core/radioAllowed", instant: true })
    expect(stage(s)).toBe("identified")
    s.dispatch({ type: "devices/openFlash" })
    s.dispatch({ type: "devices/flash", confirm: full(DEMO_WORLD.radioBoardName), instant: true })
    expect(stage(s)).toBe("flashed")
    s.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(radioState(s)).toBe("live")
  })

  it("unplugging clears the board's UI state; the next board starts fresh with a new key", () => {
    const s = setup()
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "devices/notNow" })
    s.dispatch({ type: "core/radioRemoved" })
    expect(snap(s).devices).toMatchObject({ boardSeq: 1, pluggedAt: null, consentAt: null, consentDeclined: false, flashOpen: false })
    expect(selectDevices(snap(s))).toEqual([])
    s.dispatch({ type: "core/radioPlugged" })
    expect(snap(s).devices.boardSeq).toBe(2)
    expect(snap(s).devices.consentDeclined).toBe(false)
  })

  it("an action that changes nothing keeps the slice's identity", () => {
    const s = setup()
    const before = snap(s).devices
    s.dispatch({ type: "devices/closeFlash" })
    s.dispatch({ type: "devices/askAgain" })
    s.dispatch({ type: "core/setMode", mode: "advanced" })
    expect(snap(s).devices).toBe(before)
  })
})

describe("this laptop: the bootstrap rule (plan §6.8)", () => {
  function setUp(s: DemoStore) {
    s.dispatch({ type: "core/radioPlugged" })
    s.dispatch({ type: "core/radioAllowed", instant: true })
    s.dispatch({ type: "devices/openFlash" })
    s.dispatch({ type: "devices/flash", confirm: full(DEMO_WORLD.radioBoardName), instant: true })
  }

  it("bridges only once its radio is live beside Wi-Fi that can host a hotspot", () => {
    const s = setup()
    expect(ownDevice(snap(s), DEMO_WORLD).bridges).toBe(false)
    setUp(s)
    expect(ownDevice(snap(s), DEMO_WORLD).bridges).toBe(false)
    s.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    expect(ownDevice(snap(s), DEMO_WORLD).bridges).toBe(false) // STARTING is not live
    s.scheduler.advance(TIMING.startingMs)
    expect(ownDevice(snap(s), DEMO_WORLD).bridges).toBe(true)
  })

  it("never bridges without a hotspot or ethernet, even with a live radio", () => {
    const base = createWorld()
    const world = { ...base, self: { ...base.self, facts: { ...base.self.facts, hotspot: false, ethernet: false } } }
    const s = setup(world)
    setUp(s)
    s.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(serviceById(snap(s), "radio")?.state).toBe("live")
    expect(ownDevice(snap(s), world).bridges).toBe(false)
  })
})
