import type { StatusState } from "@/components/common/status-dot"
import { deviceById, type DeviceId } from "@/lib/devices"

// Layer 3 "Patch Bay: Borrow a Brain" (plan §5 L3). Pure, React-free model:
// device → brain mode, the rack (consent, chosen hub, plug), whether the cable
// exists, where a question is answered, and the reducer behind the widget.
//
// Rules from the plan, all enforced here (see model.test.ts):
// - the agent runs where the device can AND the visitor agrees (consent);
// - lighter devices borrow a nearby hub's brain over the local mesh / Wi-Fi,
//   never over a long-range radio relay (the hub across town is never patched);
// - the cable exists only while consent is on and a hub nearby is chosen;
// - pulling the plug fails at once ("hub unreachable"), nothing hangs;
// - hubs are neighbours; no tool names, counts or model sizes anywhere;
// - jack and cable labels follow the brain mode (a borrower's agent plugs into
//   a hub's brain; a device that lends plugs its big brain into a borrower);
// - a device with no agent (radio relay) reads neutral, whatever the rack;
// - a trip for a device no longer followed is dead: it never blocks a new
//   question and never speaks; every narration names its question.
//
// Every state-dependent string of the widget lives here, so the tests scan all
// of it (patch-bay.tsx keeps only fixed panel captions).

// ---- devices → brain modes ----------------------------------------------

/**
 * How the followed device thinks:
 * - none: no agent at all (radio relay);
 * - borrows: no brain of its own, every question goes to a hub nearby;
 * - own: its own brain, answers everything here;
 * - split: a small brain here, heavy work asks a bigger hub nearby;
 * - lends: a big brain here that lighter neighbours borrow.
 */
export type BrainMode = "none" | "borrows" | "own" | "split" | "lends"

/** Brain mode per device (plan §5 L3 "Device behaviour"). */
export const BRAIN_MODES: Readonly<Record<DeviceId, BrainMode>> = {
  "radio-relay": "none",
  "old-phone": "borrows",
  laptop: "own",
  "radio-box": "borrows",
  "home-server": "split",
  "gpu-pc": "lends",
}

/** The brain mode of `device`. */
export function brainMode(device: DeviceId): BrainMode {
  return BRAIN_MODES[device]
}

/** True when the device has an agent at all (borrowed or its own). */
export function hasAgent(device: DeviceId): boolean {
  return brainMode(device) !== "none"
}

/** The device panel's "brain:" line, plain words. */
export const BRAIN_LINES: Readonly<Record<BrainMode, string>> = {
  none: "none, and no agent: it only repeats sealed messages",
  borrows: "none of its own: borrows one from a hub nearby",
  own: "its own: answers here",
  split: "a small one here: heavy work asks a bigger hub",
  lends: "a big one: lends it to lighter neighbours",
}

/** The words on the two patch jacks the cable joins. */
export interface JackLabels {
  /** The followed device's patch jack. */
  device: string
  /** The hub's patch jack. */
  hub: string
}

/**
 * Jack labels per brain mode, so the rack draws the direction the copy says:
 * a borrower's agent plugs into the hub's brain; a device that lends plugs its
 * big brain into a borrower.
 */
export const JACK_LABELS: Readonly<Record<BrainMode, JackLabels>> = {
  none: { device: "no agent", hub: "empty" },
  borrows: { device: "agent", hub: "brain" },
  own: { device: "brain", hub: "neighbour" },
  split: { device: "small brain", hub: "bigger brain" },
  lends: { device: "big brain", hub: "borrower" },
}

/** The consent switch's words; they hold for every brain mode. */
export const SWITCH_LABEL = "let this device use an agent"

/** The words beside the consent switch. */
export function switchState(device: DeviceId, consent: boolean): string {
  if (!hasAgent(device)) return "nothing to run"
  return consent ? "on · you agreed" : "off · you decide"
}

// ---- the rack -----------------------------------------------------------

/** The hub slot: empty, the neighbour next door (local mesh / Wi-Fi), or one across town (radio relay only). */
export type HubChoice = "none" | "next-door" | "across-town"

/** Hub choices, in chip order. */
export const HUB_CHOICES: readonly HubChoice[] = ["none", "next-door", "across-town"]

/** Chip labels for the hub slot. */
export const HUB_LABELS: Readonly<Record<HubChoice, string>> = {
  none: "no hub",
  "next-door": "hub next door",
  "across-town": "hub across town",
}

