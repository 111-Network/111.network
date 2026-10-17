import { describe, expect, it } from "vitest"
import { LAYERS, getLayer, isLayerNumber, layerById, layerByN, layerTitleId } from "@/lib/layers"

// Plan §6.6 deep links.
const DEMO_LINKS = [
  "/demo#/kb",
  "/demo#/settings/l1",
  "/demo#/settings/l2",
  "/demo#/",
  "/demo#/overview",
  "/demo#/messages",
  "/demo#/services/bridge",
  "/demo#/nearby",
  "/demo#/services/storage",
  "/demo#/services/repairs",
]

const TITLES = [
  "Knowledge",
  "Bootstrap",
  "Identity",
  "Local Intelligence",
  "Interface & Dashboard",
  "Messaging & Data",
  "Transport & Bridge",
  "Relay & Presence",
  "Storage & Shared State",
  "Self-Healing & Evolution",
]

const NAV = [
  "KNOWLEDGE",
  "BOOTSTRAP",
  "IDENTITY",
  "INTELLIGENCE",
  "DASHBOARD",
  "MESSAGING",
  "TRANSPORT",
  "RELAY",
  "STORAGE",
  "SELF-HEALING",
]

describe("layers", () => {
  it("has ten layers numbered 0..9 in order", () => {
    expect(LAYERS).toHaveLength(10)
    LAYERS.forEach((layer, i) => {
      expect(layer.n).toBe(i)
      expect(layer.id).toBe(`layer-${i}`)
      expect(layer.ghost).toBe(`0${i}`)
    })
  })

  it("has unique ids and slugs", () => {
    expect(new Set(LAYERS.map((l) => l.id)).size).toBe(10)
    expect(new Set(LAYERS.map((l) => l.slug)).size).toBe(10)
    for (const l of LAYERS) expect(l.slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it("uses the plan's titles and nav labels", () => {
    expect(LAYERS.map((l) => l.title)).toEqual(TITLES)
    expect(LAYERS.map((l) => l.navLabel)).toEqual(NAV)
  })

  it("has exactly four non-empty specs each, with unique labels", () => {
    for (const l of LAYERS) {
      expect(l.specs).toHaveLength(4)
      expect(new Set(l.specs.map((s) => s.label)).size).toBe(4)
      for (const s of l.specs) {
        expect(s.label.length).toBeGreaterThan(0)
        expect(s.value.length).toBeGreaterThan(0)
      }
    }
  })

  it("links each layer to its §6.6 demo view", () => {
    expect(LAYERS.map((l) => l.demoHref)).toEqual(DEMO_LINKS)
    for (const l of LAYERS) expect(l.demoHref).toBe(`/demo${l.demoHash}`)
  })

  it("keeps the W2 example names out of the data file", () => {
    const text = JSON.stringify(LAYERS)
    for (const name of ["Meshtastic", "MeshCore", "Reticulum"]) expect(text).not.toContain(name)
  })

  it("has subtitles and descriptions", () => {
    for (const l of LAYERS) {
      expect(l.subtitle.length).toBeGreaterThan(0)
      expect(l.subtitle.endsWith(".")).toBe(false)
      expect(l.description.length).toBeGreaterThan(80)
    }
  })

  it("looks layers up by number and id", () => {
    expect(getLayer(3).title).toBe("Local Intelligence")
    expect(layerByN(9)?.slug).toBe("self-healing-evolution")
    expect(layerByN(10)).toBeUndefined()
    expect(layerByN(-1)).toBeUndefined()
    expect(layerByN(1.5)).toBeUndefined()
    expect(layerById("layer-4")?.n).toBe(4)
    expect(layerById("#layer-7")?.n).toBe(7)
    expect(layerById("layer-12")).toBeUndefined()
    expect(isLayerNumber(0)).toBe(true)
    expect(isLayerNumber("0")).toBe(false)
    expect(layerTitleId(2)).toBe("layer-2-title")
  })
})
