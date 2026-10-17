// Layer 5 "Courier Receipt": the pure delivery model behind the home-page widget.
//
// Semantics follow os/messaging/README.md §6 and §9 (and the dashboard's
// views/messages/model.ts):
// - queued: in the outbox, no path yet;
// - sent: a frame was written to a link, nothing confirmed;
// - relayed: a mailbox node (the HUB) saved a sealed copy for them;
// - delivered: ONLY their node's acknowledgement, back at the sender, says so.
// The sender keeps its copy until delivered. Store-and-forward: a message goes
// as far as the links allow, waits at the last station that can hold it, and
// moves on when a link comes back. Nothing expires; waiting changes nothing.
//
// Plain TS (no React, no clock, no randomness): the client island drives
// `tick` on a timer, and tests run it in node.

import { createRng } from "@/lib/prng"

// --- Links and route ----------------------------------------------------------

/** The three link kinds the visitor can turn on and off. */
export type LinkKind = "wifi" | "bluetooth" | "radio"

/** Toggle order on screen. */
export const LINK_KINDS: readonly LinkKind[] = ["wifi", "bluetooth", "radio"]

/** Plain words for each link (W1: generic words only). */
export const LINK_LABELS: Readonly<Record<LinkKind, string>> = {
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  radio: "long-range radio",
}

/** Which links are on. */
export type Links = Readonly<Record<LinkKind, boolean>>

/** All links off: the first SEND lands in the outbox (queued). */
export const NO_LINKS: Links = { wifi: false, bluetooth: false, radio: false }

export type StationId = "you" | "hub" | "relay" | "bridge" | "them"

/** One stop on the receipt, top to bottom. */
export interface Station {
  id: StationId
  /** Uppercase name, as printed on the receipt. */
  name: string
  /** The bracketed note after the name (plan §5 L5, verbatim). */
  note: string
  /** Where the narration says it waits ("It waits at the hub …"). */
  where: string
  /** Can it keep a copy while the next link is down? A relay only repeats. */
  holds: boolean
  /** The disclosure line: what this station can see of a sealed message. */
  sees: string | null
}

/** The hub's view of a sealed message (plan §5 L5, verbatim). */
export const HUB_SEES = "sees: who it is for, a size · can read it: no · can change it: no"
/** A relay's or bridge's view of a sealed message (plan §5 L5, verbatim). */
export const PASSER_SEES = "sees: a locator, a size, noise · can read it: no · can change it: no"

export const STATIONS: readonly Station[] = [
  { id: "you", name: "YOU", note: "laptop", where: "in your outbox", holds: true, sees: null },
  { id: "hub", name: "HUB", note: "stays on, holds a sealed copy", where: "at the hub", holds: true, sees: HUB_SEES },
  { id: "relay", name: "RELAY", note: "repeats it", where: "at the relay", holds: false, sees: PASSER_SEES },
  {
    id: "bridge",
    name: "THEIR BRIDGE",
    note: "a small box with a radio; passes it to Wi-Fi",
    where: "at their bridge",
    holds: true,
    sees: PASSER_SEES,
  },
  { id: "them", name: "THEM", note: "their phone", where: "on their phone", holds: true, sees: null },
]

/** Index of the sender (YOU). */
export const SENDER = 0
/** Index of the mailbox node whose saved copy is the only evidence for `relayed`. */
export const HUB = 1
/** Index of the recipient (THEM). */
export const RECIPIENT = STATIONS.length - 1

/** The link between station `i` and station `i + 1`. */
export interface Hop {
  /** Any one of these carries it. */
  links: readonly LinkKind[]
  /** "Wi-Fi or Bluetooth" / "long-range radio". */
  label: string
}

/**
 * What each hop needs: short range from the laptop to the hub and from their
 * bridge to their phone; long-range radio across the middle.
 */
export const HOPS: readonly Hop[] = [
  { links: ["wifi", "bluetooth"], label: "Wi-Fi or Bluetooth" },
  { links: ["radio"], label: "long-range radio" },
  { links: ["radio"], label: "long-range radio" },
  { links: ["wifi", "bluetooth"], label: "Wi-Fi or Bluetooth" },
]

