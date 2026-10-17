import type { StatusState } from "@/components/common/status-dot"
import { deviceById, layerSupport, type DeviceId, type LayerSupport } from "@/lib/devices"
import { getLayer, type LayerNumber } from "@/lib/layers"

// Layer 1 · Bootstrap, "Boot Terminal with Device Picker" (plan §5 L1).
// Pure data + the widget's state machine; React-free so vitest can cover every
// rule the plan states for this layer. Plain words only (W1, W5): no category
// names or codes, no hardware numbers, no tech names.

// ---- install log lines ----------------------------------------------------

/** How a log line prints: "$ " prompt, "> " output, "  · " installed item, or the bold last line. */
export type BootLineKind = "cmd" | "out" | "item" | "done"

/** One line of a simulated install log. */
export interface BootLine {
  text: string
  kind: BootLineKind
  /** Ends in a dot leader + "[ok]". */
  ok?: boolean
  /** Layers this line sets up to run on the device itself. */
  runs?: readonly LayerNumber[]
  /** Layers this line sets up partly, or borrows from a nearby node. */
  partly?: readonly LayerNumber[]
}

const HEARTBEATS: BootLine = { kind: "item", ok: true, text: "heartbeats, so nearby nodes find it", runs: [7] }
const HEALING: BootLine = { kind: "item", ok: true, text: "self-healing for the layers it runs", runs: [9] }
const LIBRARY: BootLine = { kind: "item", ok: true, text: "the full knowledge library", runs: [0] }
const NEARBY_NETWORKS: BootLine = { kind: "item", ok: true, text: "joins the mesh networks already nearby", runs: [6] }
const FITS: BootLine = { kind: "out", text: "installing only what fits" }
const READING: BootLine = { kind: "out", ok: true, text: "reading hardware" }
const WORKING_OUT: BootLine = { kind: "out", ok: true, text: "working out what it can be" }
const IDENTITY: BootLine = { kind: "out", ok: true, text: "identity made on this device", runs: [2] }

/** The exact line the small box prints once the facts have shown its radio + Wi-Fi (plan §5 L1). */
export const BRIDGE_LINE = "it also bridges radio and Wi-Fi"
/** The exact line the radio relay prints (plan §5 L1). */
export const RELAY_SETUP_LINE = "set up once from a nearby computer"

