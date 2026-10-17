// Layer 2 · Identity: the pure state machine behind "Issued By Nobody".
// React-free, so it renders on the server and is unit-tested in node.
//
// The lesson in four clicked steps (plan §5 L2):
//   1 INSTALL   the node makes its own identity; the card prints.
//   2 ANNOUNCE  a nearby peer checks the seal and pins the first key it hears
//               from this node.
//   3 TAMPER    the visitor edits the heard text; the demo checksum breaks.
//   4 SWAP KEY  the already known node re-announces with a different key.
// The label is display-only: no check below ever reads it.

import { groupedLabel, LABEL_ALPHABET } from "@/lib/labels"
import { createRng, hashSeed, int } from "@/lib/prng"

/** The four steps, in order. */
export type Step = "install" | "announce" | "tamper" | "swap"

/** A step, or the empty slot before the first click. */
export type Stage = "idle" | Step

/** Chip labels of the stepper. */
export const STEPS: readonly { value: Step; label: string }[] = [
  { value: "install", label: "1 INSTALL" },
  { value: "announce", label: "2 ANNOUNCE" },
  { value: "tamper", label: "3 TAMPER" },
  { value: "swap", label: "4 SWAP KEY" },
]

/** The node's display label: grouped base32 (a–z, 2–7), never hex, never proof. */
export const NODE_LABEL = groupedLabel("l2-node-a")

/** What the node says in its announcement. */
export const ORIGINAL_TEXT = "workshop laptop is online"

/** Longest text the tamper input accepts. */
export const TEXT_MAX = 48

/** Stand-ins for key material. Drawn as bars on the page, never printed as text. */
export type KeyId = "first" | "other"

/** The key the node made at setup. */
export const NODE_KEY: KeyId = "first"

/** A different key, presented by an impostor in step 4. */
export const OTHER_KEY: KeyId = "other"

/** Internal handle for "this node" in the peer's pin store. Never shown. */
export const NODE_REF = "workshop-node"

/** One heard announcement: who it is about, the key it presents, its text and its seal. */
export interface Announcement {
  node: string
  key: KeyId
  text: string
  /** The demo checksum sealed with the key at sending time. */
  checksum: string
}

/** The peer's pinned keys: first key seen per node, never replaced. */
export type PinStore = Readonly<Partial<Record<string, KeyId>>>

/** An empty pin store. */
export const NO_PINS: PinStore = {}

/** Length of a demo checksum. */
export const CHECKSUM_LENGTH = 6

/**
 * Toy checksum over key + text, in the label alphabet: a stand-in for the real
 * signature, labelled "demo checksum" on the page. Not cryptography.
 */
export function demoChecksum(key: KeyId, text: string): string {
  let h = hashSeed(`l2-seal|${key}|${text}`)
  let out = ""
  for (let i = 0; i < CHECKSUM_LENGTH; i++) {
    out += LABEL_ALPHABET[h & 31]
    h >>>= 5
  }
  return out
}

/** An announcement sealed by `key` over `text`. */
export function sealAnnouncement(node: string, key: KeyId, text: string): Announcement {
  return { node, key, text, checksum: demoChecksum(key, text) }
}

/** The three outcomes of a check. */
export type VerdictKind = "accept" | "reject-tampered" | "reject-swapped"

/** What the seal reads after a check. */
export type SealState = "vouched" | "broken" | "wrong-key"

/** The peer's reading of one announcement. */
export interface Verdict {
  kind: VerdictKind
  accepted: boolean
  seal: SealState
  /** True only when this check pinned the key for the first time. */
  pinnedNow: boolean
  /** The pin store after the check (the same object when nothing changed). */
  pins: PinStore
}

/**
 * The peer's check, in order:
 * 1. the seal must match the text (else reject-tampered);
 * 2. a node already pinned must present its pinned key (else reject-swapped:
 *    first key seen wins, pinned keys never change);
 * 3. otherwise accept, pinning the key if this node is new.
 * A rejection never touches the pin store.
 */
export function checkAnnouncement(pins: PinStore, announcement: Announcement): Verdict {
  if (demoChecksum(announcement.key, announcement.text) !== announcement.checksum) {
    return { kind: "reject-tampered", accepted: false, seal: "broken", pinnedNow: false, pins }
  }
  const pinned = pins[announcement.node]
  if (pinned !== undefined && pinned !== announcement.key) {
    return { kind: "reject-swapped", accepted: false, seal: "wrong-key", pinnedNow: false, pins }
  }
  if (pinned === undefined) {
    return {
      kind: "accept",
      accepted: true,
      seal: "vouched",
      pinnedNow: true,
      pins: { ...pins, [announcement.node]: announcement.key },
    }
  }
  return { kind: "accept", accepted: true, seal: "vouched", pinnedNow: false, pins }
}

