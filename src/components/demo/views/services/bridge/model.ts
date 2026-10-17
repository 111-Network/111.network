// Pure logic of the Bridge page (React-free, tested in node). The bridge is not built in reality:
// the page is the intended Layer 6 surface (os/README.md "Transport & Bridge"), framed by the real
// service page (views/services/index.tsx) and using the real radio-board flash confirm
// (views/devices/flash-model.ts: two ticks plus the device's name typed exactly).
import { groupedLabel } from "@/lib/labels"
import { BRIDGE_COPY } from "../../../copy/bridge"
import { bridgeReadyOf, type CoreState, type RadioBoard } from "../../../engine/core"
import { sidesOf, type BridgeBand, type Crossing } from "../../../engine/slices/bridge"
import type { NetworkId, NetworkTry, RadioStage } from "../../../engine/types"
import type { World } from "../../../engine/world"

type Core = Pick<CoreState, "radio" | "services" | "transport">

// ------------------------------------------------------------------------------ page phases

/**
 * What the page is about right now (one value drives the actions and panels shown):
 *   needs-radio  no board: "[DEMO] plug in a radio board"
 *   radio-setup  a board is in, the radio is not running yet: the board's steps
 *   radio-down   a set-up board whose radio is not running (an error, a restart)
 *   needs-link   the radio runs, but there is no hotspot or ethernet beside it
 *   ready        the bootstrap rule holds: preferred networks, the diagram and the role toggle
 */
export type BridgePhase = "needs-radio" | "radio-setup" | "radio-down" | "needs-link" | "ready"

export function bridgePhase(core: Core, world: World): BridgePhase {
  if (core.radio === null) return "needs-radio"
  if (bridgeReadyOf(core, world)) return "ready"
  const radio = core.services.find((s) => s.id === "radio")
  if (radio?.state === "live") return "needs-link"
  return radioStep(core) !== null ? "radio-setup" : "radio-down"
}

// ------------------------------------------------------------------------- radio board steps

/** The board's step on this page: its stage, or "starting" once the region is set; null when set up (or none). */
export type RadioStep = Exclude<RadioStage, "ready"> | "starting"

export function radioStep(core: Pick<CoreState, "radio" | "services">): RadioStep | null {
  const board = core.radio
  if (!board) return null
  if (board.stage !== "ready") return board.stage
  const radio = core.services.find((s) => s.id === "radio")
  return radio?.state === "starting" || radio?.state === "unset" ? "starting" : null
}

/** Index of the step strip ("allow once", "identify", "write firmware", "pick a region") the board is on; 4 = all done. */
export function stepIndex(step: RadioStep): number {
  switch (step) {
    case "plugged":
      return 0
    case "identifying":
      return 1
    case "identified":
    case "flashing":
      return 2
    case "flashed":
      return 3
    case "starting":
      return 4
  }
}

export type StripState = "done" | "now" | "next"

/** The step strip under the board's panel title; with no board yet (null) every step is still to come. */
export function stepStrip(step: RadioStep | null): { label: string; state: StripState }[] {
  const at = step === null ? -1 : stepIndex(step)
  return BRIDGE_COPY.radio.steps.map((label, i) => ({ label, state: i < at ? "done" : i === at ? "now" : "next" }))
}

/** The steps that wait on the node, not on the person. */
export type BusyStep = Extract<RadioStep, "identifying" | "flashing" | "starting">

/** A step that is waiting on the node, not on the person (the panel shows a blinking cursor, no controls). */
export function stepBusy(step: RadioStep): step is BusyStep {
  return step === "identifying" || step === "flashing" || step === "starting"
}

/** The name the flash confirm asks for (core: `alias ?? name`). */
export function boardName(board: Pick<RadioBoard, "alias" | "name">): string {
  return board.alias ?? board.name
}

// -------------------------------------------------------------------- flash confirm (ported)

export type FlashCheckId = "erase" | "own"

export const FLASH_CHECKS: readonly { id: FlashCheckId; label: string }[] = [
  { id: "erase", label: BRIDGE_COPY.radio.checks.erase },
  { id: "own", label: BRIDGE_COPY.radio.checks.own },
]

export interface FlashConfirm {
  checks: Readonly<Record<FlashCheckId, boolean>>
  typed: string
}

export const EMPTY_CONFIRM: FlashConfirm = { checks: { erase: false, own: false }, typed: "" }

/** The typed name equals the shown name: both trimmed, case-sensitive, and not empty (real `nameMatches`). */
export function nameMatches(typed: string, name: string): boolean {
  const want = name.trim()
  return want !== "" && typed.trim() === want
}

export type FlashMissing = FlashCheckId | "name"

/** What is still missing, in form order; empty = complete (real `confirmMissing`). */
export function confirmMissing(c: FlashConfirm, name: string): FlashMissing[] {
  const out: FlashMissing[] = []
  for (const { id } of FLASH_CHECKS) if (!c.checks[id]) out.push(id)
  if (!nameMatches(c.typed, name)) out.push("name")
  return out
}

