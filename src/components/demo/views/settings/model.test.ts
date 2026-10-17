// Pure model of Settings: the Essentials rows, name and restart rules, sharing note, the update
// steps and sentences, every layer page's status rows, links and prompt, the key strip, and the
// §6.8 copy rules (no CLI string, no hostname, no recovery-word count, no pair code).
import { describe, expect, it } from "vitest"
import { isGroupedLabel } from "@/lib/labels"
import { LAYER_PAGES } from "../../copy/core"
import { SETTINGS_COPY } from "../../copy/settings"
import { parsePath } from "../../engine/router"
import { layerPageTitle } from "../../engine/selectors"
import { initialSettings, type UpdateState } from "../../engine/slices/settings"
import { createDemoStore } from "../../engine/store"
import type { LayerNumber } from "../../engine/types"
import { DEMO_WORLD } from "../../engine/world"
import {
  aliasDirty,
  aliasValue,
  essentialRows,
  formatWhen,
  keyBars,
  lanAnnouncement,
  lanNote,
  layerAsk,
  layerLinks,
  layerPoints,
  layerStatusRows,
  layerTitle,
  restartConfirmText,
  selectLayerInputs,
  showsFailSwitch,
  updateArrived,
  updateLogLines,
  updateRows,
  updateSentence,
  updateSteps,
} from "./model"

const LAYERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const satisfies readonly LayerNumber[]
const newStore = () => createDemoStore(DEMO_WORLD, { router: "memory", driver: null })
const update = (patch: Partial<UpdateState>): UpdateState => ({ ...initialSettings().update, ...patch })

/** Every string in a nested copy object (functions called with sample arguments). */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown
    return strings(fn("sample", "sample", "sample"))
  }
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === "object") return Object.values(value).flatMap(strings)
  return []
}

describe("essentials", () => {
  it("lists the five rows in the real order", () => {
    expect(essentialRows().map((r) => r.id)).toEqual(["alias", "mode", "backup", "restart", "updates"])
    expect(essentialRows().map((r) => r.label)).toEqual(["Node name", "View mode", "Identity backup", "Restart node", "Check for updates"])
    expect(essentialRows()).not.toBe(essentialRows())
  })

  it("says the identity works with no backup, done from the node itself, with no word count or command", () => {
    const backup = essentialRows().find((r) => r.id === "backup")
    expect(backup?.help).toContain("works with no backup")
    expect(backup?.help).toContain("Back up any time from the node itself.")
    expect(backup?.note).toBe("The dashboard never shows or sends your keys.")
  })

  it("saves a trimmed name, or the name the node came with when empty", () => {
    expect(aliasValue("  Bench node  ", "Workshop laptop")).toBe("Bench node")
    expect(aliasValue("   ", "Workshop laptop")).toBe("Workshop laptop")
    expect(aliasDirty(null, "Workshop laptop", "Workshop laptop")).toBe(false)
    expect(aliasDirty("Workshop laptop ", "Workshop laptop", "Workshop laptop")).toBe(false)
    expect(aliasDirty("", "Workshop laptop", "Workshop laptop")).toBe(false)
    expect(aliasDirty("", "Bench node", "Workshop laptop")).toBe(true)
    expect(aliasDirty("Bench", "Workshop laptop", "Workshop laptop")).toBe(true)
  })

  it("names the node in the restart confirm, cut to 40 characters", () => {
    expect(restartConfirmText("Workshop laptop")).toBe("Restart Workshop laptop")
    expect(restartConfirmText("   ")).toBe("Restart this node")
    expect(restartConfirmText("x".repeat(64))).toBe(`Restart ${"x".repeat(40)}`)
  })

  it("notes a sharing change until a restart applies it", () => {
    expect(lanNote({ enabled: false, bound: false })).toBeNull()
    expect(lanNote({ enabled: true, bound: false })).toBe("Sharing on. Restart the node to apply.")
    expect(lanNote({ enabled: false, bound: true })).toBe("Sharing off. Restart the node to apply.")
    expect(lanAnnouncement({ enabled: true, bound: true })).toBe("Sharing on.")
    expect(lanAnnouncement({ enabled: true, bound: false })).toBe("Sharing on. Restart the node to apply.")
  })
})

