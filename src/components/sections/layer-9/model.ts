// Layer 9 · Self-Healing & Evolution: the pure state machine behind the
// "Pull Request Bench" + "Gate Rail" (plan §5 L9, W13, W14).
//
// - BREAK A LAYER starts one canned fault. The agent then works by itself:
//   diagnose → build a fix → test in a sandbox (one tick per step).
// - The fix leaves the sandbox only when every check passes, and only after the
//   node's owner clicks APPROVE ON THIS NODE. Machine stations of the gate rail
//   fill by themselves; the maintainers' `next` and node B's owner wait for a
//   click forever (a real node waits indefinitely at a human gate).
// - TRY A BAD FIX stops at the sandbox. DISMISS leaves the layer broken.
// - A layer left without an applied fix stays red even after another fault is
//   broken, until RESET: nothing repairs itself without a person.
// - A device that runs no agent (the radio relay) never starts a run.
//
// React-free: the island in bench.tsx drives it with useReducer, one tick timer
// gated by useInViewPlay, and `instant` actions under reduced motion.

import { HEAL_GATES, waitsForVisitor } from "@/lib/heal"
import { getLayer, type LayerNumber } from "@/lib/layers"
import { layerSupport, SUPPORT_LABELS, type DeviceId } from "@/lib/devices"

// ---- data -----------------------------------------------------------------

/** The four layers on the health board, in order. */
export const BOARD_LAYERS = [5, 6, 7, 8] as const satisfies readonly LayerNumber[]

/** A layer on the health board. */
export type BoardLayer = (typeof BOARD_LAYERS)[number]

/** One canned fault id. */
export type FaultId = "outbox" | "heartbeat" | "store"

/** One line of a plain-English diff: added, removed or unchanged context. */
export interface DiffLine {
  op: "add" | "remove" | "keep"
  text: string
}

/** The three sandbox checks, in strip order. */
export type CheckId = "sandbox" | "replay" | "others"

/** A fix the agent can build for a fault. */
export interface FixPlan {
  /** One plain line: what the fix does. */
  summary: string
  /** The plain-English diff (no code, no numbers). */
  diff: readonly DiffLine[]
}

/** The careless fix behind TRY A BAD FIX, and the check that catches it. */
export interface BadFixPlan extends FixPlan {
  fails: Exclude<CheckId, "sandbox">
  /** Why that check fails, printed after the check's name, e.g. "presence went quiet during every restart". */
  failNote: string
}

/** One canned fault of BREAK A LAYER. */
export interface Fault {
  id: FaultId
  /** The layer it breaks (always one every self-healing device runs). */
  layer: BoardLayer
  /** The layer in prose, lowercase: "messaging". */
  layerWord: string
  /** BREAK A LAYER button text. */
  button: string
  /** What the agent notices. */
  symptom: string
  /** The agent's diagnosis. */
  diagnosis: string
  /** Pull request title. */
  title: string
  fix: FixPlan
  badFix: BadFixPlan
}

