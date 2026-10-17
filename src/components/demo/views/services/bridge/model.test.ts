// Pure logic of the Bridge page: the phases, the board's steps, the ported flash confirm, the bootstrap
// rule as rows, the preferred-network ladder, and the sample crossing (only the wrapper changes).
import { describe, expect, it } from "vitest"
import { LABEL_PATTERN } from "@/lib/labels"
import { BRIDGE_COPY } from "../../../copy/bridge"
import { createDemoStore } from "../../../engine/store"
import type { Crossing } from "../../../engine/slices/bridge"
import { DEMO_WORLD, type World } from "../../../engine/world"
import {
  bridgePhase,
  confirmMissing,
  crossCaption,
  EMPTY_CONFIRM,
  factRows,
  ladderOutcome,
  ladderRows,
  missingText,
  nameMatches,
  outcomeText,
  packetBand,
  payloadLabel,
  radioStep,
  stepBusy,
  stepIndex,
  stepStrip,
  wrapperText,
} from "./model"

const newStore = (world: World = DEMO_WORLD) => {
  const store = createDemoStore(world, { router: "memory", driver: null })
  store.start()
  return store
}
const core = (store: ReturnType<typeof newStore>) => store.getSnapshot().core
const withFacts = (facts: Partial<World["self"]["facts"]>): World => ({ ...DEMO_WORLD, self: { ...DEMO_WORLD.self, facts: { ...DEMO_WORLD.self.facts, ...facts } } })

describe("bridgePhase and the board's steps", () => {
  it("walks needs-radio -> radio-setup -> ready, and radio-down when a set-up radio stops", () => {
    const store = newStore()
    expect(bridgePhase(core(store), DEMO_WORLD)).toBe("needs-radio")
    expect(radioStep(core(store))).toBeNull()

    store.dispatch({ type: "core/radioPlugged" })
    expect(bridgePhase(core(store), DEMO_WORLD)).toBe("radio-setup")
    expect(radioStep(core(store))).toBe("plugged")
    store.dispatch({ type: "core/radioAllowed" })
    expect(radioStep(core(store))).toBe("identifying")
    store.scheduler.runUntilIdle()
    expect(radioStep(core(store))).toBe("identified")
    store.dispatch({ type: "core/radioFlash", instant: true })
    expect(radioStep(core(store))).toBe("flashed")
    store.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    expect(radioStep(core(store))).toBe("starting")
    expect(bridgePhase(core(store), DEMO_WORLD)).toBe("radio-setup")
    store.scheduler.runUntilIdle()
    expect(radioStep(core(store))).toBeNull()
    expect(bridgePhase(core(store), DEMO_WORLD)).toBe("ready")

    store.dispatch({ type: "core/serviceTransition", id: "radio", to: "error" })
    expect(bridgePhase(core(store), DEMO_WORLD)).toBe("radio-down")
  })

  it("needs-link when the radio runs but the laptop has neither a hotspot nor ethernet", () => {
    const world = withFacts({ hotspot: false, ethernet: false })
    const store = newStore(world)
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(bridgePhase(core(store), world)).toBe("needs-link")
  })

  it("the strip: every step to come with no board, done/now/next as the board moves, all done while starting", () => {
    expect(stepStrip(null).map((s) => s.state)).toEqual(["next", "next", "next", "next"])
    expect(stepStrip("plugged").map((s) => s.state)).toEqual(["now", "next", "next", "next"])
    expect(stepStrip("flashing").map((s) => s.state)).toEqual(["done", "done", "now", "next"])
    expect(stepStrip("flashed").map((s) => s.state)).toEqual(["done", "done", "done", "now"])
    expect(stepStrip("starting").map((s) => s.state)).toEqual(["done", "done", "done", "done"])
    expect(stepStrip(null).map((s) => s.label)).toEqual(BRIDGE_COPY.radio.steps)
    expect(stepIndex("identified")).toBe(stepIndex("flashing"))
  })

  it("only the node's own steps are busy (no controls); the person's steps are not", () => {
    expect(["identifying", "flashing", "starting"].every((s) => stepBusy(s as never))).toBe(true)
    expect(["plugged", "identified", "flashed"].some((s) => stepBusy(s as never))).toBe(false)
  })
})

describe("the flash confirm (ported from the real flash-model.ts)", () => {
  const name = "USB radio board"

  it("needs both boxes and the name typed exactly (trimmed, case-sensitive, not empty)", () => {
    expect(nameMatches("USB radio board", name)).toBe(true)
    expect(nameMatches("  USB radio board ", name)).toBe(true)
    expect(nameMatches("usb radio board", name)).toBe(false)
    expect(nameMatches("", "  ")).toBe(false)
    expect(confirmMissing(EMPTY_CONFIRM, name)).toEqual(["erase", "own", "name"])
    expect(confirmMissing({ checks: { erase: true, own: true }, typed: name }, name)).toEqual([])
  })

  it("says what is still missing in one plain sentence, empty when complete", () => {
    expect(missingText(["erase", "own", "name"])).toBe("Still needed: tick both boxes and type the name exactly as shown.")
    expect(missingText(["own"])).toBe("Still needed: tick the second box.")
    expect(missingText(["erase"])).toBe("Still needed: tick the first box.")
    expect(missingText(["name"])).toBe("Still needed: type the name exactly as shown.")
    expect(missingText([])).toBe("")
  })
})