/** Is hop `hop` usable with these links? Out-of-range hops never are. */
export function hopOpen(links: Links, hop: number): boolean {
  const h = HOPS[hop]
  return h !== undefined && h.links.some((kind) => links[kind])
}

// --- Delivery states ----------------------------------------------------------

export type DeliveryState = "queued" | "sent" | "relayed" | "delivered"

/** In order of evidence. */
export const DELIVERY_STATES: readonly DeliveryState[] = ["queued", "sent", "relayed", "delivered"]

/**
 * One sentence per state. Home uses the shortened wording of plan §5 L5; `sent`
 * has no shortened form there, so it keeps the dashboard's own sentence.
 * /demo uses the dashboard's sentences verbatim.
 */
export const STATE_SENTENCE: Readonly<Record<DeliveryState, string>> = {
  queued: "In your outbox: no path to them yet.",
  sent: "A frame was written to a link. They have not confirmed it yet.",
  relayed: "A mailbox node saved it and will hold it for them.",
  delivered: "Their node acknowledged it. Only that says delivered.",
}

/** Evidence steps after the outbox: 0 queued … 3 delivered (the dashboard's state glyph). */
export const STATE_STEP: Readonly<Record<DeliveryState, 0 | 1 | 2 | 3>> = {
  queued: 0,
  sent: 1,
  relayed: 2,
  delivered: 3,
}

// --- Parcel, courier, state ---------------------------------------------------

/** What is travelling: the sealed message (down) or their acknowledgement (back up). */
export type Cargo = "message" | "ack"

/** Where the travelling thing is. */
export interface Courier {
  cargo: Cargo
  /** The station it rests at, or the one it left while `moving`. */
  at: number
  /** On the hop from `at` toward the next station in its direction. */
  moving: boolean
}

/** One sent message and everything the receipt knows about it. */
export interface Parcel {
  /** 1 for the first SEND, 2 for the next … (React key only; never printed). */
  id: number
  /** The words, as typed. Only YOU and THEM can read them. */
  text: string
  /** What everyone else sees: block noise, longer for a longer message. */
  sealed: string
  state: DeliveryState
  /** The furthest station the message reached. */
  reached: number
  /** null once delivered: nothing is travelling any more. */
  courier: Courier | null
  /** Years waited (WAIT A YEAR). Never changes anything else. */
  years: number
}

export interface CourierState {
  /** The message line (no length limit). */
  draft: string
  links: Links
  parcel: Parcel | null
  /** How many SENDs so far. */
  sends: number
}

/** The sample message line. */
export const SAMPLE_MESSAGE = "Safe at home. The north road is open again."

export const INITIAL_STATE: CourierState = { draft: SAMPLE_MESSAGE, links: NO_LINKS, parcel: null, sends: 0 }

// --- Movement -----------------------------------------------------------------

/** Pause between two ticks of the message, in ms (the client's timer). */
export const TICK_MS = 420
/** The acknowledgement is small; it moves a little faster. */
export const ACK_TICK_MS = 260

const direction = (c: Courier): 1 | -1 => (c.cargo === "message" ? 1 : -1)

/** The hop the courier is on, or would take next from where it rests. */
export function nextHop(c: Courier): number {
  return c.cargo === "message" ? c.at : c.at - 1
}

/** Has it reached the end of its leg (the message at THEM, the acknowledgement at YOU)? */
function atEnd(c: Courier): boolean {
  return c.cargo === "message" ? c.at >= RECIPIENT : c.at <= SENDER
}

/** The nearest station at or behind `at` (against the direction of travel) that keeps a copy. */
function lastHolder(at: number, dir: 1 | -1): number {
  let i = at
  while (i > SENDER && i < RECIPIENT && !STATIONS[i].holds) i -= dir
  return i
}

/** Can the next tick change anything? */
export function canAdvance(links: Links, parcel: Parcel | null): boolean {
  const c = parcel?.courier
  if (!c) return false
  if (c.moving) return true
  return !atEnd(c) && hopOpen(links, nextHop(c))
}