/** The hub panel's tape strip per slot. */
export const HUB_TAPES: Readonly<Record<HubChoice, string>> = {
  none: "empty slot",
  "next-door": "hub next door",
  "across-town": "hub across town",
}

/** Accessible name of the hub-slot chips (true for borrowers and lenders alike). */
export const HUB_GROUP_LABEL = "neighbour hub"

/** True for `x` in HUB_CHOICES. */
export function isHubChoice(x: unknown): x is HubChoice {
  return typeof x === "string" && (HUB_CHOICES as readonly string[]).includes(x)
}

/** What the visitor sets on the rack. */
export interface RackState {
  /** The visitor agrees to let this device use an agent. Off = "you decide". */
  consent: boolean
  /** The hub in the neighbour slot. */
  hub: HubChoice
  /** The hub next door's plug is in (false after "pull the plug"). */
  plugged: boolean
}

/** How the rack reads for a device with no agent: switch off, slot empty, nothing pulled. */
const NO_AGENT_RACK: RackState = { consent: false, hub: "none", plugged: true }

/**
 * The rack as drawn for the followed device. A device with no agent (radio
 * relay) shows a neutral rack: the switch off, an empty slot, the plug in. The
 * visitor's settings stay in state and come back when an agent-capable device
 * is followed again.
 */
export function displayRack(device: DeviceId, rack: RackState): RackState {
  return hasAgent(device) ? rack : NO_AGENT_RACK
}

/** The cable between the device's agent jack and the hub's brain jack. */
export type CableState = "none" | "patched" | "unplugged"

/**
 * The cable exists only while the device has an agent, consent is on and the
 * hub next door is chosen. The hub across town is never patched: borrowing
 * never goes over a long-range radio relay. A pulled plug leaves it dangling.
 */
export function cableState(device: DeviceId, rack: RackState): CableState {
  if (!hasAgent(device) || !rack.consent || rack.hub !== "next-door") return "none"
  return rack.plugged ? "patched" : "unplugged"
}

/** True while the cable is drawn (patched or dangling). */
export function cablePresent(device: DeviceId, rack: RackState): boolean {
  return cableState(device, rack) !== "none"
}

/** What a patched cable is for, per brain mode. */
function patchedLabel(device: DeviceId): string {
  switch (brainMode(device)) {
    case "borrows":
      return "patched · borrows a brain over the local mesh / Wi-Fi"
    case "split":
      return "patched · heavy work goes over the local mesh / Wi-Fi"
    case "own":
      return `patched · not needed: this ${deviceById(device).label} thinks here`
    case "lends":
      return "patched · lends its brain over the local mesh / Wi-Fi"
    case "none":
      return "no cable · a radio relay has no agent"
  }
}

/** The words beside the cable (or in the empty gap, saying why there is none). */
export function cableLabel(device: DeviceId, rack: RackState): string {
  switch (cableState(device, rack)) {
    case "patched":
      return patchedLabel(device)
    case "unplugged":
      return "unplugged · hub unreachable"
    case "none":
      if (!hasAgent(device)) return "no cable · a radio relay has no agent"
      if (!rack.consent) return "no cable · you decide"
      if (rack.hub === "none") return "no cable · no hub chosen"
      return "no cable · never over a long-range radio relay"
  }
}

/** A StatusDot reading: state + label. */
export interface StatusReading {
  state: StatusState
  label: string
}

/** The device panel's agent status. Consent off is NOT SET "you decide". */
export function agentStatus(device: DeviceId, rack: RackState): StatusReading {
  const mode = brainMode(device)
  if (mode === "none") return { state: "unset", label: "NOT SET · no agent" }
  if (!rack.consent) return { state: "unset", label: "NOT SET · you decide" }
  switch (mode) {
    case "borrows":
      if (rack.hub === "none") return { state: "unset", label: "NOT SET · no hub" }
      if (rack.hub === "across-town") return { state: "unset", label: "NOT SET · no hub nearby" }
      if (!rack.plugged) return { state: "error", label: "ERROR · hub unreachable" }
      return { state: "live", label: "LIVE · borrowing" }
    case "own":
      return { state: "live", label: "LIVE · thinks here" }
    case "split":
      return { state: "live", label: "LIVE · small brain here" }
    case "lends":
      return { state: "live", label: "LIVE · big brain here" }
  }
}

/**
 * The hub panel's status. A pulled plug is ERROR "hub unreachable" at once. A
 * device with no agent has nothing to patch, whatever the rack was left at.
 */
