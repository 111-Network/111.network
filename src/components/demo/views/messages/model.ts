// Messages view model (real os/interface/ui/src/views/messages/model.ts, minus everything API
// specific): the words and pips for delivery evidence, the reason a message waits, the custody
// line, the "received" time with the sender's claim kept apart, the one-line summaries of a thread,
// the compose gate, the messaging line and the request items. Pure: no React, no clock of its own
// (every function that needs "now" takes it). The sentences live in copy/messages.ts, verbatim.
import { MESSAGES_COPY, MESSAGES_REASON_COPY, MESSAGES_STATE_COPY } from "../../copy/messages"
import { formatClock, formatDay } from "../../engine/clock"
import type { DemoMessage, DeliveryState, DemoThread, MessagesState } from "../../engine/slices/messages"
import { threadName } from "../../engine/slices/messages"
import type { ServiceState } from "../../engine/types"
import { nodeName, type World } from "../../engine/world"

export { threadName }

const C = MESSAGES_COPY

// --- Delivery evidence (§9) -------------------------------------------------------------------

export interface StateGlyphModel {
  /** Evidence steps reached after the outbox: 0 queued, 1 sent, 2 relayed, 3 delivered. */
  filled: 0 | 1 | 2 | 3
  label: string
}

const GLYPHS: Readonly<Record<DeliveryState, StateGlyphModel>> = {
  queued: { filled: 0, label: "queued" },
  sent: { filled: 1, label: "sent" },
  relayed: { filled: 2, label: "relayed" },
  delivered: { filled: 3, label: "delivered" },
}

export const glyphFor = (state: DeliveryState): StateGlyphModel => GLYPHS[state]

/** The sentence under a state (real STATE_COPY, verbatim). */
export const stateCopy = (state: DeliveryState): string => MESSAGES_STATE_COPY[state]

/** The details sentence of a message: its state's, or, for a cancelled own message, that it is cancelled. */
export const messageStateCopy = (m: Pick<DemoMessage, "state" | "cancelled">): string => (m.cancelled ? C.cancelledState : stateCopy(m.state))

/** Can this own message still be cancelled? Only while it has not left this node. */
export const isCancellable = (m: Pick<DemoMessage, "dir" | "state" | "cancelled">): boolean => m.dir === "own" && m.state === "queued" && !m.cancelled

/**
 * Why an own message waits, by the real (state, code) table: a cancelled message says so; a
 * contact whose hub is not yours says it is delivered when you meet directly (queued, and sent
 * once the internet carried it). Everything else has no reason line: the state sentence says it.
 */
export function reasonText(m: Pick<DemoMessage, "dir" | "state" | "cancelled">, route: DemoThread["route"]): string | null {
  if (m.dir !== "own") return null
  if (m.cancelled) return MESSAGES_REASON_COPY.cancelled
  if (route !== "direct") return null
  if (m.state === "queued") return MESSAGES_REASON_COPY.hubNotYours
  if (m.state === "sent") return MESSAGES_REASON_COPY.hubNotYoursSent
  return null
}

/**
 * The custody line under an own message that went through your home hub: it holds a sealed copy
 * while the message is relayed, and held it until their node collected it once delivered. A direct
 * path never touches the mailbox, so it has no custody line.
 */
export function custodyLine(m: Pick<DemoMessage, "dir" | "state" | "cancelled">, thread: Pick<DemoThread, "route" | "alias" | "label">, world: World): string | null {
  if (m.dir !== "own" || m.cancelled || thread.route !== "hub") return null
  const hub = nodeName(world, world.homeHub)
  if (m.state === "relayed") return C.custody(hub, threadName(thread))
  if (m.state === "delivered") return C.custodyDone(hub, threadName(thread))
  return null
}

/** Advanced: what a state means as evidence, in plain words. */
export function evidenceText(m: Pick<DemoMessage, "dir" | "state" | "cancelled">): string {
  if (m.dir === "in") return C.evidence.in
  if (m.cancelled) return C.evidence.cancelled
  return C.evidence[m.state]
}

// --- Names, last line, summaries ----------------------------------------------------------------

export const MAX_LAST_LINE = 80