/** How long the client waits before the next tick. */
export function tickDelay(parcel: Parcel | null): number {
  const c = parcel?.courier
  return c && c.cargo === "ack" && c.moving ? ACK_TICK_MS : TICK_MS
}

function depart(parcel: Parcel, c: Courier): Parcel {
  // Leaving YOU writes a frame to a link: that, and only that, is "sent".
  const state = c.cargo === "message" && c.at === SENDER && parcel.state === "queued" ? "sent" : parcel.state
  return { ...parcel, state, courier: { ...c, moving: true } }
}

function arrive(links: Links, parcel: Parcel, c: Courier): Parcel {
  const dir = direction(c)
  const i = c.at + dir

  if (c.cargo === "ack") {
    // Their acknowledgement is back at the sender: now, and only now, delivered.
    if (i <= SENDER) return { ...parcel, state: "delivered", courier: null }
  } else {
    const reached = Math.max(parcel.reached, i)
    // The hub saving a sealed copy (custody) is the only evidence for "relayed".
    const state = i === HUB && (parcel.state === "queued" || parcel.state === "sent") ? "relayed" : parcel.state
    // Their node has it and acknowledges: the acknowledgement starts back from their phone.
    if (i >= RECIPIENT) return { ...parcel, reached, state, courier: { cargo: "ack", at: RECIPIENT, moving: false } }
    parcel = { ...parcel, reached, state }
  }

  // A station passes it straight on while the next link is up. If it cannot,
  // a station that holds keeps it; a relay only repeats, so the last holder
  // behind it still has the copy and retries when the link is back.
  const onward: Courier = { cargo: c.cargo, at: i, moving: false }
  if (hopOpen(links, nextHop(onward))) return { ...parcel, courier: { ...onward, moving: true } }
  return { ...parcel, courier: { ...onward, at: lastHolder(i, dir) } }
}

/**
 * One tick of the courier. Returns the SAME object when nothing can move.
 * - resting with its next link on: departs;
 * - moving and the link is still on: arrives (and goes straight on if it can);
 * - moving and the link went off: the frame is lost on the way, and the last
 *   station that holds a copy keeps it and retries later.
 */
export function step(links: Links, parcel: Parcel): Parcel {
  const c = parcel.courier
  if (!c) return parcel
  if (!c.moving) return canAdvance(links, parcel) ? depart(parcel, c) : parcel
  if (!hopOpen(links, nextHop(c))) {
    return { ...parcel, courier: { ...c, at: lastHolder(c.at, direction(c)), moving: false } }
  }
  return arrive(links, parcel, c)
}

/** Every tick at once (reduced motion: travel cuts to the destination). */
export function settle(links: Links, parcel: Parcel): Parcel {
  let current = parcel
  // A full trip is about ten ticks; the bound only guards against a bug.
  for (let n = 0; n < 64; n++) {
    const next = step(links, current)
    if (next === current) break
    current = next
  }
  return current
}

/** Where it rests when it cannot move on: the station, the hop it needs, and what is waiting. */
export interface Waiting {
  station: number
  hop: number
  cargo: Cargo
}

/** null while it is moving or can move, and once delivered. */
export function waitingAt(links: Links, parcel: Parcel | null): Waiting | null {
  const c = parcel?.courier
  if (!c || c.moving || canAdvance(links, parcel)) return null
  return { station: c.at, hop: nextHop(c), cargo: c.cargo }
}

/**
 * The word before the noise on a station the message reached: a station that
 * keeps a copy has it "sealed"; a relay only repeats it, so it "passed through".
 */
export function carriedLabel(station: Station): "sealed" | "passed through" {
  return station.holds ? "sealed" : "passed through"
}

/** Their acknowledgement has not reached you, so the sender keeps its copy. */
export function senderCopyKept(parcel: Parcel | null): boolean {
  return parcel !== null && parcel.state !== "delivered"
}

// --- Noise --------------------------------------------------------------------

const NOISE_GLYPHS = ["░", "▒", "▓", "█"] as const

