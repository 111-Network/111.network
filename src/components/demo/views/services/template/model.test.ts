// Pure rules of the service page template: Restart's control, the radio's contextual step, the log text,
// the tab keys and the plain-word facts.
import { describe, expect, it } from "vitest"
import { createDemoStore } from "../../../engine/store"
import { meshNeighbours, openProposals } from "../../../engine/selectors"
import { DEMO_WORLD } from "../../../engine/world"
import { TEMPLATE_SERVICES, type ServiceLogLine, type TemplateServiceId } from "../../../engine/slices/services"
import { factRows, hasActions, LOG_LINES, logText, nextTab, radioStep, restartView, type FactRow } from "./model"

const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })

function rowsFor(store: ReturnType<typeof newStore>, id: TemplateServiceId): FactRow[] {
  const s = store.getSnapshot()
  const service = s.core.services.find((x) => x.id === id)
  if (!service) throw new Error(id)
  return factRows(id, service, {
    world: DEMO_WORLD,
    services: s.core.services,
    radio: s.core.radio,
    transport: s.core.transport,
    heard: meshNeighbours(s, DEMO_WORLD),
    openProposals: openProposals(s).length,
  })
}
const valueOf = (rows: FactRow[], label: string) => rows.find((r) => r.label === label)?.parts.map((p) => p.text).join(" · ")

describe("restartView", () => {
  it("shows Restart for a LIVE or ERROR supervised service", () => {
    expect(restartView({ id: "mesh", state: "live" }, [])).toEqual({ show: true, loading: false, label: "Restart" })
    expect(restartView({ id: "agent", state: "error" }, []).show).toBe(true)
  })

  it("keeps its own restart on screen as the busy 'Restarting…' button", () => {
    expect(restartView({ id: "model", state: "starting" }, ["model"])).toEqual({ show: true, loading: true, label: "Restarting…" })
  })

  it("offers none while STARTING for another reason, NOT SET, or for parts the node does not supervise", () => {
    expect(restartView({ id: "mesh", state: "starting" }, []).show).toBe(false)
    expect(restartView({ id: "mesh", state: "unset" }, []).show).toBe(false)
    for (const id of ["radio", "kb", "messaging"] as const) expect(restartView({ id, state: "live" }, []).show).toBe(false)
  })
})

describe("radio step", () => {
  it("plug ([DEMO]) with no board, continue on the board's page while setting up, nothing once set up", () => {
    expect(radioStep(null)).toBe("plug")
    for (const stage of ["plugged", "identifying", "identified", "flashing", "flashed"] as const) expect(radioStep({ stage })).toBe("continue")
    expect(radioStep({ stage: "ready" })).toBeNull()
  })

  it("puts something in the actions slot only when there is a control to show", () => {
    expect(hasActions({ id: "radio", state: "unset" }, [], null)).toBe(true)
    expect(hasActions({ id: "radio", state: "live" }, [], { stage: "ready" })).toBe(false)
    expect(hasActions({ id: "kb", state: "live" }, [], null)).toBe(false)
    expect(hasActions({ id: "mesh", state: "live" }, [], null)).toBe(true)
  })
})

describe("log text", () => {
  const lines: ServiceLogLine[] = [
    { id: "a", at: -7 * 3600_000, text: "first" },
    { id: "b", at: 0, text: "second" },
    { id: "c", at: 65_000, text: "third" },
  ]

  it("prints each line whole with its virtual-clock time, oldest first", () => {
    expect(logText(lines, 0)).toEqual(["02:00:00  first", "09:00:00  second", "09:01:05  third"])
  })

  it("simple mode keeps the newest few lines, advanced keeps them all", () => {
    expect(logText(lines, 2)).toEqual(["09:00:00  second", "09:01:05  third"])
    expect(LOG_LINES.simple).toBeLessThan(LOG_LINES.advanced)
  })
})