/** One sentence: why "Flash now" does nothing yet; "" when it will work (real `missingText`). */
export function missingText(missing: readonly FlashMissing[]): string {
  if (missing.length === 0) return ""
  const m = BRIDGE_COPY.radio.missing
  const parts: string[] = []
  const boxes = missing.filter((x) => x !== "name").length
  if (boxes === FLASH_CHECKS.length) parts.push(m.both)
  else if (missing.includes("erase")) parts.push(m.first)
  else if (missing.includes("own")) parts.push(m.second)
  if (missing.includes("name")) parts.push(m.name)
  return `${m.prefix} ${parts.join(" and ")}.`
}

// ------------------------------------------------------------- this laptop (bootstrap rule)

export interface FactRow {
  id: "radio" | "hotspot" | "ethernet" | "outcome"
  label: string
  value: string
  /** Filled square when met, hollow when not. */
  met: boolean
}

/** The bootstrap rule as rows: the radio, the hotspot, ethernet, and whether this laptop can bridge. */
export function factRows(core: Core, world: World): FactRow[] {
  const f = BRIDGE_COPY.facts
  const radio = core.services.find((s) => s.id === "radio")
  const radioLive = radio?.state === "live"
  const radioValue = !core.radio ? f.radioNone : radioLive ? f.radioRunning : radio?.state === "error" ? f.radioProblem : f.radioSetup
  const { hotspot, ethernet } = world.self.facts
  const ready = bridgeReadyOf(core, world)
  const outcome = ready ? (hotspot ? f.ready : f.readyEthernet) : radioLive ? f.needsLink : f.needsRadio
  return [
    { id: "radio", label: f.radio, value: radioValue, met: radioLive },
    { id: "hotspot", label: f.hotspot, value: hotspot ? f.yes : f.no, met: hotspot },
    { id: "ethernet", label: f.ethernet, value: ethernet ? f.yes : f.no, met: ethernet },
    { id: "outcome", label: f.outcome, value: outcome, met: ready },
  ]
}

// ---------------------------------------------------------------------- preferred networks

export interface LadderRow {
  id: NetworkId
  /** 1, 2, 3: the order the list is tried in. */
  rank: number
  name: string
  medium: string
  state: NetworkTry
  /** The state in words ("FOUND", "trying", "no signal", "not tried"). */
  word: string
}

/** The seek ladder, from core's transport (the preferred list in the order it is tried). */
export function ladderRows(core: Pick<CoreState, "transport">, world: World): LadderRow[] {
  return world.networks.map((n, i) => {
    const state = core.transport.tries[n.id]
    return { id: n.id, rank: i + 1, name: n.name, medium: n.mediumLabel, state, word: BRIDGE_COPY.networks.tries[state] }
  })
}

export type LadderOutcome = { kind: "joined"; network: string } | { kind: "seeking" } | { kind: "none" }

/** The priority box's output: first hit wins; none in range = messages wait on the device. */
export function ladderOutcome(core: Pick<CoreState, "transport">, world: World): LadderOutcome {
  const t = core.transport
  if (t.joined !== null) return { kind: "joined", network: world.networks.find((n) => n.id === t.joined)?.name ?? t.joined }
  return t.seeking ? { kind: "seeking" } : { kind: "none" }
}

export function outcomeText(o: LadderOutcome): string {
  const c = BRIDGE_COPY.networks
  return o.kind === "joined" ? c.joined(o.network) : o.kind === "seeking" ? c.seeking : c.none
}

// --------------------------------------------------------------------- the sample crossing

/** Where the sample message is drawn: on its side, at the bridge, then on the other side. */
export function packetBand(c: Crossing | null): BridgeBand | null {
  if (!c) return null
  const { from, to } = sidesOf(c.direction)
  return c.step === "in" ? from : c.step === "swap" ? "bridge" : to
}

/** The outer wrapper's words at this step. The payload is never part of it. */
export function wrapperText(c: Crossing): string {
  const { from, to } = sidesOf(c.direction)
  const d = BRIDGE_COPY.diagram
  return c.step === "in" ? d.wrapper(from) : c.step === "swap" ? d.wrapperSwap(from, to) : d.wrapper(to)
}

/** The caption under the diagram for this step. */
export function crossCaption(c: Crossing): string {
  const { from, to } = sidesOf(c.direction)
  const cap = BRIDGE_COPY.diagram.caption
  return c.step === "in" ? cap.in(from) : c.step === "swap" ? cap.swap(from, to) : cap.out(to)
}

/** The sample payload's label (a–z and 2–7 only): the same before and after the bridge, because the payload never changes. */
export function payloadLabel(world: Pick<World, "seed">, c: Pick<Crossing, "id">): string {
  return groupedLabel(`${world.seed}:bridge:${c.id}`)
}
