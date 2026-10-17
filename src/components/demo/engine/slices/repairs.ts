// Repairs slice (#/services/repairs, Layer 9; plan §5 L9, §6.4 Repairs, W13, §6.8). Owned by the
// Repairs view; nobody else edits it.
//
// One repair run at a time, every step caused by a click:
//   [DEMO] simulate a fault -> the target service goes ERROR ("fault")
//   -> diagnosing -> building -> testing in a sandbox (each step through the scheduler)
//   -> good fix: every check passes ("sandbox-passed") and the agent writes a proposal (core/proposalAdded,
//      from "repairs", target = the broken service) that waits for a person;
//      bad fix: one check fails ("sandbox-rejected"): nothing leaves the sandbox, the service stays ERROR
//   -> APPROVED HERE (core/proposalAccepted, from this page or the Agent view: the service goes STARTING -> LIVE)
//   -> PR UPSTREAM (machine) -> MAINTAINERS (the visitor's `next`) -> MERGED -> VIA GATEWAY -> NODE B RE-CHECKS
//      (machines) -> NODE B'S OWNER (the visitor) -> "fix-shared", and the fix joins the "fixes shared" log.
// A real node waits at a human gate for as long as it takes: nothing here auto-continues past
// HEAL_GATES' human or upstream stations (waitsForVisitor). Dismiss leaves the service in ERROR.
// With `instant` (reduced motion) every machine step lands in the same dispatch, so the views only
// ever see the next place a person decides.
import { HEAL_GATES, waitsForVisitor } from "@/lib/heal"
import { SERVICE_NOUN } from "../../copy/core"
import { REPAIRS_COPY } from "../../copy/repairs"
import type { CoreState } from "../core"
import { NO_NEEDS, type CauseId, type NeedItem, type ServiceId, type SliceCtx } from "../types"
import type { DemoAction } from "."

// ------------------------------------------------------------------------------------- model

/** The canned faults (copy/repairs.ts holds their words). */
export type FaultId = keyof typeof REPAIRS_COPY.faults

/** The three sandbox checks, in strip order. */
export type CheckId = keyof typeof REPAIRS_COPY.checks

/** Who wrote a log line (copy REPAIRS_COPY.log.who). */
export type LogWho = keyof typeof REPAIRS_COPY.log.who

export type FixKind = "good" | "bad"

/**
 * Where a run is. diagnosing / building / testing: the agent works (a scheduled step is pending).
 * ready: the good fix passed every check; its proposal waits for a person.
 * rejected: the bad fix failed a check; nothing left the sandbox.
 * dismissed: a person dismissed the proposal; the service stays broken.
 * approved: applied on this node; `passed` walks the gate rail.
 */
export type RepairPhase = "diagnosing" | "building" | "testing" | "ready" | "rejected" | "dismissed" | "approved"

/** The phases in which the agent is still working (a step is scheduled). */
export const WORKING_PHASES: readonly RepairPhase[] = ["diagnosing", "building", "testing"]

export interface FaultSpec {
  /** The service the fault breaks. */
  service: ServiceId
  /** Which check the careless fix fails in the sandbox. */
  failsAt: Exclude<CheckId, "sandbox">
}

/** Each fault's service and the check its bad fix fails (the words are in copy/repairs.ts). */
export const FAULT_SPEC: Readonly<Record<FaultId, FaultSpec>> = {
  outbox: { service: "messaging", failsAt: "others" },
  links: { service: "mesh", failsAt: "replay" },
  store: { service: "storage", failsAt: "others" },
}

/** "[DEMO] simulate a fault" walks this list, skipping parts that are not running. */
export const FAULT_ORDER: readonly FaultId[] = ["outbox", "links", "store"]

/** Gate rail stations (HEAL_GATES): RAIL_LENGTH passed = the fix is shared. */
export const RAIL_LENGTH = HEAL_GATES.length

export interface RepairRun {
  /** Run number (1, 2, …): stale scheduled steps of an older run are ignored. */
  n: number
  fault: FaultId
  target: ServiceId
  fix: FixKind
  phase: RepairPhase
  /** The open or decided proposal of the tested good fix; null until it is written. */
  proposalId: string | null
  /** Gate stations passed, 0..RAIL_LENGTH (only moves in "approved"). */
  passed: number
  startedAt: number
  /** Reduced motion at the latest visitor action: the machine steps it set off land at once. */
  instant: boolean
}