describe("update block", () => {
  it("formats virtual time by hand", () => {
    expect(formatWhen(null)).toBe("never")
    expect(formatWhen(0)).toBe("17 Oct, 09:00")
  })

  it("lists state, running version, last check and result; the source once a newer version came", () => {
    expect(updateRows(update({})).map((r) => r.label)).toEqual(["State", "Running", "Last check", "Last result"])
    const rows = updateRows(update({ phase: "staged", source: "hub" }))
    expect(rows.map((r) => r.value)).toContain("downloaded, signature checked")
    expect(rows.at(-1)).toEqual({ label: "Comes from", value: "your home hub, over Wi-Fi" })
    // A version is named in words, never as a number.
    for (const r of updateRows(update({ onNewer: true, source: "internet" }))) {
      if (r.label === "Running") expect(r.value).toBe("the newer version")
    }
  })

  it("draws the four steps for every phase and result", () => {
    const shape = (u: Partial<UpdateState>) => updateSteps(update(u)).map((s) => s.state)
    expect(updateSteps(update({})).map((s) => s.id)).toEqual(["check", "verify", "trial", "result"])
    expect(shape({ phase: "checking" })).toEqual(["current", "pending", "pending", "pending"])
    expect(shape({ phase: "staged" })).toEqual(["done", "current", "pending", "pending"])
    expect(shape({ phase: "probation" })).toEqual(["done", "done", "current", "pending"])
    expect(shape({ phase: "reverting" })).toEqual(["done", "done", "failed", "current"])
    expect(shape({ phase: "idle", lastResult: "updated" })).toEqual(["done", "done", "done", "done"])
    expect(shape({ phase: "idle", lastResult: "rolled back" })).toEqual(["done", "done", "failed", "done"])
    expect(shape({ phase: "idle", lastResult: "up to date" })).toEqual(["done", "skipped", "skipped", "done"])
    expect(shape({ phase: "idle", lastResult: null })).toEqual(["pending", "pending", "pending", "pending"])
    expect(updateSteps(update({ lastResult: "updated" })).at(-1)?.word).toBe("healthy")
    expect(updateSteps(update({ lastResult: "rolled back" })).at(-1)?.word).toBe("rolled back")
  })

  it("says what is happening in one sentence", () => {
    const S = SETTINGS_COPY.update.status
    expect(updateSentence(update({ phase: "checking" }))).toBe(S.checking)
    expect(updateSentence(update({ phase: "staged", source: "hub" }))).toBe(S.staged("your home hub, over Wi-Fi"))
    expect(updateSentence(update({ phase: "probation" }))).toBe(S.probation)
    expect(updateSentence(update({ phase: "reverting" }))).toBe(S.reverting)
    expect(updateSentence(update({ lastResult: "rolled back" }))).toBe(S["rolled back"])
    expect(updateSentence(update({ lastResult: null }))).toBe(S.idle)
  })

  it("marks a newer version as an incoming demo item only once one arrived in this session", () => {
    expect(updateArrived(update({}))).toBe(false)
    expect(updateArrived(update({ run: 1, source: null }))).toBe(false)
    expect(updateArrived(update({ run: 1, source: "hub" }))).toBe(true)
    expect(showsFailSwitch(update({ onNewer: false }))).toBe(true)
    expect(showsFailSwitch(update({ onNewer: true }))).toBe(false)
  })

  it("prints the log as clock + text lines", () => {
    expect(updateLogLines(update({ log: [{ seq: 1, at: 5000, text: "checking" }] }))).toEqual(["09:00:05  checking"])
  })
})