/** Install logs for the devices that print one; the old phone shows the USB-C diorama instead. */
export const DEVICE_LOGS: Readonly<Record<Exclude<DeviceId, "old-phone">, readonly BootLine[]>> = {
  laptop: [
    { kind: "cmd", text: "one command, on this laptop", runs: [1] },
    READING,
    WORKING_OUT,
    IDENTITY,
    FITS,
    LIBRARY,
    { kind: "item", ok: true, text: "its own dashboard", runs: [4] },
    { kind: "item", ok: true, text: "sealed messages in an encrypted store", runs: [5, 8] },
    HEARTBEATS,
    HEALING,
    { kind: "out", text: "a small local AI is offered: it runs only if you agree", runs: [3] },
    { kind: "done", text: "node online · dashboard ready" },
  ],
  "radio-box": [
    { kind: "cmd", text: "one command, on this small box", runs: [1] },
    READING,
    WORKING_OUT,
    { kind: "out", text: BRIDGE_LINE, runs: [6] },
    IDENTITY,
    FITS,
    { kind: "item", ok: true, text: "sealed messages, held and passed on", runs: [5] },
    HEARTBEATS,
    { kind: "item", ok: true, text: "a small encrypted store; big libraries stay on a hub", partly: [8] },
    { kind: "item", ok: true, text: "the notes it needs; the full library stays on a hub", partly: [0] },
    {
      kind: "out",
      text: "borrows from a nearby hub: the local AI, the full dashboard, the self-healing checks",
      partly: [3, 4, 9],
    },
    { kind: "done", text: "node online · bridging radio and Wi-Fi" },
  ],
  "home-server": [
    { kind: "cmd", text: "one command, on this home server", runs: [1] },
    READING,
    WORKING_OUT,
    IDENTITY,
    FITS,
    LIBRARY,
    { kind: "item", ok: true, text: "big shared libraries: offline maps, encyclopedias, updates", runs: [8] },
    { kind: "item", ok: true, text: "a dashboard it also serves to small devices nearby", runs: [4] },
    { kind: "item", ok: true, text: "sealed messages, kept encrypted", runs: [5] },
    NEARBY_NETWORKS,
    HEARTBEATS,
    HEALING,
    { kind: "out", text: "a small local AI is offered; heavy work goes to a bigger hub", partly: [3] },
    { kind: "done", text: "hub online · dashboard ready" },
  ],
  "gpu-pc": [
    { kind: "cmd", text: "one command, on this PC", runs: [1] },
    READING,
    WORKING_OUT,
    IDENTITY,
    FITS,
    LIBRARY,
    { kind: "item", ok: true, text: "its own dashboard", runs: [4] },
    { kind: "item", ok: true, text: "sealed messages in an encrypted store", runs: [5, 8] },
    NEARBY_NETWORKS,
    HEARTBEATS,
    HEALING,
    {
      kind: "out",
      text: "a big local AI is offered: it runs only if you agree, and lighter devices nearby can borrow it",
      runs: [3],
    },
    { kind: "done", text: "hub online · dashboard ready" },
  ],
  "radio-relay": [
    { kind: "cmd", text: "one command, on a nearby computer", runs: [1] },
    { kind: "out", ok: true, text: "radio relay plugged in" },
    READING,
    WORKING_OUT,
    { kind: "out", ok: true, text: "identity made on the computer and handed to the relay", runs: [2] },
    FITS,
    { kind: "item", ok: true, text: "repeats sealed messages it cannot read", partly: [5] },
    HEARTBEATS,
    { kind: "out", text: `${RELAY_SETUP_LINE}: unplug it and it keeps going` },
    { kind: "done", text: "relay online · stretching the range" },
  ],
}

const NO_LINES: readonly BootLine[] = []

/** The typed log for `device` (empty for the old phone, which shows the diorama). */
export function deviceLog(device: DeviceId): readonly BootLine[] {
  return device === "old-phone" ? NO_LINES : DEVICE_LOGS[device]
}

// ---- the old phone over USB-C ---------------------------------------------

/** The taps only a human can make on the phone, in order (bootstrap spec, stock phone). */
export const PHONE_TAPS: readonly string[] = [
  "unlock developer settings",
  "turn on USB debugging",
  "allow this computer",
]

/** What the installer prints once every tap is made. */
export const PHONE_FINISH: readonly BootLine[] = [
  { kind: "out", text: "every tap made · the installer takes it from here", runs: [1] },
  { kind: "item", ok: true, text: "identity made on the phone itself", runs: [2] },
  { kind: "item", ok: true, text: "the chat and its own dashboard", runs: [4, 5] },
  HEARTBEATS,
  { kind: "item", ok: true, text: "its own encrypted store; big libraries stay on a hub", partly: [8] },
  {
    kind: "out",
    text: "borrows from a nearby hub: the local AI, most of the library, the self-healing checks",
    partly: [0, 3, 9],
  },
  { kind: "done", text: "phone online · dashboard ready" },
]

/** Where the phone setup is: waiting for taps, the installer at work, or live. */
export type PhoneStage = "taps" | "starting" | "live"

/** Stage from the taps made so far and whether the finishing lines are all printed. */
export function phoneStage(taps: number, finished: boolean): PhoneStage {
  if (taps < PHONE_TAPS.length) return "taps"
  return finished ? "live" : "starting"
}

/** The StatusDot state of each stage: NOT SET → STARTING (grey blink) → LIVE. */
export const PHONE_STATUS: Readonly<Record<PhoneStage, StatusState>> = {
  taps: "unset",
  starting: "starting",
  live: "live",
}

const LAPTOP_W = 13
const PHONE_W = 8
const GAP = " ".repeat(14)
const CABLE = "══ USB-C ═════"

function cell(text: string, width: number): string {
  return text.padEnd(width).slice(0, width)
}