/** The three canned faults, in button order. */
export const FAULTS: readonly Fault[] = [
  {
    id: "outbox",
    layer: 5,
    layerWord: "messaging",
    button: "MESSAGES STUCK",
    symptom: "messages stay in the outbox after a link comes back",
    diagnosis: "the outbox stops retrying once a link has dropped",
    title: "Retry the outbox when a link comes back",
    fix: {
      summary: "retry the outbox whenever any link comes back",
      diff: [
        { op: "keep", text: "keep every message until its recipient's node confirms it" },
        { op: "remove", text: "stop retrying a message once its link drops" },
        { op: "add", text: "retry the outbox whenever any link comes back" },
      ],
    },
    badFix: {
      summary: "restart the whole node whenever a link drops",
      diff: [
        { op: "keep", text: "keep every message until its recipient's node confirms it" },
        { op: "remove", text: "stop retrying a message once its link drops" },
        { op: "add", text: "restart the whole node whenever a link drops" },
      ],
      fails: "others",
      failNote: "presence went quiet during every restart",
    },
  },
  {
    // Device-neutral: every device has at least one link, and presence stays
    // continuous (L7 "Continuous heartbeats"); the fault is a link being missed.
    id: "heartbeat",
    layer: 7,
    layerWord: "presence",
    button: "HEARTBEATS STOP",
    symptom: "neighbours stopped hearing this node after it switched to another link",
    diagnosis: "heartbeats still go out on the old link only",
    title: "Announce on every link the node has",
    fix: {
      summary: "announce on every link the node has, as soon as it appears",
      diff: [
        { op: "keep", text: "keep announcing that this node is reachable" },
        { op: "remove", text: "announce only on the link the node started with" },
        { op: "add", text: "announce on every link the node has, as soon as it appears" },
      ],
    },
    badFix: {
      summary: "send heartbeats more often on the old link",
      diff: [
        { op: "keep", text: "keep announcing that this node is reachable" },
        { op: "keep", text: "announce only on the link the node started with" },
        { op: "add", text: "send heartbeats more often" },
      ],
      fails: "replay",
      failNote: "neighbours on the new link still hear nothing",
    },
  },
  {
    id: "store",
    layer: 8,
    layerWord: "storage",
    button: "STORE WON'T FREE ROOM",
    symptom: "the store refuses new data while it still holds copies already handed over",
    diagnosis: "the cleaner skips copies already handed over, so it never frees room",
    title: "Free copies already handed over first",
    fix: {
      summary: "free copies already handed over first, then superseded updates",
      diff: [
        { op: "remove", text: "keep every copy, even after it has been handed over" },
        { op: "add", text: "free copies already handed over and public data you can fetch again first" },
        { op: "add", text: "then superseded updates, then your own oldest history" },
        { op: "keep", text: "never free anything not yet delivered" },
      ],
    },
    badFix: {
      summary: "free room by deleting the oldest items, whatever they are",
      diff: [
        { op: "remove", text: "keep every copy, even after it has been handed over" },
        { op: "remove", text: "never free anything not yet delivered" },
        { op: "add", text: "free room by deleting the oldest items, whatever they are" },
      ],
      fails: "others",
      failNote: "messages not yet delivered were deleted",
    },
  },
]

/** The fault for an id. */
export function faultById(id: FaultId): Fault {
  const fault = FAULTS.find((f) => f.id === id)
  if (!fault) throw new Error(`unknown fault: ${id}`)
  return fault
}

/** The agent's three working steps, in order. */
export const AGENT_STEPS = ["diagnose", "build a fix", "test in a sandbox"] as const

/** How many agent steps there are. */
export const AGENT_STEP_COUNT = AGENT_STEPS.length

/**
 * The three checks: the line printed when it passes, and the check's name that
 * leads the bad fix's failNote when it fails ("other layers: …").
 */
export const CHECKS: readonly { id: CheckId; pass: string; failName: string }[] = [
  { id: "sandbox", pass: "applied in a sandbox", failName: "applied in a sandbox" },
  { id: "replay", pass: "failure replayed: gone", failName: "failure replayed" },
  { id: "others", pass: "other layers untouched", failName: "other layers" },
]

/** The sandbox's verdict on a bad fix (plan §5 L9). */
export const REJECTED_LINE = "fix rejected: nothing leaves the sandbox"

/** Why a radio relay has no bench (plain words; it does not run Layer 9). */
export const RELAY_LINES = [
  "A radio relay only forwards sealed traffic. It runs no agent, so nothing on it heals itself.",
  "A nearby node with an agent does the healing, for the layers that node runs.",
] as const

/**
 * The live line on a radio relay. The agent log above already prints RELAY_LINES,
 * so this says something else: where to go to watch a layer heal.
 */
export const RELAY_NARRATION = "No agent on a radio relay. Follow another device to watch a layer heal itself."

/** The gate rail's hint under APPROVE ON THIS NODE on a radio relay (it has no gate of its own). */
export const RELAY_GATE_HINT = "a radio relay runs no agent: a nearby node approves its own fixes"

// ---- device ---------------------------------------------------------------

/** How a device takes part in self-healing: its own agent, a nearby hub's help, or not at all. */
export type HealMode = "native" | "via-hub" | "none"

/** Self-healing mode of `device` (from the README table: runs / partly / not run). */
export function healMode(device: DeviceId): HealMode {
  const support = layerSupport(device, 9)
  return support === "runs" ? "native" : support === "partly" ? "via-hub" : "none"
}

/** True when the device's agent can be handed a fault on `fault`'s layer. */
export function canBreak(device: DeviceId, fault: FaultId): boolean {
  return healMode(device) !== "none" && layerSupport(device, faultById(fault).layer) !== "none"
}

// ---- state ----------------------------------------------------------------

/** Which fix the agent is building: the real one, or the visitor's TRY A BAD FIX. */
export type FixKind = "good" | "bad"