export function hubStatus(device: DeviceId, rack: RackState): StatusReading {
  if (!hasAgent(device)) return { state: "unset", label: "NOT SET · no agent to patch" }
  if (rack.hub === "none") return { state: "unset", label: "NOT SET · empty slot" }
  if (rack.hub === "across-town") return { state: "unset", label: "NOT SET · too far" }
  if (!rack.plugged) return { state: "error", label: "ERROR · hub unreachable" }
  return { state: "live", label: "LIVE · reachable" }
}

/** The hub panel's line under its label, in the followed device's terms. */
export function hubLine(device: DeviceId, rack: RackState): string {
  if (!hasAgent(device)) return "nothing to patch: a radio relay has no agent"
  if (rack.hub === "none") return "empty slot: no neighbour patched"
  if (rack.hub === "across-town") return "reachable only over a long-range radio relay: never used for borrowing"
  switch (brainMode(device)) {
    case "borrows":
      return "a neighbour on the local mesh: lends its brain"
    case "split":
      return "a neighbour on the local mesh: a bigger brain for heavy work"
    case "own":
      return "a neighbour on the local mesh: not needed here"
    case "lends":
      return "a neighbour on the local mesh: can borrow this device's brain"
    case "none":
      return "a neighbour on the local mesh"
  }
}

/** True when "pull the plug" applies: the device has an agent and the hub next door is in the slot. */
export function canPullPlug(device: DeviceId, rack: RackState): boolean {
  return hasAgent(device) && rack.hub === "next-door"
}

/** The plug button's words: pull it, or put it back. */
export function plugLabel(plugged: boolean): string {
  return plugged ? "pull the plug" : "plug it back in"
}

// ---- questions ----------------------------------------------------------

/** One of the canned questions. */
export type QuestionId = "health" | "waited" | "fix"

/** Light questions stay on a small brain; heavy work needs a big one. */
export type Weight = "light" | "heavy"

/** A canned question and its answer. */
export interface Question {
  id: QuestionId
  text: string
  weight: Weight
  answer: string
}

/** The canned questions, in button order. */
export const QUESTIONS: readonly Question[] = [
  {
    id: "health",
    text: "Is my node healthy?",
    weight: "light",
    answer: "Every layer this device runs looks healthy. Nothing to fix.",
  },
  {
    id: "waited",
    text: "Why did my message wait?",
    weight: "light",
    answer: "The other node was out of reach for a while. Your message waited safely and went out once the link came back.",
  },
  {
    id: "fix",
    text: "Find a fix for the flaky link",
    weight: "heavy",
    answer: "Found a likely cause and tested a fix in a sandbox. It waits for your review: nothing changes until a human approves it.",
  },
]

/** The question with `id`. */
export function questionById(id: QuestionId): Question {
  const q = QUESTIONS.find((x) => x.id === id)
  if (!q) throw new Error(`unknown question ${id}`)
  return q
}

/** The small tag on a question button. */
export function weightTag(weight: Weight): string {
  return `${weight} work`
}

/**
 * The answer as the agent gives it with the rack as it stands. The health
 * monitor reports a missing or unreachable hub in the device's own terms, so
 * it never says "nothing to fix" next to a red "hub unreachable".
 */
export function answerText(device: DeviceId, rack: RackState, id: QuestionId): string {
  const question = questionById(id)
  if (id !== "health") return question.answer
  const hubGone = rack.hub === "next-door" && !rack.plugged
  switch (brainMode(device)) {
    case "split":
      if (hubGone) {
        return "Every layer this device runs looks healthy, but the hub next door is unreachable: heavy work waits until it is back."
      }
      if (rack.hub !== "next-door") {
        return "Every layer this device runs looks healthy, but no bigger hub is nearby: heavy work waits for one."
      }
      return question.answer
    case "own":
      return hubGone
        ? `Every layer this device runs looks healthy. The hub next door is unreachable, and this ${deviceById(device).label} does not need it.`
        : question.answer
    case "lends":
      return hubGone
        ? "Every layer this device runs looks healthy. The hub next door is unreachable, so it cannot borrow this brain until the plug is back in."
        : question.answer
    case "borrows":
    case "none":
      return question.answer
  }
}

/** Why a question was not answered. */
export type BlockReason = "no-agent" | "no-consent" | "no-hub" | "far-hub" | "unreachable"

