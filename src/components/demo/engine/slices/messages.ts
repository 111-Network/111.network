// Messages slice (#/messages, #/messages/<peer>; plan §6.4, layers 5 and 2). Plain TS: no React.
//
// Real source: os/50-messaging/README.md §9 (the four delivery states, the mailbox), §7.2 (requests) and
// §16 (the Messages UI), as the dashboard draws them in os/40-interface/ui/src/views/messages/*. The
// sample world (engine/world.ts): Ada is a member of your home hub (Workshop hub, over Wi-Fi), so a
// message to her goes queued -> sent -> relayed (the hub's custody receipt) -> delivered (her node's
// acknowledgement), and she answers a few seconds later. Bram's hub is not yours: a message to him
// waits in the outbox until a direct path opens (his node heard over long-range radio) or the
// internet flushes it. One message request from an unknown node waits for accept / ignore.
//
// Every timed step goes through ctx.schedule (one key per message, "msg:<id>"), and only in
// response to an action: a send, a path opening (the messaging service going live, Bram heard, the
// internet). `instant` (reduced motion) lands the end state in the same dispatch. Retries follow
// link and contact events, never a timer (§9). No length limit, no expiry, no rate limit, no pair
// codes, no enrollment lockouts.
import { groupedLabel } from "@/lib/labels"
import { NEEDS_COPY } from "../../copy/core"
import { MESSAGES_COPY, MESSAGES_SAMPLES } from "../../copy/messages"
import { DAY, HOUR, MIN, SEC } from "../clock"
import type { CoreState } from "../core"
import { PATHS } from "../router"
import { NO_NEEDS, type CauseId, type NeedItem, type PeerId, type SliceCtx } from "../types"
import { castById, nodeName, type World } from "../world"
import type { DemoAction } from "./index"

// ------------------------------------------------------------------------------------ model

/** The four delivery states (§9), in the order evidence reaches them. */
export type DeliveryState = "queued" | "sent" | "relayed" | "delivered"

export const DELIVERY_STATES: readonly DeliveryState[] = ["queued", "sent", "relayed", "delivered"]

/**
 * How a contact is reached. "hub": a member of your home hub; the hub takes custody while they are
 * away. "direct": their hub is not yours (v1 scope, §9), so only a direct path delivers.
 */
export type PeerRoute = "hub" | "direct"

export interface DemoMessage {
  /** "m1", "m2" … from the slice counter. */
  id: string
  /** The thread it belongs to (a PeerId, or the request's label). */
  peer: string
  dir: "own" | "in"
  /** Peer text is rendered as text only. No length limit. */
  text: string
  /** Virtual ms: written here (own) or received here (in). Display only; nothing orders by it. */
  at: number
  /** Arrival order on this node (1, 2, 3 …): messages are ordered by it. */
  seq: number
  /** Own: how far the evidence got. Incoming messages are stored as "delivered" (they are here). */
  state: DeliveryState
  /** Own: cancelled before it left. It stays "queued"; nothing of it is sent. */
  cancelled: boolean
  /** Own: the step now scheduled for it, or null while it waits for a path. */
  next: DeliveryState | null
  /** Incoming: the sender's own clock claim (virtual ms), unverified; null for own messages. */
  claimAt: number | null
  /** Incoming demo items: why it arrived ("welcome", "reply"); null for sample history and own messages. */
  cause: CauseId | null
}

export interface DemoThread {
  peer: string
  /** A pending request is read-only until accepted; it is never marked read. */
  kind: "contact" | "request"
  /** The contact's name; null for a request (it has only its label). */
  alias: string | null
  /** Display only (a–z and 2–7), never an authenticator. */
  label: string
  route: PeerRoute
  /** The newest incoming seq the person has seen in this thread. */
  readSeq: number
  /** A request ignored on this device: folded, not counted in the badge, still pending on the node. */
  ignored: boolean
}

export interface MessagesState {
  /** The slice counter: ids and arrival order. */
  seq: number
  threads: readonly DemoThread[]
  /** Every message of every thread, ascending by seq. */
  messages: readonly DemoMessage[]
  /** Ada's replies so far (picks her next one). */
  replies: number
  /** Ada wrote back while your home hub was unreachable: her reply arrives once it is back. */
  replyWaiting: boolean
  /**
   * The visitor's reduced-motion choice, as the last action that carried `instant` said it. Steps
   * this slice plans in response to an action without that flag (a node heard, the radio leaving)
   * land at their end state at once while it is set (plan §6.5: steps cut to their end state).
   */
  instant: boolean
}

