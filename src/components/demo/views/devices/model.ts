// Pure display logic of the Devices views, in plain words (real os/4-interface/ui/src/lib/devices.ts
// and views/devices/flash-model.ts, minus everything API-specific). No React: unit-tested in node.
// The confirmation rules themselves (nameMatches, confirmMissing, confirmValid) live with the slice
// that enforces them: engine/slices/devices.ts.
import { DEVICES_COPY } from "../../copy/devices"
import { formatDuration, SEC } from "../../engine/clock"
import { PATHS } from "../../engine/router"
import type { DemoDeviceState } from "../../engine/selectors"
import type { FlashMissing } from "../../engine/slices/devices"
import type { RadioStage } from "../../engine/types"
import type { OwnFacts } from "../../engine/world"

/** The id segment of the Add device page: "/devices/add", as in the real router. */
export const ADD_DEVICE_ID = "add"

export const ADD_DEVICE_PATH = PATHS.device(ADD_DEVICE_ID)

// ------------------------------------------------------------------------ the board's setup steps

/**
 * What the board's setup panel shows (one step at a time, real FlashPanelView `step`):
 *   consent      plugged in: "Allow once?" (Allow once / Not now)
 *   declined     "Not now" was pressed: nothing talks to the board
 *   identifying  the consented one-time identify is running
 *   offer        identified, no usable firmware: what would be written, and the flash button
 *   confirm      the inline confirmation (two boxes and the typed device name)
 *   flashing     writing firmware
 *   region       flashed: pick the region before it transmits
 *   ready        region set: the Long-range radio service starts, then listens
 */
export type BoardStep = "consent" | "declined" | "identifying" | "offer" | "confirm" | "flashing" | "region" | "ready"

export function boardStep(stage: RadioStage, ui: { consentDeclined: boolean; flashOpen: boolean }): BoardStep {
  switch (stage) {
    case "plugged":
      return ui.consentDeclined ? "declined" : "consent"
    case "identifying":
      return "identifying"
    case "identified":
      return ui.flashOpen ? "confirm" : "offer"
    case "flashing":
      return "flashing"
    case "flashed":
      return "region"
    case "ready":
      return "ready"
  }
}

/**
 * The list page's prompt for a board that was just plugged in, right where "[DEMO] plug in a radio
 * board" was pressed: the one-time consent, then a pointer to the board's own page (the firmware
 * offer, the flash and the region happen there). From flashing on the row's reason says enough.
 */
export type ListPrompt = "none" | "consent" | "declined" | "identifying" | "identified"

export function listPrompt(stage: RadioStage | null, consentDeclined: boolean): ListPrompt {
  switch (stage) {
    case "plugged":
      return consentDeclined ? "declined" : "consent"
    case "identifying":
      return "identifying"
    case "identified":
      return "identified"
    default:
      return "none"
  }
}

/** One sentence: why "Flash now" does nothing yet (real missingText). Empty when it will work. */
export function missingText(missing: readonly FlashMissing[]): string {
  if (missing.length === 0) return ""
  const m = DEVICES_COPY.flash.missing
  const parts: string[] = []
  const boxes = missing.filter((x) => x !== "name").length
  if (boxes === 2) parts.push(m.both)
  else if (missing.includes("erase")) parts.push(m.first)
  else if (missing.includes("own")) parts.push(m.second)
  if (missing.includes("name")) parts.push(m.name)
  return `${m.lead} ${parts.join(` ${m.and} `)}.`
}

// ------------------------------------------------------------------------------- facts, in words

/** Before the consented identify, a board is only "likely" (how it plugged in names the chip, not the board). */
export function isLikely(stage: RadioStage): boolean {
  return stage === "plugged" || stage === "identifying"
}

/** The NEEDS FIRMWARE tag: while the node offers firmware for the board (real needsFirmware). */
export function needsFirmware(stage: RadioStage): boolean {
  return stage === "identified" || stage === "flashing"
}

export function confidenceText(stage: RadioStage): string {
  const c = DEVICES_COPY.detail.confidence
  return isLikely(stage) ? c.likely : c.identified
}

/** The firmware row (real firmwareText, with no family names and no versions). */
export function firmwareText(stage: RadioStage): string {
  const f = DEVICES_COPY.detail.firmware
  switch (stage) {
    case "plugged":
      return f.unknown
    case "identifying":
      return f.checking
    case "identified":
      return f.none
    case "flashing":
      return f.writing
    default:
      return f.mesh
  }
}

/** What drives the board right now (real drivenBy): nothing until its region is set. */
export function drivenByText(stage: RadioStage): string {
  const d = DEVICES_COPY.detail.driven
  return stage === "ready" ? d.radio : d.none
}

/** The region only means something once firmware is on the board. */
export function showsRegion(stage: RadioStage): boolean {
  return stage === "flashed" || stage === "ready"
}

/** "for a few seconds", "for 45 s", "for 3 min" (real presenceText for a present device). */
export function presenceText(since: number, now: number): string {
  const ms = Math.max(0, now - since)
  return DEVICES_COPY.detail.presence(ms < 10 * SEC ? DEVICES_COPY.detail.fewSeconds : formatDuration(ms))
}

/**
 * What to store as the alias for the text in the rename field (real aliasFromDraft): empty, or the
 * detected name itself, clears it (null). Anything else is the trimmed text.
 */
export function aliasFromDraft(draft: string, detected: string): string | null {
  const t = draft.trim()
  return t === "" || t === detected ? null : t
}

// ----------------------------------------------------------------------------- the agent hand-off

export interface DeviceAgentAction {
  goal: "setup" | "fix" | "check"
  label: string
  /** The prepared prompt: shown in the Agent's composer, never sent by itself. */
  prompt: string
}

/** An error is fixed, a board that needs setup is set up, anything else is asked about (real deviceAgentAction). */
export function deviceAgentAction(state: DemoDeviceState, name: string): DeviceAgentAction {
  const d = DEVICES_COPY.detail
  if (state === "error") return { goal: "fix", label: d.agentLabel.setup, prompt: d.fixPrompt(name) }
  if (state === "needs setup") return { goal: "setup", label: d.agentLabel.setup, prompt: d.setupPrompt(name) }
  return { goal: "check", label: d.agentLabel.check, prompt: d.checkPrompt(name) }
}

// ------------------------------------------------------------------------------- this laptop

/**
 * The Bridge row of this laptop: the bootstrap rule (plan §6.8). It "also bridges radio and Wi-Fi"
 * ONLY when `bridges` (core: a live radio plus Wi-Fi that can host a hotspot, or ethernet); otherwise
 * it says what is missing, and never claims the bridge.
 */
export function ownBridgeText(bridges: boolean, facts: Pick<OwnFacts, "hotspot" | "ethernet">, hasRadio: boolean): string {
  const o = DEVICES_COPY.own
  if (!facts.hotspot && !facts.ethernet) return o.noLink
  if (bridges) return o.bridges(facts.hotspot ? o.whyHotspot : o.whyEthernet)
  return hasRadio ? o.notYetSetup : o.notYetNoRadio
}