/** Where a question goes: answered here, over the cable to the hub and back, or not at all. */
export type AskRoute = { kind: "here" } | { kind: "hub" } | { kind: "blocked"; reason: BlockReason }

/** True when this brain mode must borrow for a question of `weight`. */
export function needsHub(mode: BrainMode, weight: Weight): boolean {
  return mode === "borrows" || (mode === "split" && weight === "heavy")
}

/**
 * Route one question. Consent comes first; a device that thinks for itself
 * answers here whatever the hub does; one that must borrow needs the hub next
 * door, patched and plugged in. A pulled plug blocks at once ("unreachable").
 */
export function routeAsk(device: DeviceId, rack: RackState, weight: Weight): AskRoute {
  const mode = brainMode(device)
  if (mode === "none") return { kind: "blocked", reason: "no-agent" }
  if (!rack.consent) return { kind: "blocked", reason: "no-consent" }
  if (!needsHub(mode, weight)) return { kind: "here" }
  if (rack.hub === "none") return { kind: "blocked", reason: "no-hub" }
  if (rack.hub === "across-town") return { kind: "blocked", reason: "far-hub" }
  if (!rack.plugged) return { kind: "blocked", reason: "unreachable" }
  return { kind: "hub" }
}

/** The route line printed under the question. */
export function routeLine(device: DeviceId, route: AskRoute, weight: Weight): string {
  const label = deviceById(device).label
  switch (route.kind) {
    case "here":
      return `answered here, on this ${label}`
    case "hub":
      return `${weight === "heavy" && brainMode(device) === "split" ? "heavy work: " : ""}this ${label} → hub next door → back, over the local mesh`
    case "blocked":
      return "not answered"
  }
}

/** The words printed instead of an answer when a question is blocked. */
export function blockedText(device: DeviceId, reason: BlockReason): string {
  const label = deviceById(device).label
  switch (reason) {
    case "no-agent":
      return "A radio relay has no agent. It only repeats sealed messages."
    case "no-consent":
      return "The agent stays off until you agree. You decide."
    case "no-hub":
      return brainMode(device) === "split"
        ? "Heavy work needs a bigger hub nearby, and none is patched. Pick the hub next door."
        : `This ${label} has no brain of its own, and no hub is patched. Pick the hub next door.`
    case "far-hub":
      return "Not sent. The hub across town is reachable only over a long-range radio relay, and borrowing never goes that way. Pick the hub next door."
    case "unreachable":
      return "Hub unreachable. Nothing was sent and nothing hangs: plug it back in and ask again."
  }
}

/** The printout's line while a question travels along the cable. */
export const TRIP_LINES: Readonly<Record<"out" | "back", string>> = {
  out: "sending to the hub next door…",
  back: "coming back…",
}

/** The printout before any question, in the followed device's terms. */
export function idleText(device: DeviceId): string {
  const label = deviceById(device).label
  switch (brainMode(device)) {
    case "none":
      return "A radio relay has no agent to ask."
    case "borrows":
      return "Pick a question. The answer prints here, with where it was answered."
    case "split":
      return "Pick a question. Light ones are answered here; heavy work travels to a bigger hub."
    case "own":
      return `Pick a question. This ${label} thinks for itself, so nothing travels along the cable.`
    case "lends":
      return `Pick a question. This ${label} thinks for itself and lends its brain, so nothing it asks travels.`
  }
}

/** The device the "follow a borrower" shortcut switches to. */
export const BORROWER_DEVICE: DeviceId = "old-phone"

/** The shortcut button's words. */
export const FOLLOW_BORROWER_LABEL = "follow an old phone"

/**
 * The pointer to the borrowing case, for devices whose own questions never
 * travel (radio relay, laptop, PC with a graphics card); null otherwise. It
 * sits beside the "follow an old phone" button, so the trip along the cable is
 * one click away from the default device.
 */
export function followHint(device: DeviceId): string | null {
  switch (brainMode(device)) {
    case "none":
    case "own":
    case "lends":
      return "An old phone has no brain of its own: its questions travel along the cable to the hub next door and back."
    case "borrows":
    case "split":
      return null
  }
}

// ---- narration ----------------------------------------------------------

/**
 * What sits in the hub slot, in the hub panel's own terms (empty, too far,
 * unreachable). Narrated while consent is off, when the slot chips and the
 * plug still work but nothing else on the rack changes.
 */