export type MessagesAction =
  /** Write a message to a contact (queued at once; the path decides the rest). */
  | { type: "messages/send"; peer: string; text: string; instant?: boolean }
  /** One delivery step of an own message (scheduled by this slice). */
  | { type: "messages/step"; id: string; to: Exclude<DeliveryState, "queued">; instant?: boolean }
  /** Cancel an own message that is still queued (two-step confirm in the view). */
  | { type: "messages/cancel"; id: string }
  /** A contact answers (scheduled by this slice after your message reached them). */
  | { type: "messages/reply"; peer: PeerId }
  | { type: "messages/acceptRequest"; peer: string }
  | { type: "messages/ignoreRequest"; peer: string }
  | { type: "messages/restoreRequest"; peer: string }
  | { type: "messages/forgetRequest"; peer: string }

/** Virtual durations of the delivery steps (ms). */
export const MESSAGE_TIMING = {
  /** Outbox -> a frame written to the link. */
  writeMs: 600,
  /** Sent -> the home hub's custody receipt. */
  custodyMs: 1800,
  /** Held by the hub -> their node collects it and acknowledges. */
  collectMs: 2400,
  /** Sent over a direct path -> their node acknowledges. */
  directAckMs: 2000,
  /** Delivered -> Ada writes back. */
  replyMs: 2600,
} as const

/** The contact who answers, and the one whose hub is not yours. */
export const REPLIER: PeerId = "ada"

/** The request's thread id: its label (the real route carries the node id). */
export function requestPeer(world: World): string {
  return groupedLabel(`${world.seed}:message-request`)
}

const stepKey = (id: string): string => `msg:${id}`
const replyKey = (peer: string): string => `reply:${peer}`

// ------------------------------------------------------------------------------------ initial

function castThread(world: World, id: PeerId, route: PeerRoute, readSeq: number): DemoThread {
  const c = castById(world, id)
  return { peer: id, kind: "contact", alias: c?.name ?? id, label: c?.label ?? id, route, readSeq, ignored: false }
}

function incoming(id: number, peer: string, text: string, at: number, claimAt: number, cause: CauseId | null): DemoMessage {
  return { id: `m${id}`, peer, dir: "in", text, at, seq: id, state: "delivered", cancelled: false, next: null, claimAt, cause }
}

/**
 * What sits in Messages when the demo opens: Bram's thread (an old message from him, and yours,
 * waiting: his hub is not yours and no path to him is open), the one message request, and Ada's
 * welcome message (unread).
 */
export function initialMessages(world: World): MessagesState {
  const req = requestPeer(world)
  const messages: DemoMessage[] = [
    incoming(1, "bram", MESSAGES_SAMPLES.bramIn, -DAY + 3 * HOUR, -DAY + 3 * HOUR - 3 * MIN, null),
    { id: "m2", peer: "bram", dir: "own", text: MESSAGES_SAMPLES.bramOwn, at: -25 * MIN, seq: 2, state: "queued", cancelled: false, next: null, claimAt: null, cause: null },
    incoming(3, req, MESSAGES_SAMPLES.request, -12 * MIN, -14 * MIN, null),
    incoming(4, REPLIER, MESSAGES_SAMPLES.welcome, -3 * MIN, -3 * MIN - 40 * SEC, "welcome"),
  ]
  return {
    seq: messages.length,
    threads: [
      castThread(world, REPLIER, "hub", 0),
      castThread(world, "bram", "direct", 1),
      { peer: req, kind: "request", alias: null, label: req, route: "hub", readSeq: 0, ignored: false },
    ],
    messages,
    replies: 0,
    replyWaiting: false,
    instant: false,
  }
}

// ------------------------------------------------------------------------------------ paths

/** Your home hub is reachable while the messaging service is live (its live reason says so). */
export function hubReachable(core: Pick<CoreState, "services">): boolean {
  return core.services.some((s) => s.id === "messaging" && s.state === "live")
}