/** The node's genuine announcement. */
export const GENUINE: Announcement = sealAnnouncement(NODE_REF, NODE_KEY, ORIGINAL_TEXT)

/** The impostor's: same node, same text, a different key (validly sealed with it). */
export const IMPOSTOR: Announcement = sealAnnouncement(NODE_REF, OTHER_KEY, ORIGINAL_TEXT)

/** Everything the bench draws for a stage. */
export interface Scene {
  /** The card is out of the slot and the node is live. */
  printed: boolean
  /** What the nearby peer heard, if anything. */
  heard: Announcement | null
  /** The peer's pins before this check. */
  pinsBefore: PinStore
  /** The peer's check of `heard`. */
  verdict: Verdict | null
  /** The pins to draw: after the check, else before. */
  pins: PinStore
}

/**
 * The scene of a stage. Each step implies the ones before it: steps 3 and 4
 * start from the pin store step 2 left behind. `text` is the tamper input.
 */
export function sceneFor(stage: Stage, text: string): Scene {
  if (stage === "idle" || stage === "install") {
    return { printed: stage === "install", heard: null, pinsBefore: NO_PINS, verdict: null, pins: NO_PINS }
  }
  const first = checkAnnouncement(NO_PINS, GENUINE)
  if (stage === "announce") {
    return { printed: true, heard: GENUINE, pinsBefore: NO_PINS, verdict: first, pins: first.pins }
  }
  const heard = stage === "tamper" ? { ...GENUINE, text } : IMPOSTOR
  const verdict = checkAnnouncement(first.pins, heard)
  return { printed: true, heard, pinsBefore: first.pins, verdict, pins: verdict.pins }
}

/** True when the heard text no longer matches its seal (step 3 only). */
export function isSealBroken(stage: Stage, text: string): boolean {
  return sceneFor(stage, text).verdict?.seal === "broken"
}

/**
 * True when the heard announcement claims a node the peer already pinned but
 * presents a different key (step 4). The peer knows the node by its key, never
 * by its label.
 */
export function claimsPinnedNode(scene: Scene): boolean {
  const { heard } = scene
  if (!heard) return false
  const pinned = scene.pinsBefore[heard.node]
  return pinned !== undefined && pinned !== heard.key
}

/** The short note beside the heard key. */
export function keyNote(scene: Scene): string {
  const { heard } = scene
  if (!heard) return ""
  const pinned = scene.pinsBefore[heard.node]
  if (pinned === undefined) return "first key heard from this node"
  return pinned === heard.key ? "same as pinned" : "not the pinned key"
}

/**
 * Below lg the two columns stack. From step 2 on, the peer's panel (seal,
 * verdict, tamper input) is the effect of the click, so it comes right after
 * the stepper instead of under the whole card.
 */
export function peerLeads(stage: Stage): boolean {
  return stage === "announce" || stage === "tamper" || stage === "swap"
}

// ── Bench state ───────────────────────────────────────────────────────────

/** The bench's state. Counters only grow, so remount keys never repeat. */
export interface BenchState {
  stage: Stage
  /** The announcement text as the visitor left it in step 3. */
  text: string
  /** Bumped each time the card prints out of an empty slot (runs the label decode). */
  printRun: number
  /** Bumped each time the seal turns BROKEN (remount key for the one-shot glitch). */
  breakCount: number
  /**
   * Bumped by each START OVER that empties the slot. The stepper is keyed on it,
   * so its roving focus forgets the last chip and Tab lands on 1 INSTALL again.
   */
  resetCount: number
}

/** Empty slot, untouched text. */
export const INITIAL_BENCH: BenchState = {
  stage: "idle",
  text: ORIGINAL_TEXT,
  printRun: 0,
  breakCount: 0,
  resetCount: 0,
}

/** Every transition is a visitor action. */
export type BenchAction =
  | { type: "select"; step: Step }
  | { type: "edit"; text: string }
  | { type: "restore" }
  | { type: "reset" }

function withBreak(prev: BenchState, next: BenchState): BenchState {
  return !isSealBroken(prev.stage, prev.text) && isSealBroken(next.stage, next.text)
    ? { ...next, breakCount: next.breakCount + 1 }
    : next
}

/** The bench reducer. Unchanged state is returned as the same object. */
export function benchReducer(state: BenchState, action: BenchAction): BenchState {
  switch (action.type) {
    case "select": {
      if (action.step === state.stage) return state
      const printRun = state.stage === "idle" ? state.printRun + 1 : state.printRun
      return withBreak(state, { ...state, stage: action.step, printRun })
    }
    case "edit": {
      if (state.stage !== "tamper") return state
      const text = action.text.slice(0, TEXT_MAX)
      if (text === state.text) return state
      return withBreak(state, { ...state, text })
    }
    case "restore":
      return state.text === ORIGINAL_TEXT ? state : { ...state, text: ORIGINAL_TEXT }
    case "reset":
      return state.stage === "idle" && state.text === ORIGINAL_TEXT
        ? state
        : { ...state, stage: "idle", text: ORIGINAL_TEXT, resetCount: state.resetCount + 1 }
  }
}