describe("layer pages", () => {
  it("uses the plain titles and the real descriptions", () => {
    expect(LAYERS.map(layerTitle)).toEqual(LAYER_PAGES.map((l) => l.title))
    expect(layerTitle(1)).toBe("Install & updates")
    expect(layerTitle(2)).toBe("Identity")
    for (const n of LAYERS) expect(layerPoints(n).length).toBeGreaterThanOrEqual(2)
  })

  it("gives every layer status rows from the store, at the opening and after the radio and internet", () => {
    const store = newStore()
    const at = () => selectLayerInputs(store.getSnapshot(), DEMO_WORLD)
    for (const n of LAYERS) expect(layerStatusRows(n, at(), DEMO_WORLD).length).toBeGreaterThan(0)
    const l6 = layerStatusRows(6, at(), DEMO_WORLD)
    expect(l6.find((r) => r.label === "Transport")?.value).toBe("alone on the mesh: no preferred network in range")
    expect(l6.filter((r) => r.state).map((r) => r.label)).toEqual(["Mesh link", "Long-range radio", "Bridge"])
    expect(layerStatusRows(7, at(), DEMO_WORLD).find((r) => r.label === "Nearby nodes heard")?.value).toBe("none yet")

    store.dispatch({ type: "core/radioPlugged" })
    store.dispatch({ type: "core/radioAllowed", instant: true })
    store.dispatch({ type: "core/radioFlash", instant: true })
    store.dispatch({ type: "core/radioRegionSet", region: DEMO_WORLD.regions[0], instant: true })
    store.scheduler.runUntilIdle()
    const joined = layerStatusRows(6, at(), DEMO_WORLD).find((r) => r.label === "Transport")?.value
    expect(joined).toMatch(/^joined /)
    expect(layerStatusRows(7, at(), DEMO_WORLD).find((r) => r.label === "Heartbeats")?.value).toBe("running")
  })

  it("shows the grouped label (a–z, 2–7) with a copy button on Identity", () => {
    const rows = layerStatusRows(2, selectLayerInputs(newStore().getSnapshot(), DEMO_WORLD), DEMO_WORLD)
    const label = rows.find((r) => r.label === "Node label")
    expect(label?.value).toBe(DEMO_WORLD.self.label)
    expect(label?.copy).toBe(DEMO_WORLD.self.label)
    expect(isGroupedLabel(DEMO_WORLD.self.label)).toBe(true)
    expect(DEMO_WORLD.self.label).toMatch(/^[a-z2-7-]+$/)
  })

  it("follows the renamed node and the sharing choice", () => {
    const store = newStore()
    store.dispatch({ type: "core/renameNode", alias: "Bench node" })
    store.dispatch({ type: "settings/setLan", enabled: true })
    const at = () => selectLayerInputs(store.getSnapshot(), DEMO_WORLD)
    expect(layerStatusRows(2, at(), DEMO_WORLD).find((r) => r.label === "Node name")?.value).toBe("Bench node")
    expect(layerStatusRows(4, at(), DEMO_WORLD).find((r) => r.label === "Shared on this network")?.value).toBe("on after a restart")
    store.dispatch({ type: "settings/restart", instant: true })
    expect(layerStatusRows(4, at(), DEMO_WORLD).find((r) => r.label === "Open on")?.value).toBe("this laptop and devices on its Wi-Fi")
  })

  it("links only to real in-demo routes", () => {
    for (const n of LAYERS) {
      const links = layerLinks(n)
      expect(links.length).toBeGreaterThan(0)
      expect(new Set(links.map((l) => l.key)).size).toBe(links.length)
      for (const l of links) expect(parsePath(l.to).view).not.toBe("not-found")
    }
  })

  it("prepares a question for the Agent, from the layer page", () => {
    for (const n of LAYERS) {
      const ask = layerAsk(n)
      expect(ask.from).toBe(layerPageTitle(n))
      expect(ask.text).toContain(`Layer ${n}`)
      expect(ask.text).toContain(layerTitle(n))
    }
  })

  it("puts the prepared question in the composer without sending it", () => {
    const store = newStore()
    store.dispatch({ type: "core/navigate", path: "/settings/l2" })
    store.dispatch({ type: "core/agentPrefill", ...layerAsk(2) })
    const core = store.getSnapshot().core
    expect(core.route?.view).toBe("agent")
    expect(core.prefill?.text).toBe(layerAsk(2).text)
    expect(core.prefill?.from).toBe("L2 · Identity")
  })
})

describe("identity card", () => {
  it("draws the public half as a deterministic strip of bars", () => {
    const a = keyBars(DEMO_WORLD.self.label)
    expect(a).toEqual(keyBars(DEMO_WORLD.self.label))
    expect(a).toHaveLength(22)
    expect(keyBars("other")).not.toEqual(a)
    for (const b of a) {
      expect(b.width).toBeGreaterThanOrEqual(1)
      expect(b.width).toBeLessThanOrEqual(4)
      expect(b.gap).toBeGreaterThanOrEqual(1)
      expect(b.gap).toBeLessThanOrEqual(3)
    }
  })
})

describe("settings copy (plan §6.8, W3)", () => {
  const all = strings(SETTINGS_COPY)

  it("has no CLI string, no .local hostname, no recovery-word count and no pair code", () => {
    for (const s of all) {
      expect({ s, cli: /\b111 [a-z]/.test(s) }).toEqual({ s, cli: false })
      expect({ s, host: /\.local\b/.test(s) }).toEqual({ s, host: false })
      expect({ s, words: /\b\d+\s+(recovery\s+)?words\b/i.test(s) }).toEqual({ s, words: false })
      expect({ s, pair: /pair(ing)? code|enrol/i.test(s) }).toEqual({ s, pair: false })
    }
  })

  it("never marks a layer as coming or planned (W4)", () => {
    for (const s of all) expect({ s, mark: /\b(coming|planned|not built)\b/i.test(s) }).toEqual({ s, mark: false })
  })

  it("never prints a version number", () => {
    for (const s of all) expect({ s, version: /\bv?\d+\.\d+(\.\d+)?\b/i.test(s) }).toEqual({ s, version: false })
  })
})