/** The laptop ══ USB-C ══ phone drawing for a stage; every row is the same width. */
export function dioramaArt(stage: PhoneStage): string {
  const laptop = stage === "taps" ? " waiting" : stage === "starting" ? " working" : " done"
  const screen = stage === "taps" ? " [ tap ]" : stage === "starting" ? "   ...  " : " online "
  const top = "─".repeat(LAPTOP_W)
  const phoneTop = "─".repeat(PHONE_W)
  return [
    `┌${top}┐${GAP}┌${phoneTop}┐`,
    `│${cell(" LAPTOP", LAPTOP_W)}│${GAP}│${cell(" PHONE", PHONE_W)}│`,
    `│${cell(" installer", LAPTOP_W)}╞${CABLE}╡${cell("", PHONE_W)}│`,
    `│${cell(laptop, LAPTOP_W)}│${GAP}│${cell(screen, PHONE_W)}│`,
    `└${top}┘${GAP}│${cell("", PHONE_W)}│`,
    `${"▀".repeat(LAPTOP_W + 2)}${GAP}└${phoneTop}┘`,
  ].join("\n")
}

/** Accessible description of the drawing at a stage. */
export function dioramaLabel(stage: PhoneStage): string {
  const base = "A laptop joined to an old phone by a USB-C cable."
  if (stage === "taps") return `${base} The phone waits for a tap only you can make.`
  if (stage === "starting") return `${base} The installer is setting the phone up.`
  return `${base} The phone is online.`
}

// ---- device facts and role inheritance -------------------------------------

/** Parts a device has attached, in plain words. */
export type Part = "screen" | "wifi" | "bluetooth" | "radio" | "hotspot" | "cable" | "storage" | "graphics" | "ai-room"

/** Jobs from lightest to heaviest (os/README.md tiers, never named on the page). */
export type Job = "relay" | "chat" | "bridge" | "hub"

const JOB_ORDER: readonly Job[] = ["relay", "chat", "bridge", "hub"]

/** Plain words for each job a device can also do. */
export const JOB_WORDS: Readonly<Record<Job, string>> = {
  relay: "a radio relay that repeats for others",
  chat: "a personal node you chat on",
  bridge: "a bridge between radio and Wi-Fi",
  hub: "a hub for the devices nearby",
}

/** What each job needs attached (README "Automatic Role Inheritance": only what the hardware supports). */
const JOB_NEEDS: Readonly<Record<Job, (parts: ReadonlySet<Part>) => boolean>> = {
  relay: (p) => p.has("radio"),
  chat: (p) => p.has("screen"),
  bridge: (p) => p.has("radio") && (p.has("hotspot") || p.has("cable")),
  hub: (p) => p.has("storage") || p.has("graphics"),
}

interface DeviceProfile {
  /** The device's own job. */
  job: Job
  /** Attached parts that decide what else it can do. */
  parts: readonly Part[]
  /** The "has" fact, in plain words. */
  has: string
  /** The "can be" fact, in plain words. */
  canBe: string
}

const PROFILES: Readonly<Record<DeviceId, DeviceProfile>> = {
  "old-phone": {
    job: "chat",
    parts: ["screen", "wifi", "bluetooth"],
    has: "a screen, Wi-Fi and Bluetooth, but no long-range radio",
    canBe: "a node you chat on that borrows a nearby hub's AI",
  },
  laptop: {
    job: "chat",
    parts: ["screen", "wifi", "bluetooth", "ai-room"],
    has: "a screen, Wi-Fi and Bluetooth, with room for a small local AI",
    canBe: "a node with its own local AI",
  },
  "radio-box": {
    job: "bridge",
    parts: ["radio", "hotspot"],
    has: "radio + Wi-Fi that can host a hotspot (or a network cable)",
    canBe: "a node that carries messages over radio",
  },
  "home-server": {
    job: "hub",
    parts: ["storage", "cable", "wifi"],
    has: "lots of storage and a network cable, and it stays on",
    canBe: "a hub that keeps the big shared libraries for devices nearby",
  },
  "gpu-pc": {
    job: "hub",
    parts: ["screen", "graphics", "cable", "wifi"],
    has: "a screen and a graphics card that can run a big local AI",
    canBe: "a hub that lends its big local AI to lighter devices",
  },
  "radio-relay": {
    job: "relay",
    parts: ["radio"],
    has: "a long-range radio, with no screen and no AI",
    canBe: "a radio relay that stretches the range",
  },
}