// ── Label decode (a short effect right after a print) ─────────────────────

/** Frames of pure noise before the first character locks. */
export const DECODE_LEAD = 2

/** Milliseconds per decode frame. */
export const DECODE_INTERVAL_MS = 50

/** The frame at which `label` reads whole. */
export function decodeLength(label: string): number {
  return DECODE_LEAD + label.replace(/-/g, "").length
}

/** The frame at which NODE_LABEL reads whole. */
export const DECODE_DONE = decodeLength(NODE_LABEL)

/**
 * `label` at decode frame `tick` of print `run`: characters lock left to right,
 * the rest are seeded noise from the same alphabet (so never hex); hyphens stay.
 */
export function decodeFrame(label: string, tick: number, run: number): string {
  if (tick >= decodeLength(label)) return label
  const rng = createRng(`l2-decode-${run}-${tick}`)
  let out = ""
  let k = 0
  for (const ch of label) {
    if (ch === "-") {
      out += ch
      continue
    }
    const noise = LABEL_ALPHABET[Math.floor(rng() * LABEL_ALPHABET.length)]
    out += tick > DECODE_LEAD + k ? ch : noise
    k++
  }
  return out
}

/** Decode progress kept by the component; `run` ties it to one print. */
export interface DecodeProgress {
  run: number
  tick: number
}

/** Before any print: nothing to decode. */
export const DECODE_IDLE: DecodeProgress = { run: 0, tick: DECODE_DONE }

/** The current frame: whole before the first print, 0 for a print not yet started. */
export function decodeTick(printRun: number, progress: DecodeProgress): number {
  if (printRun === 0) return DECODE_DONE
  return progress.run === printRun ? progress.tick : 0
}

/** One frame later for print `run` (restarts from 0 when `run` is new). */
export function advanceDecode(progress: DecodeProgress, run: number): DecodeProgress {
  const tick = progress.run === run ? progress.tick : 0
  return { run, tick: Math.min(DECODE_DONE, tick + 1) }
}

// ── Key bars (the public half, drawn) ─────────────────────────────────────

/** One bar of a key drawing, in px. */
export interface KeyBar {
  width: number
  gap: number
}

/** Bars per key drawing. */
export const KEY_BAR_COUNT = 18

/** Widest bar, in px (gaps are 1–2 px). */
export const KEY_BAR_MAX = 4

/** A deterministic bar pattern per key, so two keys visibly differ. */
export function keyBars(key: KeyId): readonly KeyBar[] {
  const rng = createRng(`l2-key-${key}`)
  return Array.from({ length: KEY_BAR_COUNT }, () => ({ width: int(rng, 1, KEY_BAR_MAX), gap: int(rng, 1, 2) }))
}

// ── Words ─────────────────────────────────────────────────────────────────

/** The seal's word. */
export const SEAL_WORD: Record<SealState, string> = {
  vouched: "VOUCHED",
  broken: "BROKEN",
  "wrong-key": "WRONG KEY",
}

/** The seal's short gloss. */
export const SEAL_NOTE: Record<SealState, string> = {
  vouched: "the key vouches for the node",
  broken: "does not match the text",
  "wrong-key": "made with a different key",
}

/** The verdict's reason line. */
export function verdictReason(verdict: Verdict): string {
  switch (verdict.kind) {
    case "accept":
      return verdict.pinnedNow
        ? "first key heard from this node: pinned"
        : "matches the pinned key; text unchanged"
    case "reject-tampered":
      return "text changed after sealing; the demo checksum no longer matches"
    case "reject-swapped":
      return "pinned keys never change; first key seen wins"
  }
}

/** The bench's polite live line for a state. */
export function narrate(state: BenchState): string {
  const scene = sceneFor(state.stage, state.text)
  switch (state.stage) {
    case "idle":
      return "Slot empty, nothing issued yet. Press 1 INSTALL to set up a node."
    case "install":
      return `Installed. The node made its own identity, label ${NODE_LABEL}, issued by nobody. The private half stays here. Status live.`
    case "announce":
      return "A nearby peer checked the announcement. Seal vouched; first key heard from this node, so the peer pins it. Verdict accepted."
    case "tamper":
      return scene.verdict?.kind === "reject-tampered"
        ? "The text changed after sealing, so the demo checksum no longer matches. Seal broken. Verdict rejected."
        : "Edit the announcement text. Unchanged so far: seal vouched, verdict accepted."
    case "swap":
      return "The known node re-announces with a different key. Verdict rejected: pinned keys never change; first key seen wins."
  }
}