export interface RepairLogEntry {
  seq: number
  at: number
  who: LogWho
  text: string
}

/** One entry of the "fixes shared" log. */
export interface SharedFix {
  id: string
  fault: FaultId
  at: number
}

export interface RepairsState {
  /** Runs started so far. */
  runs: number
  /** Proposals written so far (ids "repairs-fix-1", …). */
  proposals: number
  logSeq: number
  /** Index into FAULT_ORDER of the next fault to try. */
  nextFault: number
  run: RepairRun | null
  /** The repair log, oldest first, at most LOG_LIMIT lines. */
  log: readonly RepairLogEntry[]
  shared: readonly SharedFix[]
  /** When a part was last repaired on this node (virtual ms). */
  repaired: Readonly<Partial<Record<ServiceId, number>>>
}

export type RepairsAction =
  | { type: "repairs/simulate"; instant?: boolean }
  /** The agent's next step of run `run` (scheduled). */
  | { type: "repairs/step"; run: number }
  | { type: "repairs/badFix"; instant?: boolean }
  | { type: "repairs/properFix"; instant?: boolean }
  | { type: "repairs/retry"; instant?: boolean }
  /** A person passes station `index` (0: approve here, via core/proposalAccepted; 2: maintainers; 6: node B's owner). */
  | { type: "repairs/passGate"; index: number; instant?: boolean }
  /** A machine station of run `run` passes (scheduled). */
  | { type: "repairs/gateStep"; run: number }

/** Virtual durations of the timed steps (ms). */
export const REPAIRS_TIMING = {
  diagnoseMs: 1600,
  buildMs: 1600,
  testMs: 2000,
  /** One machine station of the gate rail. */
  gateMs: 1400,
} as const

export const LOG_LIMIT = 80

const STEP_KEY = "repairs:step"
const GATE_KEY = "repairs:gate"

/** Who passes each station, for the log (HEAL_GATES order). */
const STATION_WHO: readonly LogWho[] = ["you", "agent", "maintainers", "maintainers", "gateway", "node-b-agent", "node-b-owner"]

/** The event of each station (HEAL_GATES order). */
const STATION_CAUSE: readonly CauseId[] = [
  "fix-applied",
  "repairs/upstream",
  "repairs/reviewed",
  "repairs/merged",
  "repairs/gateway",
  "repairs/rechecked",
  "fix-shared",
]

const C = REPAIRS_COPY

export const proposalIdOf = (n: number): string => `repairs-fix-${n}`

export function initialRepairs(): RepairsState {
  return { runs: 0, proposals: 0, logSeq: 0, nextFault: 0, run: null, log: [], shared: [], repaired: {} }
}

// ----------------------------------------------------------------------------------- queries

const serviceState = (core: Pick<CoreState, "services">, id: ServiceId) => core.services.find((s) => s.id === id)?.state

/** The fault "[DEMO] simulate a fault" breaks next: the first in rotation whose part is running, or null. */
export function nextFaultId(state: Pick<RepairsState, "nextFault">, core: Pick<CoreState, "services">): FaultId | null {
  for (let i = 0; i < FAULT_ORDER.length; i++) {
    const id = FAULT_ORDER[(state.nextFault + i) % FAULT_ORDER.length]
    if (serviceState(core, FAULT_SPEC[id].service) === "live") return id
  }
  return null
}

/** The agent is still working on the run (a step is pending). */
export const isWorking = (run: RepairRun | null): boolean => run !== null && WORKING_PHASES.includes(run.phase)

/** The fix went all the way down the rail. */
export const isShared = (run: RepairRun | null): boolean => run !== null && run.phase === "approved" && run.passed >= RAIL_LENGTH

/**
 * The run still holds the agent: working, waiting for a person on the rail, or broken and waiting
 * for a person's next choice (dismissed / rejected / ready). A run whose part was mended some other
 * way while it waited no longer holds it.
 */
export function runOpen(run: RepairRun | null, core: Pick<CoreState, "services">): boolean {
  if (run === null) return false
  if (run.phase === "approved") return run.passed < RAIL_LENGTH
  if (isWorking(run)) return true
  return serviceState(core, run.target) === "error"
}