/** The device's own job. */
export function ownJob(device: DeviceId): Job {
  return PROFILES[device].job
}

/** The device's attached parts. */
export function deviceParts(device: DeviceId): readonly Part[] {
  return PROFILES[device].parts
}

/** True when `parts` are enough for `job`. */
export function partsAllow(job: Job, parts: readonly Part[]): boolean {
  return JOB_NEEDS[job](new Set(parts))
}

/** The lighter jobs this device also does, computed from its attached parts (lightest first). */
export function alsoDoes(device: DeviceId): readonly Job[] {
  const { job, parts } = PROFILES[device]
  const below = JOB_ORDER.slice(0, JOB_ORDER.indexOf(job))
  return below.filter((j) => partsAllow(j, parts))
}

/** The gateway role is granted by connectivity, never at install, and never to a radio relay. */
export const GATEWAY_LINE = "can become a gateway while it has internet"

/** True for every device that can act as a gateway while it has internet. */
export function canBeGateway(device: DeviceId): boolean {
  return ownJob(device) !== "relay"
}

/** One "> label: value" line of the device facts. */
export interface DeviceFact {
  label: string
  value: string
}

function joinWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/** The right-column facts for a device, in display order. */
export function deviceFacts(device: DeviceId): readonly DeviceFact[] {
  const profile = PROFILES[device]
  const facts: DeviceFact[] = [
    { label: "device", value: deviceById(device).label },
    { label: "has", value: profile.has },
    { label: "can be", value: profile.canBe },
  ]
  const also = alsoDoes(device)
  if (also.length > 0) {
    facts.push({ label: "also does the job of", value: joinWords(also.map((j) => JOB_WORDS[j])) })
  }
  if (canBeGateway(device)) facts.push({ label: "gateway", value: GATEWAY_LINE })
  return facts
}

// ---- layer strip -----------------------------------------------------------

/** One cell of the ten-cell layer strip. */
export interface StripCell {
  n: LayerNumber
  /** Short layer name, lower case (CSS prints it upper case). */
  name: string
  support: LayerSupport
}