export function describeSlot(rack: RackState): string {
  switch (rack.hub) {
    case "none":
      return "In the slot: nothing."
    case "across-town":
      return "In the slot: the hub across town, too far."
    case "next-door":
      return rack.plugged ? "In the slot: the hub next door." : "In the slot: the hub next door, unreachable."
  }
}

/** One sentence on the rack as it now stands (the LiveLine after a rack change). */
export function describeRack(device: DeviceId, rack: RackState): string {
  const mode = brainMode(device)
  const label = deviceById(device).label
  if (mode === "none") return "A radio relay has no agent."
  if (!rack.consent) return `Agent off: you decide. ${describeSlot(rack)}`
  const hubGone = rack.hub === "next-door" && !rack.plugged
  switch (mode) {
    case "borrows":
      if (rack.hub === "none") return `Agent on, but no hub is patched: this ${label} needs one nearby.`
      if (rack.hub === "across-town") return "No cable: borrowing never goes over a long-range radio relay."
      if (hubGone) return "Plug pulled: hub unreachable. Nothing hangs."
      return `Cable in: this ${label} borrows the hub next door's brain.`
    case "own":
      return hubGone
        ? `Hub unreachable. This ${label} still thinks for itself.`
        : `Agent on: this ${label} thinks for itself.`
    case "split":
      if (rack.hub === "next-door" && rack.plugged) return "Agent on: a small brain here, heavy work goes to the hub next door."
      return hubGone
        ? "Hub unreachable: light questions stay here, heavy work waits for a bigger hub."
        : "Agent on: a small brain here, but no bigger hub nearby for heavy work."
    case "lends":
      return hubGone
        ? `Hub unreachable. This ${label} still runs its big brain.`
        : `Agent on: this ${label} runs a big brain and lends it to neighbours.`
  }
}

/** `text` as a sentence: closing punctuation added when it has none. */
export function asSentence(text: string): string {
  return /[.?!…]$/.test(text) ? text : `${text}.`
}

/** The LiveLine when a question sets off along the cable. */
export function describeTrip(question: Question): string {
  return `Asked: ${asSentence(question.text)} Sent over the local mesh to the hub next door.`
}

/**
 * The LiveLine once a question resolves. It always names the question, so
 * asking a different question announces even when the outcome reads the same.
 */
export function describeAnswer(device: DeviceId, rack: RackState, question: Question, route: AskRoute): string {
  const asked = asSentence(question.text)
  switch (route.kind) {
    case "here":
      return `${asked} Answered here, on this ${deviceById(device).label}: ${answerText(device, rack, question.id)}`
    case "hub":
      return `${asked} Answered by the hub next door and sent back: ${answerText(device, rack, question.id)}`
    case "blocked":
      return `${asked} ${blockedText(device, route.reason)}`
  }
}

/** The LiveLine after the "follow an old phone" shortcut. */
export function describeFollow(device: DeviceId, rack: RackState): string {
  return `Following: ${deviceById(device).label}. ${describeRack(device, rack)}`
}

/**
 * A new announcement. A live region speaks only when its text changes, so an
 * exact repeat (the same question asked twice) is marked "Again:" and still
 * announces; a third repeat drops the mark again.
 */
export function freshNarration(previous: string, next: string): string {
  return next === previous ? `Again: ${next}` : next
}

// ---- widget reducer -----------------------------------------------------

/** Milliseconds for one leg of the trip along the cable (out, then back). */
export const LEG_MS = 550

/** The question in hand: none, travelling out / back along the cable, or resolved. */
export type AskState =
  | { phase: "idle" }
  | { phase: "out" | "back"; run: number; device: DeviceId; question: QuestionId }
  | { phase: "done"; run: number; device: DeviceId; question: QuestionId; route: AskRoute }

/** Everything the widget remembers. The followed device lives in the page store, not here. */
export interface PatchState extends RackState {
  ask: AskState
  /** Counter for ask runs, so a stale timer never advances a newer trip. */
  runs: number
  /** The polite announcement for the LiveLine (set only by the visitor's actions). */
  narration: string
}

/** Start: consent off ("you decide"), the hub next door in the slot, plugged in, nothing asked. */
export const INITIAL_PATCH_STATE: PatchState = {
  consent: false,
  hub: "next-door",
  plugged: true,
  ask: { phase: "idle" },
  runs: 0,
  narration: "",
}

/**
 * Visitor actions and the trip timer's tick. Each carries the followed device
 * at the time; "follow" carries the device the shortcut switched to.
 */