/** Their node is heard right now (a direct path, e.g. over long-range radio). */
export function peerHeard(core: Pick<CoreState, "heard">, peer: string): boolean {
  return core.heard.some((h) => h.id === peer)
}

/** Can a frame be written toward this thread now? The hub link, a direct path, or the internet. */
export function canWrite(thread: Pick<DemoThread, "peer" | "route">, core: Pick<CoreState, "services" | "heard" | "internet">): boolean {
  if (core.internet === "connected") return true
  return thread.route === "hub" ? hubReachable(core) : peerHeard(core, thread.peer)
}

/** The next step the path allows for an own message, and after how long; null while it must wait. */
export function nextStep(
  m: Pick<DemoMessage, "dir" | "cancelled" | "state">,
  thread: Pick<DemoThread, "peer" | "route">,
  core: Pick<CoreState, "services" | "heard" | "internet">,
): { to: Exclude<DeliveryState, "queued">; ms: number } | null {
  if (m.dir !== "own" || m.cancelled) return null
  switch (m.state) {
    case "queued":
      return canWrite(thread, core) ? { to: "sent", ms: MESSAGE_TIMING.writeMs } : null
    case "sent":
      // Relayed only on the hub's custody receipt; a direct path skips the mailbox.
      if (thread.route === "hub") return hubReachable(core) ? { to: "relayed", ms: MESSAGE_TIMING.custodyMs } : null
      return peerHeard(core, thread.peer) ? { to: "delivered", ms: MESSAGE_TIMING.directAckMs } : null
    case "relayed":
      // The hub holds it; their node collects it and acknowledges.
      return { to: "delivered", ms: MESSAGE_TIMING.collectMs }
    default:
      return null
  }
}

const threadOf = (threads: readonly DemoThread[], peer: string): DemoThread | undefined => threads.find((t) => t.peer === peer)

/** The thread's display name: the alias, else the label. */
export const threadName = (t: Pick<DemoThread, "alias" | "label">): string => (t.alias && t.alias.trim() !== "" ? t.alias : t.label)

/**
 * (Re)plan the next step of every own message `pick` selects: schedule it (or, instant, dispatch it
 * now), or cancel what is pending when the path closed. A message whose planned step is already the
 * one the path allows keeps its pending timer.
 */
function plan(
  messages: readonly DemoMessage[],
  threads: readonly DemoThread[],
  ctx: SliceCtx,
  instant: boolean | undefined,
  pick: (m: DemoMessage) => boolean,
): readonly DemoMessage[] {
  let changed = false
  const out = messages.map((m) => {
    if (m.dir !== "own" || !pick(m)) return m
    const t = threadOf(threads, m.peer)
    if (!t) return m
    const step = nextStep(m, t, ctx.core)
    const to = step?.to ?? null
    if (to === m.next && !(instant && step)) return m
    const key = stepKey(m.id)
    if (step) {
      const action: DemoAction = { type: "messages/step", id: m.id, to: step.to, instant }
      if (instant) {
        ctx.cancel(key)
        ctx.dispatch(action)
      } else {
        ctx.schedule(step.ms, action, { key })
      }
    } else if (m.next !== null) {
      ctx.cancel(key)
    }
    changed = true
    return { ...m, next: to }
  })
  return changed ? out : messages
}

/** Mark every incoming message of a contact thread as seen. A pending request is never marked. */
function markRead(state: MessagesState, peer: string): MessagesState {
  const t = threadOf(state.threads, peer)
  if (!t || t.kind !== "contact") return state
  let newest = t.readSeq
  for (const m of state.messages) if (m.peer === peer && m.dir === "in" && m.seq > newest) newest = m.seq
  if (newest === t.readSeq) return state
  return { ...state, threads: state.threads.map((x) => (x.peer === peer ? { ...x, readSeq: newest } : x)) }
}

/** Is the open route this thread's conversation? */
const viewing = (core: Pick<CoreState, "route">, peer: string): boolean => core.route?.view === "conversation" && core.route.peer === peer

function patchThread(state: MessagesState, peer: string, patch: Partial<DemoThread>): MessagesState {
  return { ...state, threads: state.threads.map((t) => (t.peer === peer ? { ...t, ...patch } : t)) }
}

const pendingRequest = (state: MessagesState, peer: string): DemoThread | undefined => {
  const t = threadOf(state.threads, peer)
  return t && t.kind === "request" ? t : undefined
}