const LAYER_NUMBERS: readonly LayerNumber[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** The ten cells for a device, layer 0 first, straight from the devices table. */
export function stripCells(device: DeviceId): readonly StripCell[] {
  return LAYER_NUMBERS.map((n) => ({
    n,
    name: getLayer(n).navLabel.toLowerCase(),
    support: layerSupport(device, n),
  }))
}

// ---- widget state ----------------------------------------------------------

/**
 * Widget state: the runs the visitor started, the one run a click asked to
 * type, and the taps made in the current phone run.
 */
export interface BootState {
  /** Bumped by every chip click and by REPLAY; 0 = nothing clicked yet. */
  run: number
  /**
   * Key of the run whose lines a click asked to type: a chip click or REPLAY
   * for that device, or the phone's last TAP. Any device change no click asked
   * for (?device= on load, back/forward, another section) clears it, so the
   * log then prints whole, even when the visitor comes back to that device.
   */
  armed: string | null
  /** The run the taps belong to. */
  tapKey: string
  taps: number
}

/**
 * Transitions. `run` = a chip click (with the clicked chip's device) or REPLAY
 * (with the device shown); `tap` = the phone's TAP; `device` = the followed
 * device changed, for any reason (dispatched after `run` on a chip click).
 */
export type BootAction =
  | { type: "run"; device: DeviceId }
  | { type: "tap"; key: string }
  | { type: "device"; device: DeviceId }

/** Before any click. */
export const INITIAL_BOOT: BootState = { run: 0, armed: null, tapKey: "", taps: 0 }

/** Key of one run: a new chip click, REPLAY or another device starts a new one. */
export function runKeyOf(run: number, device: DeviceId): string {
  return `${device}#${run}`
}

/** Taps made in run `key` (0 for any other run, so a new run starts with none). */
export function tapsFor(state: BootState, key: string): number {
  return state.tapKey === key ? state.taps : 0
}

/** The widget's transitions. */
export function bootReducer(state: BootState, action: BootAction): BootState {
  switch (action.type) {
    case "run": {
      const run = state.run + 1
      return { ...state, run, armed: runKeyOf(run, action.device) }
    }
    case "device":
      // Only the device the click asked for keeps its run armed.
      if (state.armed === null || state.armed === runKeyOf(state.run, action.device)) return state
      return { ...state, armed: null }
    case "tap": {
      const made = tapsFor(state, action.key)
      if (made >= PHONE_TAPS.length) return state
      const taps = made + 1
      // The last tap is the click that starts the installer's lines.
      const armed = taps >= PHONE_TAPS.length ? action.key : state.armed
      return { ...state, tapKey: action.key, taps, armed }
    }
  }
}

/** What the log pane shows for a state and the followed device (all derived, nothing stored). */
export interface BootView {
  /** The current run's key. */
  key: string
  /** The lines of this run: the device's log, or the phone's finishing lines. */
  lines: readonly BootLine[]
  /** Taps made in this run (always 0 off the phone). */
  taps: number
  /** Every tap is made (always false off the phone). */
  tapsDone: boolean
  /** A click asked for these lines, so they type (still gated by in-view and reduced motion). */
  animate: boolean
  /** Lines shown when not typing: the whole log, or none while the phone still waits for taps. */
  stillCount: number
  /** The visitor has clicked a chip, REPLAY or TAP; until then the live line stays silent. */
  acted: boolean
}

/** Derive the pane from the widget state and the followed device. */
export function bootView(state: BootState, device: DeviceId): BootView {
  const isPhone = device === "old-phone"
  const key = runKeyOf(state.run, device)
  const taps = isPhone ? tapsFor(state, key) : 0
  const tapsDone = isPhone && taps >= PHONE_TAPS.length
  const lines = isPhone ? PHONE_FINISH : deviceLog(device)
  return {
    key,
    lines,
    taps,
    tapsDone,
    animate: state.armed === key && (!isPhone || tapsDone),
    stillCount: isPhone && !tapsDone ? 0 : lines.length,
    acted: state.run > 0 || state.taps > 0,
  }
}

// ---- narration -------------------------------------------------------------

/** What the one polite live line says about the widget. */
export interface NarrationInput {
  device: DeviceId
  /** The visitor has clicked a chip, REPLAY or TAP. Until then the line says nothing. */
  acted: boolean
  /** A click asked for the current lines, so they type instead of printing whole. */
  animated: boolean
  /** Every line of the current log (or the phone's finishing lines) is printed. */
  finished: boolean
  /** Taps made in the current phone run. */
  taps: number
}

function spoken(text: string): string {
  return text.replaceAll(" · ", ", ")
}

/**
 * The live-line text for the current state (one per state change). Empty
 * until the visitor acts, so a ?device= in the URL announces nothing on load.
 */
export function narrate({ device, acted, animated, finished, taps }: NarrationInput): string {
  if (!acted) return ""
  const label = deviceById(device).label
  if (device === "old-phone") {
    const stage = phoneStage(taps, finished)
    if (stage === "live") return `Status: live. ${spoken(PHONE_FINISH[PHONE_FINISH.length - 1].text)}.`
    if (stage === "starting") return "Every tap is made. Status: starting. The installer does the rest."
    const next = PHONE_TAPS[taps]
    if (taps === 0) return `The old phone is joined to a laptop over USB-C. Press TAP to ${next}.`
    return `Done: ${PHONE_TAPS[taps - 1]}. Press TAP to ${next}.`
  }
  const log = deviceLog(device)
  if (!animated) return `Install log for the ${label}, printed in full.`
  if (!finished) return `Installing on the ${label}.`
  return `Install on the ${label} finished: ${spoken(log[log.length - 1].text)}.`
}
