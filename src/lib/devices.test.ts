import { describe, expect, it } from "vitest"
import * as devicesModule from "@/lib/devices"
import { DEFAULT_DEVICE, DEVICES, DEVICE_IDS, SUPPORT_LABELS, deviceById, isDeviceId, layerSupport } from "@/lib/devices"

// Category codes and names from os/README.md that must never reach the page (W5).
const FORBIDDEN = [
  /\b(1|2A|2B|3|4A|4B|5|5A|5B)\b/i,
  /\bcat(egory)?\b/i,
  /ai-native/i,
  /light terminal/i,
  /edge relay/i,
  /transport bridge/i,
  /knowledge hub/i,
  /compute hub/i,
  /user terminal/i,
]

function exportedStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => exportedStrings(v, out))
  else if (value && typeof value === "object") Object.values(value).forEach((v) => exportedStrings(v, out))
  return out
}

describe("devices", () => {
  it("lists the six plain-word devices in chip order", () => {
    expect(DEVICES.map((d) => d.label)).toEqual([
      "old phone",
      "laptop",
      "small box with a radio",
      "home server",
      "PC with a graphics card",
      "radio relay",
    ])
    expect(DEVICES.map((d) => d.id)).toEqual([...DEVICE_IDS])
    expect(DEFAULT_DEVICE).toBe("laptop")
  })

  it("never exports a category code or category name", () => {
    const { DEVICE_IDS: ids, ...rest } = devicesModule
    // Ids are machine keys (they appear only in ?device=), but must also be code-free.
    const strings = [...exportedStrings(rest), ...ids]
    expect(strings.length).toBeGreaterThan(10)
    for (const s of strings) for (const re of FORBIDDEN) expect(s, `"${s}" matches ${re}`).not.toMatch(re)
    expect(Object.keys(devicesModule)).not.toContain("CATEGORY_OF")
    expect(Object.keys(devicesModule)).not.toContain("TABLE")
  })

  it("keeps the README table glyphs internal (Geist Mono lacks ✓ and ◐)", () => {
    const { DEVICE_IDS: ids, ...rest } = devicesModule
    for (const s of [...exportedStrings(rest), ...ids]) expect(s).not.toMatch(/[✓◐]/)
  })

  it("transcribes the README layer table", () => {
    const row = (id: (typeof DEVICE_IDS)[number]) => deviceById(id).support.join(",")
    const r = "runs"
    const p = "partly"
    const n = "none"
    expect(row("radio-relay")).toBe([n, r, r, n, n, p, n, r, n, n].join(","))
    expect(row("old-phone")).toBe([p, r, r, p, r, r, n, r, p, p].join(","))
    expect(row("laptop")).toBe([r, r, r, r, r, r, n, r, r, r].join(","))
    expect(row("radio-box")).toBe([p, r, r, p, p, r, r, r, p, p].join(","))
    expect(row("home-server")).toBe([r, r, r, p, r, r, r, r, r, r].join(","))
    expect(row("gpu-pc")).toBe([r, r, r, r, r, r, r, r, r, r].join(","))
    for (const d of DEVICES) expect(d.support).toHaveLength(10)
  })

  it("answers per-layer lookups", () => {
    expect(layerSupport("radio-relay", 3)).toBe("none")
    expect(layerSupport("old-phone", 3)).toBe("partly")
    expect(layerSupport("radio-box", 6)).toBe("runs")
    expect(SUPPORT_LABELS.partly).toContain("nearby")
  })

  it("validates ids", () => {
    expect(isDeviceId("old-phone")).toBe(true)
    expect(isDeviceId("toaster")).toBe(false)
    expect(isDeviceId(null)).toBe(false)
    expect(isDeviceId(3)).toBe(false)
  })

  it("has a plain blurb for every device", () => {
    for (const d of DEVICES) expect(d.blurb.length).toBeGreaterThan(30)
  })
})