describe("factRows: the bootstrap rule (§6.8)", () => {
  it("before the radio: the hotspot is there, but the laptop cannot bridge yet", () => {
    const rows = factRows(core(newStore()), DEMO_WORLD)
    expect(rows.map((r) => [r.id, r.met])).toEqual([
      ["radio", false],
      ["hotspot", true],
      ["ethernet", false],
      ["outcome", false],
    ])
    expect(rows[0].value).toBe(BRIDGE_COPY.facts.radioNone)
    expect(rows[3].value).toBe(BRIDGE_COPY.facts.needsRadio)
  })

  it("with the radio running: a radio plus a hotspot, or a radio plus ethernet, and never with neither", () => {
    const up = (world: World) => {
      const store = newStore(world)
      store.dispatch({ type: "core/radioPlugged" })
      store.dispatch({ type: "core/radioAllowed", instant: true })
      store.dispatch({ type: "core/radioFlash", instant: true })
      store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
      return factRows(core(store), world)
    }
    expect(up(DEMO_WORLD)[3]).toMatchObject({ met: true, value: BRIDGE_COPY.facts.ready })
    expect(up(withFacts({ hotspot: false, ethernet: true }))[3]).toMatchObject({ met: true, value: BRIDGE_COPY.facts.readyEthernet })
    expect(up(withFacts({ hotspot: false, ethernet: false }))[3]).toMatchObject({ met: false, value: BRIDGE_COPY.facts.needsLink })
  })

  it("a board being set up is not a running radio", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    expect(factRows(core(store), DEMO_WORLD)[0]).toMatchObject({ met: false, value: BRIDGE_COPY.facts.radioSetup })
  })
})

describe("the preferred-network ladder", () => {
  it("lists Network A / B / C in the order tried, labelled by generic medium", () => {
    const rows = ladderRows(core(newStore()), DEMO_WORLD)
    expect(rows.map((r) => [r.rank, r.name, r.medium, r.word])).toEqual([
      [1, "Network A", "long-range radio", "no signal"],
      [2, "Network B", "Wi-Fi", "no signal"],
      [3, "Network C", "Bluetooth", "no signal"],
    ])
    expect(outcomeText(ladderOutcome(core(newStore()), DEMO_WORLD))).toBe("NONE IN RANGE → messages wait on the device")
  })

  it("first hit wins: seeking, then JOINED Network A with the rest not tried", () => {
    const store = newStore()
    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe" })
    store.scheduler.advance(1600)
    expect(ladderOutcome(core(store), DEMO_WORLD)).toEqual({ kind: "seeking" })
    store.scheduler.runUntilIdle()
    expect(ladderOutcome(core(store), DEMO_WORLD)).toEqual({ kind: "joined", network: "Network A" })
    expect(ladderRows(core(store), DEMO_WORLD).map((r) => r.word)).toEqual(["FOUND", "not tried", "not tried"])
    expect(outcomeText(ladderOutcome(core(store), DEMO_WORLD))).toBe("JOINED Network A")
  })
})

describe("the sample crossing: only the outer wrapper changes", () => {
  const at = (step: Crossing["step"]): Crossing => ({ id: "x1", direction: "radio-to-wifi", step, startedAt: 0 })

  it("is drawn on its side, at the bridge, then on the other side", () => {
    expect(packetBand(null)).toBeNull()
    expect(packetBand(at("in"))).toBe("radio")
    expect(packetBand(at("swap"))).toBe("bridge")
    expect(packetBand(at("out"))).toBe("wifi")
    expect(packetBand({ ...at("in"), direction: "wifi-to-radio" })).toBe("wifi")
  })

  it("the wrapper swaps at the bridge; the payload is never part of it", () => {
    expect(wrapperText(at("in"))).toBe("outer wrapper: long-range radio")
    expect(wrapperText(at("swap"))).toBe("outer wrapper: long-range radio → Wi-Fi")
    expect(wrapperText(at("out"))).toBe("outer wrapper: Wi-Fi")
    expect(crossCaption(at("swap"))).toContain("The payload stays sealed.")
    expect(crossCaption(at("out"))).toContain("The bridge never read it.")
  })

  it("the payload label is a–z and 2–7 only and the same on both sides of the bridge", () => {
    const label = payloadLabel(DEMO_WORLD, at("in"))
    expect(label).toMatch(LABEL_PATTERN)
    expect(payloadLabel(DEMO_WORLD, at("out"))).toBe(label)
    expect(payloadLabel(DEMO_WORLD, { id: "x2" })).not.toBe(label)
  })
})