/** The bench's whole state. */
export interface HealState {
  /** The fault on the bench, or null while everything is healthy. */
  fault: FaultId | null
  /**
   * Earlier faults left without a fix applied on this node (dismissed, rejected
   * or abandoned for another fault), in FAULTS order. Their layers stay red
   * until RESET or until the visitor breaks them again: nothing heals without a person.
   */
  unresolved: readonly FaultId[]
  fix: FixKind
  /** The visitor swapped the fix (TRY A BAD FIX / BUILD A GOOD FIX) during this run. */
  rebuilt: boolean
  /** Agent steps printed so far, 0..AGENT_STEP_COUNT (0 = only the failure is noticed). */
  agentStep: number
  /** DISMISS was clicked: the agent stops and the layer stays broken. */
  dismissed: boolean
  /** Gate rail stations passed, 0..HEAL_GATES.length. */
  passed: number
}

/** Everything healthy, nothing on the rail. */
export const INITIAL_HEAL_STATE: HealState = {
  fault: null,
  unresolved: [],
  fix: "good",
  rebuilt: false,
  agentStep: 0,
  dismissed: false,
  passed: 0,
}

/** Every station passed. */
export const RAIL_LENGTH = HEAL_GATES.length

/**
 * Visitor actions carry `instant` under reduced motion: the machine work they
 * cause resolves at once (and any half-done work before them too).
 */
export type HealAction =
  /** `device` is the bench's device: a device that cannot run the fault's layer (or any agent) never starts a run. */
  | { type: "break"; fault: FaultId; device: DeviceId; instant?: boolean }
  | { type: "bad-fix"; instant?: boolean }
  | { type: "good-fix"; instant?: boolean }
  | { type: "dismiss"; instant?: boolean }
  | { type: "pass-gate"; index: number; instant?: boolean }
  | { type: "reset"; instant?: boolean }
  | { type: "tick" }

/** True once the sandbox has finished testing. */
export function sandboxDone(state: HealState): boolean {
  return state.fault !== null && state.agentStep >= AGENT_STEP_COUNT
}

/** True when the real fix passed every check (APPROVE ON THIS NODE may be clicked). */
export function checksPassed(state: HealState): boolean {
  return sandboxDone(state) && state.fix === "good" && !state.dismissed
}

/** True when the bad fix was caught: it never leaves the sandbox. */
export function fixRejected(state: HealState): boolean {
  return sandboxDone(state) && state.fix === "bad"
}

/** True when the fix is applied on this node (the first human gate is passed). */
export function appliedHere(state: HealState): boolean {
  return state.fault !== null && state.passed >= 1
}

/** True when the agent or a machine station still has work a tick will do. */
export function hasPendingWork(state: HealState): boolean {
  if (state.fault === null || state.dismissed) return false
  if (state.agentStep < AGENT_STEP_COUNT) return true
  if (!checksPassed(state)) return false
  return state.passed >= 1 && state.passed < RAIL_LENGTH && !waitsForVisitor(state.passed)
}

/** One unit of machine work: the next agent step, or the next machine station. */
export function tick(state: HealState): HealState {
  if (!hasPendingWork(state)) return state
  if (state.agentStep < AGENT_STEP_COUNT) return { ...state, agentStep: state.agentStep + 1 }
  return { ...state, passed: state.passed + 1 }
}

/** All pending machine work done: the state a real node would rest in (the next human gate). */
export function settle(state: HealState): HealState {
  let next = state
  // Bounded: at most every agent step plus every station.
  for (let i = 0; i <= AGENT_STEP_COUNT + RAIL_LENGTH && hasPendingWork(next); i++) next = tick(next)
  return next
}

/** True when station `index` waits for the visitor right now and its button works. */
export function canPassGate(state: HealState, index: number): boolean {
  return checksPassed(state) && state.passed === index && waitsForVisitor(index)
}

/** TRY A BAD FIX works while a fault is open, nothing is applied yet and the fix is the real one. */
export function canTryBadFix(state: HealState): boolean {
  return state.fault !== null && !state.dismissed && state.passed === 0 && state.fix === "good"
}

/** BUILD A GOOD FIX works after the visitor swapped in the bad one. */
export function canTryGoodFix(state: HealState): boolean {
  return state.fault !== null && !state.dismissed && state.passed === 0 && state.fix === "bad"
}

/** DISMISS works until the fix is applied on this node. */
export function canDismiss(state: HealState): boolean {
  return state.fault !== null && !state.dismissed && state.passed === 0
}