/** One line of a message for a list: newlines become spaces, long text is cut with an ellipsis. */
export function oneLine(text: string, max = MAX_LAST_LINE): string {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** The last line of a thread: "you: …" for an own message, the text for an incoming one, a quiet word when empty. */
export function lastLine(last: Pick<DemoMessage, "dir" | "text"> | null): string {
  if (!last) return C.noMessagesYet
  const line = oneLine(last.text)
  return last.dir === "own" ? C.you(line) : line
}

export interface StateCounts {
  queued: number
  sent: number
  relayed: number
}

/** "2 queued · 1 sent" for what is still unresolved; empty when everything is delivered or there is nothing own. */
export function unresolved(states: StateCounts): string {
  const parts: string[] = []
  if (states.queued > 0) parts.push(`${states.queued} queued`)
  if (states.sent > 0) parts.push(`${states.sent} sent`)
  if (states.relayed > 0) parts.push(`${states.relayed} relayed`)
  return parts.join(" · ")
}

export interface ThreadSummary {
  thread: DemoThread
  name: string
  last: DemoMessage | null
  /** Incoming messages after the read mark (0 for a request: it is never marked). */
  unread: number
  /** Own messages still on their way (cancelled ones are not: they never leave). */
  states: StateCounts
  /** The state to draw beside the row: the last message's, when that is an own one. */
  glyph: DemoMessage | null
}

/** The messages of one thread, in arrival order. */
export function threadMessages(state: Pick<MessagesState, "messages">, peer: string): DemoMessage[] {
  return state.messages.filter((m) => m.peer === peer)
}

export function summarize(thread: DemoThread, messages: readonly DemoMessage[]): ThreadSummary {
  let last: DemoMessage | null = null
  let unread = 0
  const states: StateCounts = { queued: 0, sent: 0, relayed: 0 }
  for (const m of messages) {
    if (m.peer !== thread.peer) continue
    if (!last || m.seq > last.seq) last = m
    if (m.dir === "in" && thread.kind === "contact" && m.seq > thread.readSeq) unread++
    if (m.dir === "own" && !m.cancelled && m.state !== "delivered") states[m.state]++
  }
  return { thread, name: threadName(thread), last, unread, states, glyph: last && last.dir === "own" ? last : null }
}

/** The conversations (accepted contacts), newest activity first (arrival order, never the clock). */
export function conversationSummaries(state: Pick<MessagesState, "threads" | "messages">): ThreadSummary[] {
  return state.threads
    .filter((t) => t.kind === "contact")
    .map((t) => summarize(t, state.messages))
    .sort((a, b) => (b.last?.seq ?? 0) - (a.last?.seq ?? 0))
}

// --- Requests (§7.2) --------------------------------------------------------------------------------

export interface RequestItem {
  peer: string
  /** A request has no alias: only its label. */
  label: string
  /** The first lines it holds, or the quiet word. */
  preview: string
  /** Ignored on this device: folded, not counted in the badge, still pending on the node. */
  ignored: boolean
}

export function requestItems(state: Pick<MessagesState, "threads" | "messages">): RequestItem[] {
  return state.threads
    .filter((t) => t.kind === "request")
    .map((t) => {
      const s = summarize(t, state.messages)
      return { peer: t.peer, label: t.label, preview: s.last ? oneLine(s.last.text, 140) : C.noHeldMessage, ignored: t.ignored }
    })
}

// --- Time (display only; nothing orders by it) ---------------------------------------------------------

/** "09:12" today, "16 Oct 12:00" otherwise (virtual time of the sample world). */
export function whenText(at: number, now: number): string {
  const hm = formatClock(at)
  return formatDay(at) === formatDay(now) ? hm : `${formatDay(at)} ${hm}`
}

/** The label for a message's own time: incoming were received here; own ones were written here. */
export const timeLabel = (m: Pick<DemoMessage, "dir">): string => (m.dir === "in" ? C.received : C.written)

/** The sender's claim, apart from the receipt time and marked unverified. null when there is none. */
export function claimText(m: Pick<DemoMessage, "dir" | "claimAt">, now: number): string | null {
  if (m.dir !== "in" || m.claimAt === null) return null
  return C.claim(whenText(m.claimAt, now))
}

// --- The composer -------------------------------------------------------------------------------------

/** Why a draft cannot be sent, or null. There is no length limit. */
export const draftProblem = (text: string): string | null => (text.trim() === "" ? C.writeFirst : null)

export type ComposeGate = { ok: true } | { ok: false; why: string }

/** Only a contact can take a new message; a pending request is read-only until accepted. */
export const composeGate = (thread: Pick<DemoThread, "kind">): ComposeGate => (thread.kind === "contact" ? { ok: true } : { ok: false, why: C.requestGate })

/** Own messages waiting in the outbox for a path: queued, not cancelled, and no step planned. */
export const waitingInOutbox = (messages: readonly DemoMessage[]): number => messages.filter((m) => isCancellable(m) && m.next === null).length

// --- The messaging service line ---------------------------------------------------------------------------

export interface MessagingBannerModel {
  kind: "unset" | "error" | "starting"
  kicker: string
  text: string
  /** What the agent button asks, or null (a starting service has no button). */
  agent: { label: string; question: string; primary: boolean } | null
}

/** The one honest line above the list while Messaging is not LIVE (real messagingBanner + bannerAgent). */
export function messagingBanner(service: { state: ServiceState; reason: string } | null | undefined): MessagingBannerModel | null {
  if (!service || service.state === "live") return null
  const b = C.banner
  const reason = service.reason.trim()
  if (service.state === "starting") return { kind: "starting", kicker: b.starting, text: reason || b.startingFallback, agent: null }
  if (service.state === "error") return { kind: "error", kicker: b.error, text: reason || b.errorFallback, agent: { label: b.fix, question: b.fixQuestion, primary: false } }
  return { kind: "unset", kicker: b.unset, text: reason || b.unsetFallback, agent: { label: b.setup, question: b.setupQuestion, primary: true } }
}
