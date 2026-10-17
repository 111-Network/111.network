import type { LayerNumber } from "@/lib/layers"

// The six devices, in plain words only (W5). Which layers each one runs is
// transcribed from the os/README.md "Layer ↔ Device Category Mapping" table
// through an INTERNAL device → category map. Category names and codes are
// never exported and never shown.

/** Stable device ids, in chip order. */
export const DEVICE_IDS = [
  "old-phone",
  "laptop",
  "radio-box",
  "home-server",
  "gpu-pc",
  "radio-relay",
] as const

/** One of the six device ids. */
export type DeviceId = (typeof DEVICE_IDS)[number]

/** How a device takes part in one layer: runs it, partly (or via a nearby node), or not at all. */
export type LayerSupport = "runs" | "partly" | "none"

/** A device as shown on the page. */
export interface Device {
  id: DeviceId
  /** Plain-word chip label, e.g. "small box with a radio". */
  label: string
  /** One or two plain sentences for the terminal `devices` command. */
  blurb: string
  /** Support for layers 0..9, indexed by layer number (length 10). */
  support: readonly LayerSupport[]
}

/** The device every page-level choice starts on. */
export const DEFAULT_DEVICE: DeviceId = "laptop"

/** Plain words for each support level (legend of the L1 strip). */
export const SUPPORT_LABELS: Readonly<Record<LayerSupport, string>> = {
  runs: "runs",
  partly: "partly, or via a nearby node",
  none: "not run",
}

// ---- internal: never exported -------------------------------------------

type CategoryCode = "1" | "2A" | "2B" | "3" | "4A" | "4B"

const CATEGORY_OF: Readonly<Record<DeviceId, CategoryCode>> = {
  "old-phone": "2A",
  laptop: "2B",
  "radio-box": "3",
  "home-server": "4A",
  "gpu-pc": "4B",
  "radio-relay": "1",
}

// One string per category, layers 0..9, glyphs as in the README table:
// ✓ runs natively · ◐ partial or delegated to a nearby node · — not run.
//                        L0 1 2 3 4 5 6 7 8 9
const TABLE: Readonly<Record<CategoryCode, string>> = {
  "1": /*  */ "—✓✓——◐—✓——",
  "2A": /* */ "◐✓✓◐✓✓—✓◐◐",
  "2B": /* */ "✓✓✓✓✓✓—✓✓✓",
  "3": /*  */ "◐✓✓◐◐✓✓✓◐◐",
  "4A": /* */ "✓✓✓◐✓✓✓✓✓✓",
  "4B": /* */ "✓✓✓✓✓✓✓✓✓✓",
}

const GLYPH: Readonly<Record<string, LayerSupport>> = {
  "✓": "runs",
  "◐": "partly",
  "—": "none",
}

function supportFor(code: CategoryCode): readonly LayerSupport[] {
  return Array.from(TABLE[code], (glyph) => GLYPH[glyph] ?? "none")
}

const COPY: Readonly<Record<DeviceId, { label: string; blurb: string }>> = {
  "old-phone": {
    label: "old phone",
    blurb:
      "Set up over USB-C from a computer. Runs the chat and its own dashboard, and borrows a nearby hub for the local AI and the heavy lifting.",
  },
  laptop: {
    label: "laptop",
    blurb:
      "Runs its own local AI, the dashboard and a full encrypted store. Can become a gateway while it has internet.",
  },
  "radio-box": {
    label: "small box with a radio",
    blurb:
      "Has a radio plus Wi-Fi that can host a hotspot (or a network cable), so it also bridges radio and Wi-Fi. Borrows a nearby hub for the local AI.",
  },
  "home-server": {
    label: "home server",
    blurb:
      "Stays on and keeps the big shared libraries: offline maps, encyclopedias, updates. Serves the dashboard to small devices nearby and runs a small local AI, asking a bigger hub for heavy work.",
  },
  "gpu-pc": {
    label: "PC with a graphics card",
    blurb:
      "Runs every layer, including a big local AI that it lends to lighter devices nearby.",
  },
  "radio-relay": {
    label: "radio relay",
    blurb:
      "No screen and no AI. It only repeats sealed messages to stretch the range, and cannot read them. Set up once from a nearby computer.",
  },
}

// ---- public --------------------------------------------------------------

/** The six devices, in chip order. */
export const DEVICES: readonly Device[] = DEVICE_IDS.map((id) => ({
  id,
  label: COPY[id].label,
  blurb: COPY[id].blurb,
  support: supportFor(CATEGORY_OF[id]),
}))

/** True when `value` is one of the six device ids. */
export function isDeviceId(value: unknown): value is DeviceId {
  return typeof value === "string" && (DEVICE_IDS as readonly string[]).includes(value)
}

/** The device for a known id. */
export function deviceById(id: DeviceId): Device {
  return DEVICES[DEVICE_IDS.indexOf(id)]
}

/** How `device` takes part in layer `n`. */
export function layerSupport(device: DeviceId, n: LayerNumber): LayerSupport {
  return deviceById(device).support[n]
}