/** The faults whose layers stay broken once `next` is put on the bench (FAULTS order). */
function unresolvedAfterBreak(state: HealState, next: FaultId): FaultId[] {
  // The fault on the bench stays broken unless its fix was applied on this node.
  const leaving = state.fault !== null && !appliedHere(state) ? state.fault : null
  return FAULTS.map((f) => f.id).filter((id) => id !== next && (id === leaving || state.unresolved.includes(id)))
}

function apply(state: HealState, action: Exclude<HealAction, { type: "tick" }>): HealState {
  switch (action.type) {
    case "break":
      if (!canBreak(action.device, action.fault)) return state
      // The agent works one fault at a time: a new one starts a fresh run, and
      // a fault left without an applied fix keeps its layer red.
      return { ...INITIAL_HEAL_STATE, fault: action.fault, unresolved: unresolvedAfterBreak(state, action.fault) }
    case "bad-fix":
      if (!canTryBadFix(state)) return state
      // The diagnosis stands; the agent rebuilds (badly) and retests.
      return { ...state, fix: "bad", rebuilt: true, agentStep: Math.min(state.agentStep, 1) }
    case "good-fix":
      if (!canTryGoodFix(state)) return state
      return { ...state, fix: "good", rebuilt: true, agentStep: Math.min(state.agentStep, 1) }
    case "dismiss":
      if (!canDismiss(state)) return state
      return { ...state, dismissed: true }
    case "pass-gate":
      if (!canPassGate(state, action.index)) return state
      return { ...state, passed: state.passed + 1 }
    case "reset":
      return INITIAL_HEAL_STATE
  }
}

/** The bench reducer. A visitor action never changes anything a rule forbids. */
export function healReducer(state: HealState, action: HealAction): HealState {
  if (action.type === "tick") return tick(state)
  if (!action.instant) return apply(state, action)
  return settle(apply(settle(state), action))
}

// ---- derived views --------------------------------------------------------

/** How one health-board layer looks. */
export type BoardHealth = "not-run" | "live" | "error" | "fixed"

/** True when an earlier fault on layer `n` was left without an applied fix. */
function leftBroken(state: HealState, n: BoardLayer): boolean {
  return state.unresolved.some((id) => faultById(id).layer === n)
}

/** Health of board layer `n` on `device`. */
export function boardHealth(state: HealState, device: DeviceId, n: BoardLayer): BoardHealth {
  if (layerSupport(device, n) === "none") return "not-run"
  if (leftBroken(state, n)) return "error"
  if (state.fault === null || faultById(state.fault).layer !== n) return "live"
  return appliedHere(state) ? "fixed" : "error"
}

/** One health-board row. */
export interface BoardRow {
  n: BoardLayer
  ghost: string
  name: string
  health: BoardHealth
  /** A quiet note: "not run on this device", the "partly" wording, or a device's own words. */
  note: string | null
  /** An earlier fault on this layer was left without a fix: it stays red. */
  leftBroken: boolean
}

/** The board note under a left-broken layer. */
export const LEFT_BROKEN_NOTE = "left broken: nothing was applied"

/** Notes that replace the generic support wording on one device (README: relays forward Layer 5 traffic without reading it). */
const ROW_NOTES: Partial<Record<DeviceId, Partial<Record<BoardLayer, string>>>> = {
  "radio-relay": { 5: "forwards sealed messages without reading them" },
}

/** The four health-board rows for `device`. */
export function boardRows(state: HealState, device: DeviceId): BoardRow[] {
  return BOARD_LAYERS.map((n) => {
    const support = layerSupport(device, n)
    const layer = getLayer(n)
    const generic = support === "none" ? "not run on this device" : support === "partly" ? SUPPORT_LABELS.partly : null
    return {
      n,
      ghost: layer.ghost,
      name: layer.navLabel,
      health: boardHealth(state, device, n),
      note: ROW_NOTES[device]?.[n] ?? generic,
      leftBroken: support !== "none" && leftBroken(state, n),
    }
  })
}

/** The fix currently on the bench (good or bad), or null. */
export function currentFix(state: HealState): FixPlan | BadFixPlan | null {
  if (state.fault === null) return null
  const fault = faultById(state.fault)
  return state.fix === "good" ? fault.fix : fault.badFix
}

/** Result of one check. */
export type CheckResult = "waiting" | "pass" | "fail"

/** One cell of the checks strip. */
export interface CheckRow {
  id: CheckId
  label: string
  result: CheckResult
}

