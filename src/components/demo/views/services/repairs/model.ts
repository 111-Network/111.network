// Pure helpers of the Repairs page (React-free; tested in model.test.ts). No real counterpart: the
// real dashboard has no Layer 9 view yet. The station rules follow src/lib/heal.ts (W13) and the
// home page's L9 bench (src/components/sections/layer-9/model.ts), so both pages tell one story.
import { HEAL_GATES, waitsForVisitor, type HealGate } from "@/lib/heal"
import { layerSupport } from "@/lib/devices"
import { formatClock } from "../../../engine/clock"
import { PATHS } from "../../../engine/router"
import { layerPageTitle } from "../../../engine/selectors"
import {
  FAULT_SPEC,
  isWorking,
  type CheckId,
  type RepairLogEntry,
  type RepairRun,
  type RepairsState,
  type SimulateStatus,
} from "../../../engine/slices/repairs"
import type { LayerNumber, ServiceId, ServiceState } from "../../../engine/types"
import type { DemoService, World } from "../../../engine/world"
import { REPAIRS_COPY } from "../../../copy/repairs"

const C = REPAIRS_COPY

// --------------------------------------------------------------------------------- health matrix

/** One watched part of a layer: a service of the registry, or a built-in part of the node. */
export interface MatrixPart {
  key: string
  name: string
  state: ServiceState
  /** The service page, or null for a built-in part. */
  href: string | null
  /** "repaired at 09:14", or null. */
  repaired: string | null
}

export interface MatrixRow {
  n: LayerNumber
  title: string
  parts: readonly MatrixPart[]
}