/** Block noise standing for the sealed message: same text, same noise; longer text, longer noise (capped). */
export function sealedNoise(text: string, max = 40): string {
  const length = Math.max(8, Math.min(max, Math.ceil(text.length / 2)))
  const rng = createRng(`l5-sealed:${text.length}:${text.slice(0, 256)}`)
  let out = ""
  for (let i = 0; i < length; i++) out += NOISE_GLYPHS[Math.floor(rng() * NOISE_GLYPHS.length)]
  return out
}

// --- Reducer ------------------------------------------------------------------

export type CourierAction =
  | { type: "draft"; text: string }
  /** `instant`: settle at once (reduced motion). */
  | { type: "send"; instant?: boolean }
  | { type: "toggle"; link: LinkKind; instant?: boolean }
  | { type: "wait" }
  | { type: "tick" }
  | { type: "settle" }

/**
 * Why SEND does nothing right now, or null when it prints a receipt. The
 * one-message limit belongs to this receipt, not to the network (which has no
 * rate limits), so the words say so.
 */
export function sendProblem(state: CourierState): string | null {
  if (state.parcel && state.parcel.state !== "delivered") return "This receipt tracks one message. Deliver it, then SEND prints a new one."
  if (state.draft.trim() === "") return "Write something first."
  return null
}

/** Why WAIT A YEAR does nothing right now, or null while a message is actually waiting somewhere. */
export function waitProblem(state: CourierState): string | null {
  const p = state.parcel
  if (!p) return "Press SEND first."
  if (!p.courier) return "Delivered: nothing is waiting."
  if (waitingAt(state.links, p) === null) return "Nothing waits while it is on its way."
  return null
}

/** WAIT A YEAR is on only while a message is actually waiting somewhere. */
export function canWait(state: CourierState): boolean {
  return waitProblem(state) === null
}

/**
 * A link toggled without `instant`: react on the click itself, the way SEND
 * does. A link that opens the next hop sends the resting courier off now; a
 * link that closes the hop being crossed loses that frame now, and the last
 * station holding a copy keeps it. The timer only handles arrivals.
 */
function respondToToggle(links: Links, parcel: Parcel): Parcel {
  const c = parcel.courier
  if (!c) return parcel
  if (!c.moving) return canAdvance(links, parcel) ? step(links, parcel) : parcel
  return hopOpen(links, nextHop(c)) ? parcel : step(links, parcel)
}

export function courierReducer(state: CourierState, action: CourierAction): CourierState {
  switch (action.type) {
    case "draft":
      return action.text === state.draft ? state : { ...state, draft: action.text }

    case "send": {
      if (sendProblem(state) !== null) return state
      const id = state.sends + 1
      let parcel: Parcel = {
        id,
        text: state.draft,
        sealed: sealedNoise(state.draft),
        state: "queued",
        reached: SENDER,
        courier: { cargo: "message", at: SENDER, moving: false },
        years: 0,
      }
      // With a link to the hub it leaves at once (sent); without one it stays queued.
      parcel = step(state.links, parcel)
      if (action.instant) parcel = settle(state.links, parcel)
      return { ...state, parcel, sends: id }
    }

    case "toggle": {
      const links: Links = { ...state.links, [action.link]: !state.links[action.link] }
      const parcel = state.parcel
        ? action.instant
          ? settle(links, state.parcel)
          : respondToToggle(links, state.parcel)
        : null
      return { ...state, links, parcel }
    }

    case "wait": {
      if (!canWait(state) || !state.parcel) return state
      return { ...state, parcel: { ...state.parcel, years: state.parcel.years + 1 } }
    }

    case "tick":
    case "settle": {
      if (!state.parcel) return state
      const parcel = action.type === "tick" ? step(state.links, state.parcel) : settle(state.links, state.parcel)
      return parcel === state.parcel ? state : { ...state, parcel }
    }
  }
}

// --- Words for the receipt ----------------------------------------------------

/** "under a year", "1 year", "2 years" … */
export function yearsText(years: number): string {
  if (years <= 0) return "under a year"
  return years === 1 ? "1 year" : `${years} years`
}

/**
 * The waiting line: label + value. "waiting for" only while it rests with no
 * open link; on the move it reads "in transit · waited", and once delivered
 * "waited".
 */