describe("tabs", () => {
  it("arrows wrap around", () => {
    expect(nextTab(2, 0, 1)).toBe(1)
    expect(nextTab(2, 1, 1)).toBe(0)
    expect(nextTab(2, 0, -1)).toBe(1)
    expect(nextTab(0, 0, 1)).toBe(0)
  })
})

describe("facts", () => {
  it("every page says what it does in one sentence and how it runs, with unique labels", () => {
    const store = newStore()
    for (const id of TEMPLATE_SERVICES) {
      const rows = rowsFor(store, id)
      expect(rows[0].label).toBe("What it does")
      expect(rows[0].parts[0].text).toMatch(/^[A-Z][^.]*\.$/)
      expect(rows[1].label).toBe("Runs as")
      expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length)
    }
  })

  it("prints no ports, ids, versions or reason codes", () => {
    const store = newStore()
    for (const id of TEMPLATE_SERVICES) {
      for (const r of rowsFor(store, id).filter((x) => x.minMode !== "advanced")) {
        const value = r.parts.map((p) => p.text).join(" ")
        expect(value).not.toMatch(/\d/)
        expect(value).not.toMatch(/[a-z]+_[a-z]+|\bv\d|:\d/)
      }
    }
  })

  it("the time of the last change shows only in advanced mode", () => {
    const rows = rowsFor(newStore(), "kb")
    expect(rows.at(-1)).toMatchObject({ label: "Last change", minMode: "advanced" })
  })

  it("mesh link: nothing joined and nobody heard before the radio; Network A and its nodes after", () => {
    const store = newStore()
    let rows = rowsFor(store, "mesh")
    expect(valueOf(rows, "Joined")).toBe("none yet: no preferred network is in range")
    expect(valueOf(rows, "Heard over the mesh")).toBe("nobody yet · open Nearby")
    expect(valueOf(rows, "Can read messages")).toBe("no: it carries them sealed")

    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0], instant: true })
    store.scheduler.runUntilIdle()
    rows = rowsFor(store, "mesh")
    const a = DEMO_WORLD.networks[0]
    expect(valueOf(rows, "Joined")).toBe(`${a.name}, over ${a.mediumLabel}`)
    expect(valueOf(rows, "Heard over the mesh")).toMatch(/Ridge repeater/)
    // The home hub over Wi-Fi is the home link, not a mesh neighbour.
    expect(valueOf(rows, "Heard over the mesh")).not.toMatch(/Workshop hub/)
  })

  it("long-range radio: no board, then the board's stage, then transmitting with the region picked", () => {
    const store = newStore()
    expect(valueOf(rowsFor(store, "radio"), "Radio board")).toBe("none plugged in")
    expect(valueOf(rowsFor(store, "radio"), "Transmits")).toMatch(/^not yet/)
    store.dispatch({ type: "core/radioPlugged" })
    const board = rowsFor(store, "radio").find((r) => r.label === "Radio board")
    expect(board?.parts[0].to).toBe("/devices/radio-board")
    expect(board?.parts[1].text).toBe("plugged in, waiting for your OK")
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: "Europe", instant: true })
    expect(valueOf(rowsFor(store, "radio"), "Region")).toBe("Europe")
    expect(valueOf(rowsFor(store, "radio"), "Transmits")).toBe("yes, with the Europe settings")
  })

  it("agent: the model it thinks with links to that page with its state word; the proposal count follows core", () => {
    const store = newStore()
    const think = rowsFor(store, "agent").find((r) => r.label === "Thinks with")
    expect(think?.parts.map((p) => p.text)).toEqual(["Local model", "LIVE"])
    expect(think?.parts[0].to).toBe("/services/model")
    expect(valueOf(rowsFor(store, "agent"), "Proposals waiting")).toBe("none · open the chat")
  })

  it("messaging names the home hub over Wi-Fi", () => {
    expect(valueOf(rowsFor(newStore(), "messaging"), "Home hub")).toBe("Workshop hub, over Wi-Fi")
  })
})