// ------------------------------------------------------------------------------------ reducer

/** The reduced-motion choice an action carries, if it carries one. */
function instantOf(action: DemoAction): boolean | undefined {
  return "instant" in action && typeof action.instant === "boolean" ? action.instant : undefined
}

export function reduceMessages(state: MessagesState, action: DemoAction, ctx: SliceCtx): MessagesState {
  const said = instantOf(action)
  const base = said === undefined || said === state.instant ? state : { ...state, instant: said }
  return reduce(base, action, ctx, base.instant)
}

function reduce(state: MessagesState, action: DemoAction, ctx: SliceCtx, instant: boolean): MessagesState {
  switch (action.type) {
    case "messages/send": {
      const t = threadOf(state.threads, action.peer)
      if (!t || t.kind !== "contact" || action.text.trim() === "") return state
      const seq = state.seq + 1
      const id = `m${seq}`
      const m: DemoMessage = { id, peer: t.peer, dir: "own", text: action.text, at: ctx.now, seq, state: "queued", cancelled: false, next: null, claimAt: null, cause: null }
      ctx.emit("message-sent", { text: MESSAGES_COPY.queuedEvent, ref: id })
      const messages = plan([...state.messages, m], state.threads, ctx, instant, (x) => x.id === id)
      return { ...state, seq, messages }
    }

    case "messages/step": {
      const i = state.messages.findIndex((m) => m.id === action.id)
      if (i < 0) return state
      const m = state.messages[i]
      if (m.dir !== "own" || m.cancelled || m.next !== action.to) return state
      const t = threadOf(state.threads, m.peer)
      if (!t) return state
      // The path is checked again when the step lands: a link that closed meanwhile leaves it waiting.
      const step = nextStep(m, t, ctx.core)
      const messages = state.messages.slice()
      if (!step || step.to !== action.to) {
        messages[i] = { ...m, next: null }
        return { ...state, messages }
      }
      messages[i] = { ...m, state: action.to, next: null }
      if (action.to === "relayed") {
        ctx.emit("custody-ack", { ref: ctx.world.homeHub })
        ctx.dispatch({ type: "core/heardNode", id: ctx.world.homeHub, via: "wifi", cause: "custody-ack", quiet: true })
      } else if (action.to === "delivered") {
        ctx.emit("delivered", { text: MESSAGES_COPY.deliveredEvent(threadName(t)), ref: t.peer })
        // The same key: a burst of messages gets one answer, after the last one reached her.
        if (t.peer === REPLIER) ctx.schedule(MESSAGE_TIMING.replyMs, { type: "messages/reply", peer: REPLIER }, { key: replyKey(REPLIER) })
      }
      return { ...state, messages: plan(messages, state.threads, ctx, instant, (x) => x.id === m.id) }
    }

    case "messages/cancel": {
      const i = state.messages.findIndex((m) => m.id === action.id)
      if (i < 0) return state
      const m = state.messages[i]
      if (m.dir !== "own" || m.state !== "queued" || m.cancelled) return state
      ctx.cancel(stepKey(m.id))
      const messages = state.messages.slice()
      messages[i] = { ...m, cancelled: true, next: null }
      return { ...state, messages }
    }

    case "messages/reply": {
      const t = threadOf(state.threads, action.peer)
      if (!t || t.kind !== "contact") return state
      // Her reply reaches you through your home hub.
      if (!hubReachable(ctx.core)) return state.replyWaiting ? state : { ...state, replyWaiting: true }
      const seq = state.seq + 1
      const replies = MESSAGES_SAMPLES.adaReplies
      const text = replies[state.replies % replies.length]
      const m = incoming(seq, t.peer, text, ctx.now, ctx.now - 5 * SEC, "reply")
      ctx.emit("reply", { text: MESSAGES_COPY.newMessageFrom(threadName(t)), ref: t.peer })
      const next: MessagesState = { ...state, seq, messages: [...state.messages, m], replies: state.replies + 1, replyWaiting: false }
      return viewing(ctx.core, t.peer) ? markRead(next, t.peer) : next
    }

    case "messages/acceptRequest": {
      if (!pendingRequest(state, action.peer)) return state
      const next = patchThread(state, action.peer, { kind: "contact", ignored: false })
      return viewing(ctx.core, action.peer) ? markRead(next, action.peer) : next
    }
    case "messages/ignoreRequest": {
      const t = pendingRequest(state, action.peer)
      return !t || t.ignored ? state : patchThread(state, action.peer, { ignored: true })
    }
    case "messages/restoreRequest": {
      const t = pendingRequest(state, action.peer)
      return !t || !t.ignored ? state : patchThread(state, action.peer, { ignored: false })
    }
    case "messages/forgetRequest": {
      if (!pendingRequest(state, action.peer)) return state
      return {
        ...state,
        threads: state.threads.filter((t) => t.peer !== action.peer),
        messages: state.messages.filter((m) => m.peer !== action.peer),
      }
    }

    // --- what other slices and core do

    case "core/navigate": {
      const r = ctx.core.route
      return r?.view === "conversation" ? markRead(state, r.peer) : state
    }

    case "core/internetConnected": {
      if (ctx.prev.core.internet === "connected") return state
      // The outbox flushes: every waiting frame is written to the internet link.
      const flushed = new Set<string>()
      const messages = state.messages.map((m) => {
        if (m.dir !== "own" || m.cancelled || m.state !== "queued") return m
        flushed.add(m.id)
        return { ...m, state: "sent" as const, next: null }
      })
      if (flushed.size === 0) return state
      ctx.emit("queue-flushed", { text: MESSAGES_COPY.flushedEvent(flushed.size) })
      for (const id of flushed) ctx.cancel(stepKey(id))
      return { ...state, messages: plan(messages, state.threads, ctx, instant, (m) => flushed.has(m.id)) }
    }

    case "core/serviceTransition": {
      if (action.id !== "messaging" || hubReachable(ctx.prev.core) || !hubReachable(ctx.core)) return state
      // The home hub is reachable again: whatever waited for it moves on.
      if (state.replyWaiting) ctx.dispatch({ type: "messages/reply", peer: REPLIER })
      const messages = plan(state.messages, state.threads, ctx, instant, (m) => threadOf(state.threads, m.peer)?.route === "hub")
      return messages === state.messages ? state : { ...state, messages }
    }

    case "core/heardNode": {
      // A direct path to a contact whose hub is not yours opened (e.g. Bram over long-range radio).
      const t = threadOf(state.threads, action.id)
      if (!t || t.route !== "direct") return state
      const messages = plan(state.messages, state.threads, ctx, instant, (m) => m.peer === t.peer)
      return messages === state.messages ? state : { ...state, messages }
    }

    case "core/radioRemoved": {
      // The radio path is gone: steps that needed it wait again (checked once more when they land).
      const messages = plan(state.messages, state.threads, ctx, instant, (m) => threadOf(state.threads, m.peer)?.route === "direct")
      return messages === state.messages ? state : { ...state, messages }
    }

    default:
      return state
  }
}