export function waitLine(links: Links, parcel: Parcel | null): { label: string; value: string } {
  if (!parcel) return { label: "waiting for", value: "nothing sent yet" }
  const value = yearsText(parcel.years)
  if (!parcel.courier) return { label: "waited", value }
  return { label: waitingAt(links, parcel) ? "waiting for" : "in transit · waited", value }
}

const CAPITAL: Readonly<Record<DeliveryState, string>> = {
  queued: "Queued",
  sent: "Sent",
  relayed: "Relayed",
  delivered: "Delivered",
}

/** The words for what is waiting. */
const WAITER: Readonly<Record<Cargo, string>> = {
  message: "the sealed message",
  ack: "their acknowledgement",
}

/** The line under a station where something waits, e.g. "the sealed message waits here for long-range radio". */
export function waitNote(waiting: Waiting): string {
  return `${WAITER[waiting.cargo]} waits here for ${HOPS[waiting.hop]?.label ?? "a link"}`
}

/** The one polite live-line sentence for the current state (empty before the first SEND). */
export function narrate(state: CourierState): string {
  const p = state.parcel
  if (!p) return ""
  const head = `${CAPITAL[p.state]}. ${STATE_SENTENCE[p.state]}`
  const waited = p.years > 0 ? ` Waited: ${yearsText(p.years)}.` : ""
  if (!p.courier) return `${head} Your copy is released.${waited}`
  const waiting = waitingAt(state.links, p)
  // "Waiting for" only while it rests; on the move it has only waited.
  const years = p.years > 0 ? (waiting ? ` Waiting for: ${yearsText(p.years)}. Expiry: none.` : waited) : ""
  if (!waiting) {
    return p.courier.cargo === "ack"
      ? `${head} Their node has it; its acknowledgement is on the way back to you.${years}`
      : `${head} On its way.${years}`
  }
  const where = STATIONS[waiting.station].where
  const needs = HOPS[waiting.hop]?.label ?? "a link"
  return waiting.cargo === "ack"
    ? `${head} Their node has it; its acknowledgement waits ${where} for ${needs}.${years}`
    : `${head} It waits ${where} for ${needs}.${years}`
}

/** A station's tag on the receipt. */
export interface StationTag {
  text: string
  /** "here" = the courier rests at this station (drawn inverted); "done" = it passed; "none" = not reached. */
  tone: "here" | "done" | "none"
}

/** What a station did once the message passed it. */
const DONE: Readonly<Record<StationId, string>> = {
  you: "sent",
  hub: "holds a sealed copy",
  relay: "repeated it",
  bridge: "passed it on",
  them: "acknowledged",
}

/** The tag beside station `i`. */
export function stationTag(state: CourierState, i: number): StationTag {
  const p = state.parcel
  const station = STATIONS[i]
  if (!p) return i === SENDER ? { text: "ready", tone: "here" } : { text: "not yet", tone: "none" }
  if (!p.courier) return { text: i === SENDER ? "confirmed" : DONE[station.id], tone: i === SENDER ? "here" : "done" }
  const c = p.courier
  if (!c.moving && c.at === i) {
    if (waitingAt(state.links, p)) return { text: "waiting here", tone: "here" }
    return { text: i === SENDER ? "in your outbox" : "has it", tone: "here" }
  }
  if (i <= p.reached) return { text: DONE[station.id], tone: "done" }
  return { text: "not yet", tone: "none" }
}

/** One hop on the receipt: its label, whether its link is on, and what is on it right now. */
export interface HopView {
  label: string
  open: boolean
  carrying: Cargo | null
}

export function hopView(state: CourierState, hop: number): HopView {
  const c = state.parcel?.courier
  return {
    label: HOPS[hop]?.label ?? "",
    open: hopOpen(state.links, hop),
    carrying: c && c.moving && nextHop(c) === hop ? c.cargo : null,
  }
}

// --- Cargo row ----------------------------------------------------------------

/** The five kinds of traffic on the same fabric (plan §5 L5, os/README.md §5). */
export const CARGO_KINDS: readonly string[] = [
  "human messages",
  "agent operations",
  "knowledge sync",
  "software updates",
  "validated patches",
]