/** Why "[DEMO] simulate a fault" works or waits. */
export type SimulateStatus = "ready" | "working" | "busy" | "notLive" | "nothingLive"

export function simulateStatus(state: RepairsState, core: Pick<CoreState, "services">): SimulateStatus {
  if (serviceState(core, "repairs") !== "live") return "notLive"
  if (isWorking(state.run)) return "working"
  if (runOpen(state.run, core)) return "busy"
  return nextFaultId(state, core) === null ? "nothingLive" : "ready"
}

/** "[DEMO] try a bad fix" works until the fix is applied, while the fix is the real one. */
export const canTryBadFix = (run: RepairRun | null): boolean =>
  run !== null && run.fix === "good" && (isWorking(run) || run.phase === "ready")

/** Dismiss works while the tested fix waits for approval. */
export const canDismiss = (run: RepairRun | null): boolean => run !== null && run.phase === "ready" && run.proposalId !== null

/** Station `index` waits for a person right now, and its button works. */
export function canPassGate(run: RepairRun | null, index: number): boolean {
  if (run === null || !waitsForVisitor(index)) return false
  if (index === 0) return canDismiss(run)
  return run.phase === "approved" && run.passed === index
}

export function needsRepairs(): readonly NeedItem[] {
  // Core already lists the open proposal and the broken service; the later stations wait for other
  // people (the maintainers, node B's owner), never for this node's owner.
  return NO_NEEDS
}

// ----------------------------------------------------------------------------------- reducer

/** The next timed step: through the scheduler, or (instant) as a follow-up of this same dispatch. */
function later(ctx: SliceCtx, instant: boolean, ms: number, action: RepairsAction, key: string): void {
  if (instant) {
    ctx.cancel(key)
    ctx.dispatch(action)
  } else {
    ctx.schedule(ms, action, { key })
  }
}

function addLog(state: RepairsState, at: number, lines: readonly { who: LogWho; text: string }[]): RepairsState {
  if (lines.length === 0) return state
  let seq = state.logSeq
  const added = lines.map((l) => ({ seq: ++seq, at, who: l.who, text: l.text }))
  const log = [...state.log, ...added]
  return { ...state, logSeq: seq, log: log.length > LOG_LIMIT ? log.slice(log.length - LOG_LIMIT) : log }
}

/** The Repairs service's own reason (it stays LIVE; only its sentence follows the run). */
function repairsReason(ctx: SliceCtx, reason?: string): void {
  if (serviceState(ctx.core, "repairs") !== "live") return
  ctx.dispatch({ type: "core/serviceTransition", id: "repairs", to: "live", reason })
}

const nameOf = (ctx: SliceCtx, id: ServiceId): string => ctx.core.services.find((s) => s.id === id)?.name ?? id

function withRun(state: RepairsState, run: RepairRun): RepairsState {
  return { ...state, run }
}

/** Start diagnosing `fault` as run n. */
function startRun(state: RepairsState, ctx: SliceCtx, fault: FaultId, instant: boolean): RepairsState {
  const n = state.runs + 1
  const target = FAULT_SPEC[fault].service
  const run: RepairRun = { n, fault, target, fix: "good", phase: "diagnosing", proposalId: null, passed: 0, startedAt: ctx.now, instant }
  repairsReason(ctx, C.reasons.working(SERVICE_NOUN[target]))
  later(ctx, instant, REPAIRS_TIMING.diagnoseMs, { type: "repairs/step", run: n }, STEP_KEY)
  return { ...state, runs: n, run }
}