export type PatchAction =
  | { type: "toggle-consent"; device: DeviceId }
  | { type: "choose-hub"; device: DeviceId; hub: HubChoice }
  | { type: "toggle-plug"; device: DeviceId }
  | { type: "ask"; device: DeviceId; question: QuestionId; reducedMotion: boolean }
  | { type: "follow"; device: DeviceId }
  | { type: "advance"; run: number; device: DeviceId }

/** True while a question is travelling along the cable. */
export function isTravelling(ask: AskState): ask is Extract<AskState, { phase: "out" | "back" }> {
  return ask.phase === "out" || ask.phase === "back"
}

const IDLE: AskState = { phase: "idle" }

function rackOf(s: PatchState): RackState {
  return { consent: s.consent, hub: s.hub, plugged: s.plugged }
}

/** A rack change clears the printout and narrates the new rack. */
function withRack(state: PatchState, device: DeviceId, rack: RackState): PatchState {
  return { ...state, ...rack, ask: IDLE, narration: freshNarration(state.narration, describeRack(device, rack)) }
}

/** True while a question asked for `device` is travelling (a trip for another device is dead). */
function travellingFor(ask: AskState, device: DeviceId): ask is Extract<AskState, { phase: "out" | "back" }> {
  return isTravelling(ask) && ask.device === device
}

/** The widget's state machine. Pure: no timers, no DOM. */
export function patchReducer(state: PatchState, action: PatchAction): PatchState {
  switch (action.type) {
    case "toggle-consent": {
      if (!hasAgent(action.device)) return state
      return withRack(state, action.device, { ...rackOf(state), consent: !state.consent })
    }
    case "choose-hub": {
      if (!hasAgent(action.device) || action.hub === state.hub) return state
      return withRack(state, action.device, { ...rackOf(state), hub: action.hub })
    }
    case "toggle-plug": {
      if (!canPullPlug(action.device, rackOf(state))) return state
      const rack = { ...rackOf(state), plugged: !state.plugged }
      // Pulling the plug mid-trip fails that question at once: no hang.
      if (!rack.plugged && travellingFor(state.ask, action.device)) {
        const route: AskRoute = { kind: "blocked", reason: "unreachable" }
        const question = questionById(state.ask.question)
        return {
          ...state,
          ...rack,
          ask: { phase: "done", run: state.ask.run, device: state.ask.device, question: question.id, route },
          narration: freshNarration(state.narration, describeAnswer(action.device, rack, question, route)),
        }
      }
      return withRack(state, action.device, rack)
    }
    case "ask": {
      // One trip at a time for the followed device; a trip left over from a
      // device followed earlier is dead and never blocks a new question.
      if (travellingFor(state.ask, action.device)) return state
      const question = questionById(action.question)
      const rack = rackOf(state)
      const route = routeAsk(action.device, rack, question.weight)
      const run = state.runs + 1
      if (route.kind === "hub" && !action.reducedMotion) {
        return {
          ...state,
          runs: run,
          ask: { phase: "out", run, device: action.device, question: question.id },
          narration: freshNarration(state.narration, describeTrip(question)),
        }
      }
      // Answered here, blocked, or reduced motion: the answer prints whole, at once.
      return {
        ...state,
        runs: run,
        ask: { phase: "done", run, device: action.device, question: question.id, route },
        narration: freshNarration(state.narration, describeAnswer(action.device, rack, question, route)),
      }
    }
    case "follow": {
      return {
        ...state,
        ask: IDLE,
        narration: freshNarration(state.narration, describeFollow(action.device, rackOf(state))),
      }
    }
    case "advance": {
      const ask = state.ask
      if (!isTravelling(ask) || ask.run !== action.run) return state
      // The visitor followed another device mid-trip (in L1): drop the trip
      // quietly, with no announcement for a device no longer shown.
      if (ask.device !== action.device) return { ...state, ask: IDLE }
      if (ask.phase === "out") return { ...state, ask: { ...ask, phase: "back" } }
      const route: AskRoute = { kind: "hub" }
      const question = questionById(ask.question)
      return {
        ...state,
        ask: { phase: "done", run: ask.run, device: ask.device, question: question.id, route },
        narration: freshNarration(state.narration, describeAnswer(ask.device, rackOf(state), question, route)),
      }
    }
  }
}

/** The ask as the followed device sees it: a question asked for another device reads as idle. */
export function visibleAsk(ask: AskState, device: DeviceId): AskState {
  return ask.phase !== "idle" && ask.device !== device ? IDLE : ask
}