/** The checks strip: waiting until the sandbox test runs, then pass/fail per check. */
export function checkRows(state: HealState): CheckRow[] {
  const done = sandboxDone(state)
  const fault = state.fault === null ? null : faultById(state.fault)
  return CHECKS.map((check) => {
    if (!done || fault === null) return { id: check.id, label: check.pass, result: "waiting" }
    const fails = state.fix === "bad" && fault.badFix.fails === check.id
    if (!fails) return { id: check.id, label: check.pass, result: "pass" }
    return { id: check.id, label: `${check.failName}: ${fault.badFix.failNote}`, result: "fail" }
  })
}

/** One printed step of the agent log. */
export interface AgentLogStep {
  label: (typeof AGENT_STEPS)[number]
  /** The step's line, or null while the agent has not reached it. */
  text: string | null
}

/** The agent log for `device`: the three steps, each printed whole once reached. */
export function agentLog(state: HealState, device: DeviceId): AgentLogStep[] {
  const fault = state.fault === null ? null : faultById(state.fault)
  const fix = currentFix(state)
  return AGENT_STEPS.map((label, i) => {
    if (fault === null || fix === null || state.agentStep <= i) return { label, text: null }
    if (i === 0) return { label, text: fault.diagnosis }
    if (i === 1) {
      const built = state.fix === "bad" ? `(bad fix) ${fix.summary}` : fix.summary
      return { label, text: healMode(device) === "via-hub" ? `asked a nearby hub: ${built}` : built }
    }
    return { label, text: checkRows(state).map((c) => c.label).join(" · ") }
  })
}

/** The agent log's closing line once the run has an outcome, or null while it works. */
export function logVerdict(state: HealState): string | null {
  if (state.fault === null) return null
  const fault = faultById(state.fault)
  if (state.dismissed) return `dismissed: nothing was applied, ${fault.layerWord} stays broken`
  if (!sandboxDone(state)) return null
  if (state.fix === "bad") return REJECTED_LINE
  if (state.passed === 0) return "every check passes · approve it on this node, on the gate rail"
  return `applied on this node · ${fault.layerWord} is live again`
}

/** Where the bench stands, for badges and narration. */
export type HealPhase = "idle" | "working" | "ready" | "rejected" | "dismissed" | "rail" | "done"

/** The phase of `state`. */
export function healPhase(state: HealState): HealPhase {
  if (state.fault === null) return "idle"
  if (state.dismissed) return "dismissed"
  if (!sandboxDone(state)) return "working"
  if (state.fix === "bad") return "rejected"
  if (state.passed === 0) return "ready"
  return state.passed >= RAIL_LENGTH ? "done" : "rail"
}

/** The pull request's state badge. */
export function prBadge(state: HealState): string {
  switch (healPhase(state)) {
    case "idle":
      return "NO REQUEST"
    case "working":
      return "DRAFT"
    case "ready":
      return "WAITING FOR YOU"
    case "rejected":
      return "CLOSED · REJECTED"
    case "dismissed":
      return "CLOSED · DISMISSED"
    case "rail":
      if (state.passed === 1) return "APPROVED HERE"
      if (state.passed === 2) return "OPEN UPSTREAM"
      if (state.passed === 3) return "REVIEWED UPSTREAM"
      return "MERGED"
    case "done":
      return "MERGED"
  }
}

/** One entry of the TALK log (a log, not a chat box). */
export interface TalkEntry {
  who: string
  text: string
}

/** Past-tense lines for each passed station, in HEAL_GATES order. */
const STATION_TALK: readonly TalkEntry[] = [
  { who: "you", text: "approved it on this node" },
  { who: "agent", text: "sent it upstream as a pull request" },
  { who: "maintainers", text: "reviewed it upstream" },
  { who: "maintainers", text: "merged the proven fix" },
  { who: "gateway", text: "carried it to node B" },
  { who: "node B's agent", text: "checked it again in its own sandbox: every check passes" },
  { who: "node B's owner", text: "approved it on node B" },
]