/** The agent's next step: diagnosing -> building -> testing -> ready | rejected. */
function agentStep(state: RepairsState, run: RepairRun, ctx: SliceCtx): RepairsState {
  const fault = C.faults[run.fault]
  const fix = run.fix === "good" ? fault.fix : fault.badFix
  if (run.phase === "diagnosing") {
    ctx.emit("diagnosed", { text: C.events.diagnosed(fault.diagnosis), ref: run.target })
    later(ctx, run.instant, REPAIRS_TIMING.buildMs, { type: "repairs/step", run: run.n }, STEP_KEY)
    const next = addLog(state, ctx.now, [{ who: "agent", text: C.log.diagnosis(fault.diagnosis) }])
    return withRun(next, { ...run, phase: "building" })
  }
  if (run.phase === "building") {
    const good = run.fix === "good"
    ctx.emit("repairs/built", { text: good ? C.events.built : C.events.builtBad, ref: run.target })
    later(ctx, run.instant, REPAIRS_TIMING.testMs, { type: "repairs/step", run: run.n }, STEP_KEY)
    const next = addLog(state, ctx.now, [{ who: "agent", text: good ? C.log.built(fix.summary) : C.log.builtBad(fix.summary) }])
    return withRun(next, { ...run, phase: "testing" })
  }
  // testing
  if (run.fix === "bad") {
    const failed = FAULT_SPEC[run.fault].failsAt
    ctx.emit("sandbox-rejected", { ref: run.target })
    repairsReason(ctx, C.reasons.rejected(SERVICE_NOUN[run.target]))
    const next = addLog(state, ctx.now, [
      { who: "sandbox", text: C.log.failed(C.checks[failed].failName, fault.badFix.failNote) },
      { who: "sandbox", text: C.log.rejected },
    ])
    return withRun(next, { ...run, phase: "rejected" })
  }
  const proposals = state.proposals + 1
  const id = proposalIdOf(proposals)
  ctx.emit("sandbox-passed", { text: C.events.passed, ref: run.target })
  ctx.dispatch({
    type: "core/proposalAdded",
    proposal: { id, kind: "fix", title: fault.title, body: C.proposalBody(fault), target: run.target, from: "repairs", cause: "sandbox-passed" },
  })
  repairsReason(ctx, C.reasons.waiting)
  const next = addLog({ ...state, proposals }, ctx.now, [
    { who: "sandbox", text: C.log.passed },
    { who: "agent", text: C.log.proposal },
  ])
  return withRun(next, { ...run, phase: "ready", proposalId: id })
}

/** Pass station `run.passed` (a person's click or a machine step) and plan the next machine one. */
function passStation(state: RepairsState, run: RepairRun, ctx: SliceCtx): RepairsState {
  const index = run.passed
  const passed = index + 1
  const fault = C.faults[run.fault]
  let next = addLog(state, ctx.now, [{ who: STATION_WHO[index], text: C.log.stations[index] }])
  const cause = STATION_CAUSE[index]
  if (index === 0) {
    const name = nameOf(ctx, run.target)
    const moving = serviceState(ctx.core, run.target) === "starting"
    ctx.emit(cause, { text: moving ? C.events.applied(name) : C.events.appliedOnly, ref: run.proposalId })
    repairsReason(ctx)
    next = { ...next, repaired: { ...next.repaired, [run.target]: ctx.now } }
  } else if (passed === RAIL_LENGTH) {
    ctx.emit(cause, { text: C.events.shared(fault.title), ref: run.proposalId })
    next = { ...next, shared: [...next.shared, { id: run.proposalId ?? proposalIdOf(run.n), fault: run.fault, at: ctx.now }] }
  } else {
    const text = [C.events.upstream, C.events.reviewed, C.events.merged, C.events.gateway, C.events.rechecked][index - 1]
    ctx.emit(cause, { text, ref: run.proposalId })
  }
  if (passed < RAIL_LENGTH && !waitsForVisitor(passed)) {
    later(ctx, run.instant, REPAIRS_TIMING.gateMs, { type: "repairs/gateStep", run: run.n }, GATE_KEY)
  }
  return withRun(next, { ...run, phase: "approved", passed })
}