// ------------------------------------------------------------------------------------ needs you

/** Pending requests not ignored on this device (what the badge counts). */
export function openRequestCount(state: Pick<MessagesState, "threads">): number {
  return state.threads.filter((t) => t.kind === "request" && !t.ignored).length
}

/** Incoming messages after the read mark, over every conversation (requests are counted apart). */
export function unreadCount(state: Pick<MessagesState, "threads" | "messages">): number {
  const readSeq = new Map(state.threads.filter((t) => t.kind === "contact").map((t) => [t.peer, t.readSeq]))
  return state.messages.filter((m) => m.dir === "in" && m.seq > (readSeq.get(m.peer) ?? Infinity)).length
}

/** One "needs you" row for the message requests (counted by the header badge). Core is not needed. */
export function needsMessages(state: MessagesState): readonly NeedItem[] {
  const n = openRequestCount(state)
  if (n === 0) return NO_NEEDS
  return [{ key: "requests", kind: "request", label: NEEDS_COPY.requestsLabel(n), detail: NEEDS_COPY.requestsDetail, href: PATHS.messages, count: n }]
}

/** Display name of a thread's peer for a sentence ("Ada", or a request's label). */
export function peerDisplayName(world: World, state: Pick<MessagesState, "threads">, peer: string): string {
  const t = threadOf(state.threads, peer)
  return t ? threadName(t) : nodeName(world, peer)
}