/** The TALK log: what the agent did, then each gate the fix passed. */
export function talkLog(state: HealState, device: DeviceId): TalkEntry[] {
  if (state.fault === null) return []
  const fault = faultById(state.fault)
  const fix = currentFix(state)
  const entries: TalkEntry[] = [{ who: "agent", text: `noticed: ${fault.layerWord}: ${fault.symptom}` }]
  if (state.agentStep >= 1) entries.push({ who: "agent", text: `diagnosis: ${fault.diagnosis}` })
  if (state.agentStep >= 2 && fix !== null) {
    const what = state.fix === "bad" ? `a bad fix: ${fix.summary}` : `a fix: ${fix.summary}`
    entries.push(
      healMode(device) === "via-hub"
        ? { who: "agent", text: `asked a nearby hub to build ${what}` }
        : { who: "agent", text: `built ${what}` },
    )
  }
  if (sandboxDone(state)) {
    entries.push({
      who: "sandbox",
      text: state.fix === "bad" ? REJECTED_LINE : "every check passes",
    })
  }
  if (state.dismissed) entries.push({ who: "you", text: `dismissed it: nothing was applied, ${fault.layerWord} stays broken` })
  for (let i = 0; i < Math.min(state.passed, STATION_TALK.length); i++) entries.push(STATION_TALK[i])
  return entries
}

/** How one gate station looks. */
export type StationState = "passed" | "waiting" | "idle"

/** State of station `index`: passed, the one the fix is waiting at, or not reached. */
export function stationState(state: HealState, index: number): StationState {
  if (state.fault !== null && index < state.passed) return "passed"
  if (checksPassed(state) && index === state.passed) return "waiting"
  return "idle"
}

/** The CHANGES tab's line while no diff exists yet. */
export function changesPendingLine(state: HealState, device: DeviceId): string {
  if (state.agentStep === 0) return "No changes yet: the agent is still diagnosing."
  const what = state.fix === "bad" ? "the bad fix" : "a fix"
  return healMode(device) === "via-hub"
    ? `No changes yet: a nearby hub is building ${what}.`
    : `No changes yet: the agent is building ${what}.`
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** " Messaging stays broken: …" for the layers left broken by earlier faults, or "". */
function leftBrokenSentence(state: HealState): string {
  if (state.unresolved.length === 0) return ""
  const words = state.unresolved.map((id) => faultById(id).layerWord)
  const verb = words.length === 1 ? "stays" : "stay"
  return ` ${capitalize(words.join(" and "))} ${verb} broken: nothing was applied there.`
}

/** The one polite line narrating the bench (LiveLine). */
export function narrate(state: HealState, device: DeviceId): string {
  if (healMode(device) === "none") return RELAY_NARRATION
  if (state.fault === null) return "Every layer this device runs is healthy. Break one to watch the agent work."
  const fault = faultById(state.fault)
  const Word = capitalize(fault.layerWord)
  const hub = healMode(device) === "via-hub"
  // The fix the visitor asked for, when they swapped it during this run.
  const asked = state.fix === "bad" ? "the bad fix you asked for" : state.rebuilt ? "a good fix instead" : null
  const build = (what: string) => (hub ? `asks a nearby hub to build ${what}` : `builds ${what}`)
  switch (healPhase(state)) {
    case "dismissed":
      return `Dismissed. Nothing was applied; ${fault.layerWord} stays broken.`
    case "working":
      if (state.agentStep === 0) {
        const next = asked === null ? "The agent is diagnosing it." : `The agent is diagnosing it, then ${build(asked)}.`
        return `${Word} broke: ${fault.symptom}. ${next}${leftBrokenSentence(state)}`
      }
      if (state.agentStep === 1) {
        if (asked === null) return `Diagnosis: ${fault.diagnosis}.`
        return hub
          ? `The agent is asking a nearby hub to build ${asked} and will test it in a sandbox.`
          : `The agent is building ${asked} and will test it in a sandbox.`
      }
      return hub
        ? `The agent asked a nearby hub to build ${state.fix === "bad" ? "the bad fix" : "a fix"} and is testing it in a sandbox.`
        : `The agent built ${state.fix === "bad" ? "the bad fix" : "a fix"} and is testing it in a sandbox.`
    case "rejected":
      return `Fix rejected: nothing leaves the sandbox. ${Word} stays broken.`
    case "ready":
      return "Every check passes in the sandbox. Approve it on this node when you are ready."
    case "rail":
      if (state.passed === 1) return `Approved on this node. ${Word} is live again.${leftBrokenSentence(state)}`
      if (state.passed === 2)
        return `Applied on this node: ${fault.layerWord} is live again. It went upstream as a pull request and waits for the maintainers.`
      if (state.passed === 3) return "The maintainers reviewed it upstream."
      if (state.passed === 4) return "Merged upstream."
      if (state.passed === 5) return "Merged. A gateway carries the proven fix to node B."
      return "Merged, and a gateway carried it to node B. Node B's agent checked it again in its own sandbox. It waits for node B's owner."
    case "done":
      return "Node B's owner approved it. One repair healed another node."
    case "idle":
      return ""
  }
}