export function reduceRepairs(state: RepairsState, action: DemoAction, ctx: SliceCtx): RepairsState {
  const run = state.run
  switch (action.type) {
    case "repairs/simulate": {
      if (simulateStatus(state, ctx.core) !== "ready") return state
      const fault = nextFaultId(state, ctx.core)
      if (fault === null) return state
      const copy = C.faults[fault]
      const target = FAULT_SPEC[fault].service
      ctx.dispatch({ type: "core/serviceTransition", id: target, to: "error", reason: copy.reason })
      ctx.emit("fault", { text: C.events.fault(nameOf(ctx, target), copy.symptom), ref: target })
      const nextFault = (FAULT_ORDER.indexOf(fault) + 1) % FAULT_ORDER.length
      const logged = addLog({ ...state, nextFault }, ctx.now, [{ who: "agent", text: C.log.noticed(copy.layerWord, copy.symptom) }])
      return startRun(logged, ctx, fault, action.instant === true)
    }

    case "repairs/step": {
      if (run === null || run.n !== action.run || !isWorking(run)) return state
      return agentStep(state, run, ctx)
    }

    case "repairs/badFix": {
      if (!canTryBadFix(run) || run === null) return state
      const instant = action.instant === true
      const lines: { who: LogWho; text: string }[] = [{ who: "you", text: C.log.askedBad }]
      if (run.phase === "ready" && run.proposalId !== null) {
        // The tested fix is set aside; its proposal closes (proposalId is cleared first, so this
        // slice does not read the follow-up as a person's dismissal).
        ctx.dispatch({ type: "core/proposalDismissed", id: run.proposalId })
        ctx.emit("repairs/withdrawn", { text: C.events.withdrawn, ref: run.target })
        lines.push({ who: "agent", text: C.log.withdrawn })
      }
      // Still diagnosing: the cause is the same, so only the fix it builds next changes.
      const phase: RepairPhase = run.phase === "diagnosing" ? "diagnosing" : "building"
      const ms = phase === "diagnosing" ? REPAIRS_TIMING.diagnoseMs : REPAIRS_TIMING.buildMs
      repairsReason(ctx, C.reasons.working(SERVICE_NOUN[run.target]))
      later(ctx, instant, ms, { type: "repairs/step", run: run.n }, STEP_KEY)
      return withRun(addLog(state, ctx.now, lines), { ...run, fix: "bad", phase, proposalId: null, instant })
    }

    case "repairs/properFix": {
      if (run === null || run.phase !== "rejected") return state
      const instant = action.instant === true
      ctx.emit("repairs/proper", { text: C.events.proper, ref: run.target })
      repairsReason(ctx, C.reasons.working(SERVICE_NOUN[run.target]))
      later(ctx, instant, REPAIRS_TIMING.buildMs, { type: "repairs/step", run: run.n }, STEP_KEY)
      return withRun(addLog(state, ctx.now, [{ who: "you", text: C.log.askedProper }]), { ...run, fix: "good", phase: "building", instant })
    }

    case "repairs/retry": {
      if (run === null || run.phase !== "dismissed" || serviceState(ctx.core, run.target) !== "error") return state
      ctx.emit("repairs/retried", { text: C.events.retried, ref: run.target })
      return startRun(addLog(state, ctx.now, [{ who: "you", text: C.log.retried }]), ctx, run.fault, action.instant === true)
    }

    case "repairs/passGate": {
      if (run === null || !canPassGate(run, action.index)) return state
      const instant = action.instant === true
      if (action.index === 0) {
        // Approving here is accepting the proposal: core moves the service, this slice follows it.
        if (run.proposalId !== null) ctx.dispatch({ type: "core/proposalAccepted", id: run.proposalId, instant })
        return run.instant === instant ? state : withRun(state, { ...run, instant })
      }
      return passStation(state, { ...run, instant }, ctx)
    }

    case "repairs/gateStep": {
      if (run === null || run.n !== action.run || run.phase !== "approved") return state
      if (run.passed >= RAIL_LENGTH || waitsForVisitor(run.passed)) return state
      return passStation(state, run, ctx)
    }

    case "core/proposalAccepted": {
      if (run === null || run.phase !== "ready" || run.proposalId !== action.id) return state
      // Core may refuse an accept (the target cannot start): then the proposal stays open.
      const decided = ctx.core.proposals.find((p) => p.id === action.id)?.decision
      if (decided?.decision !== "accepted") return state
      return passStation(state, { ...run, instant: action.instant === true }, ctx)
    }

    case "core/proposalDismissed": {
      if (run === null || run.phase !== "ready" || run.proposalId !== action.id) return state
      const word = C.faults[run.fault].layerWord
      repairsReason(ctx, C.reasons.dismissed(SERVICE_NOUN[run.target]))
      return withRun(addLog(state, ctx.now, [{ who: "you", text: C.log.dismissed(word) }]), { ...run, phase: "dismissed" })
    }

    default:
      return state
  }
}