const LAYER_NUMBERS: readonly LayerNumber[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Layers without a service of their own are watched as part of the node (copy matrix.builtIn). */
const BUILT_IN: Readonly<Partial<Record<LayerNumber, string>>> = C.matrix.builtIn

/**
 * The health matrix: every layer this device runs, each with its watched parts. A layer counts when
 * this node runs a service on it (its hardware facts decide, so the laptop's mesh link and radio put
 * it on Layer 6), or when the device runs it as part of the node (src/lib/devices.ts) and it has no
 * service of its own.
 */
export function matrixRows(
  services: readonly DemoService[],
  world: World,
  repaired: Readonly<Partial<Record<ServiceId, number>>>,
): MatrixRow[] {
  const rows: MatrixRow[] = []
  for (const n of LAYER_NUMBERS) {
    const parts: MatrixPart[] = services
      .filter((s) => s.layer === n && s.canRunHere)
      .map((s) => {
        const at = repaired[s.id]
        return { key: s.id, name: s.name, state: s.state, href: PATHS.service(s.id), repaired: at === undefined ? null : C.matrix.repairedAt(formatClock(at)) }
      })
    const builtIn = BUILT_IN[n]
    if (parts.length === 0 && builtIn !== undefined && layerSupport(world.self.device, n) !== "none") {
      parts.push({ key: `node-${n}`, name: builtIn, state: "live", href: null, repaired: null })
    }
    if (parts.length > 0) rows.push({ n, title: layerPageTitle(n), parts })
  }
  return rows
}

/** "Messaging", "Messaging and Storage", "Messaging, Mesh link and Storage". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** The one line above the matrix. */
export function matrixSummary(rows: readonly MatrixRow[]): string {
  const parts = rows.flatMap((r) => r.parts)
  const broken = parts.filter((p) => p.state === "error").map((p) => p.name)
  if (broken.length > 0) return C.matrix.problem(joinNames(broken), broken.length === 1)
  const starting = parts.filter((p) => p.state === "starting").map((p) => p.name)
  if (starting.length > 0) return C.matrix.starting(joinNames(starting), starting.length === 1)
  return C.matrix.allWell
}

// --------------------------------------------------------------------------------- the run

export type StepState = keyof typeof REPAIRS_COPY.run.stepState

/** diagnose · build a fix · test in a sandbox. */
export function stepStates(run: RepairRun | null): readonly [StepState, StepState, StepState] {
  if (run === null) return ["waiting", "waiting", "waiting"]
  switch (run.phase) {
    case "diagnosing":
      return ["working", "waiting", "waiting"]
    case "building":
      return ["done", "working", "waiting"]
    case "testing":
      return ["done", "done", "working"]
    default:
      return ["done", "done", "done"]
  }
}

/** What the agent is doing right now, for the working step's line; null when it is not working. */
export function workingLine(run: RepairRun | null): string | null {
  if (run === null || !isWorking(run)) return null
  const lines = run.fix === "good" ? C.run.working : C.run.workingBad
  return lines[stepStates(run).indexOf("working")] ?? null
}

export type CheckState = keyof typeof REPAIRS_COPY.run.checkState

export const CHECK_IDS: readonly CheckId[] = ["sandbox", "replay", "others"]

/** The sandbox strip: waiting until the test ends; the bad fix fails its fault's check. */
export function checkStates(run: RepairRun | null): Readonly<Record<CheckId, CheckState>> {
  const tested = run !== null && !isWorking(run)
  if (!tested) return { sandbox: "waiting", replay: "waiting", others: "waiting" }
  if (run.phase === "rejected") {
    const failed = FAULT_SPEC[run.fault].failsAt
    return { sandbox: "pass", replay: failed === "replay" ? "fail" : "pass", others: failed === "others" ? "fail" : "pass" }
  }
  return { sandbox: "pass", replay: "pass", others: "pass" }
}

/** The words of one check in its state: "failure replayed: gone", "other layers: …", "failure replayed". */
export function checkText(run: RepairRun | null, id: CheckId, state: CheckState): string {
  const check = C.checks[id]
  if (state === "pass") return check.pass
  if (state === "fail" && run !== null) return `${check.failName}: ${C.faults[run.fault].badFix.failNote}`
  return check.failName
}

export type DiffOp = "add" | "remove" | "keep"

export interface PlainDiffLine {
  op: DiffOp
  text: string
}

/** The change in plain words; null while the agent is still finding the cause. */
export function runDiff(run: RepairRun | null): readonly PlainDiffLine[] | null {
  if (run === null || run.phase === "diagnosing") return null
  const fault = C.faults[run.fault]
  return run.fix === "good" ? fault.fix.diff : fault.badFix.diff
}

export type RunBadge = keyof typeof REPAIRS_COPY.run.badge

/** The pull request's state badge. */
export function runBadge(run: RepairRun): RunBadge {
  switch (run.phase) {
    case "diagnosing":
    case "building":
    case "testing":
      return "working"
    case "ready":
      return "ready"
    case "rejected":
      return "rejected"
    case "dismissed":
      return "dismissed"
    case "approved":
      if (run.passed >= 4) return "merged"
      if (run.passed >= 3) return "reviewed"
      if (run.passed >= 2) return "upstream"
      return "approved"
  }
}

/** The run's title: the proposal title of its fault. */
export const runTitle = (run: RepairRun): string => C.faults[run.fault].title

// --------------------------------------------------------------------------------- gate rail

export type StationState = "passed" | "waiting" | "arriving" | "idle"

/** Where station `index` is: passed, waiting for a person, about to pass by itself, or not reached. */
export function stationState(run: RepairRun | null, index: number): StationState {
  if (run === null) return "idle"
  if (run.phase === "ready") return index === 0 ? "waiting" : "idle"
  if (run.phase !== "approved") return "idle"
  if (index < run.passed) return "passed"
  if (index === run.passed) return waitsForVisitor(index) ? "waiting" : "arriving"
  return "idle"
}

/** The state line under a station. */
export function stationLine(gate: HealGate, state: StationState): string {
  const s = C.rail.state
  if (state === "passed") return s.passed
  if (state === "arriving") return s.arriving
  if (state === "idle") return s.idle
  if (gate.kind === "upstream") return s.waitingMaintainers
  return gate.id === "approved-here" ? s.waitingYou : s.waitingOwner
}

/** A key that changes whenever the rail's controls can change (focus moves on it). */
export function railKey(run: RepairRun | null): string {
  return run === null ? "none" : `${run.n}:${run.phase}:${run.passed}`
}

/** A key that changes whenever the run panel's controls can change. */
export function runKey(run: RepairRun | null): string {
  return run === null ? "none" : `${run.n}:${run.phase}:${run.fix}`
}

export const STATIONS = HEAL_GATES

// --------------------------------------------------------------------------------- logs and hints

/** The repair log as terminal lines: "09:12 agent: noticed: messaging: …". */
export function logLines(log: readonly RepairLogEntry[]): string[] {
  return log.map((l) => `${formatClock(l.at)} ${C.log.who[l.who]}: ${l.text}`)
}

/** The hint beside "[DEMO] simulate a fault". */
export function simulateHint(status: SimulateStatus, next: string | null): string {
  switch (status) {
    case "notLive":
      return C.simulateHint.notLive
    case "nothingLive":
      return C.simulateHint.nothingLive
    case "busy":
    case "working":
      return C.simulateHint.busy
    case "ready":
      return next === null ? C.simulateHint.nothingLive : C.simulateHint.ready(next)
  }
}

/** One "fixes shared" entry: its title and its line. */
export function sharedEntry(fix: RepairsState["shared"][number]): { title: string; line: string; at: string } {
  const fault = C.faults[fix.fault]
  return { title: fault.title, line: C.shared.entry(fault.layerWord), at: formatClock(fix.at) }
}
