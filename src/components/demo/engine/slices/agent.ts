// Agent slice (#/, Layers 3 and 4). Owned by the Agent view task.
// Real source: os/4-interface/ui/src/views/agent/session.ts (the chat session: rows, the live turn, the
// queue, stop, new conversation, staged text), state.ts (agent state machine, queued notice, tool
// lines) and lib/api/mock/chat.ts (canned replies). Plan §6.3 "Canned chat", §6.4.
//
// - An ORDERED intent table (regex -> reply script). Each script reads the demo state, so a reply
//   never claims what the dashboard does not show. Unknown input gets the fallback + the starters.
// - A reply streams through the scheduler: its tool lines (at most 4, real tool kinds in plain words)
//   one by one, then its words one by one (`agent/step`). With `instant` (reduced motion) the whole
//   reply lands in the same dispatch. Only this slice changes per step.
// - A reply may write ONE proposal (core/proposalAdded) when it finishes, only for a target that can
//   start now and has no open proposal yet. Accept / Dismiss are core actions; this slice adds a note
//   row when a proposal it wrote is decided.
// - core/agentPrefill puts the prepared prompt in the message box. Nothing is ever sent by itself.
import { groupedLabel } from "@/lib/labels"
import { AGENT_COPY, AGENT_PROPOSAL, AGENT_REPLY, AGENT_STATE_LABEL, AGENT_STATE_WORD, AGENT_TOOLS } from "../../copy/agent"
import { LAYER_PAGES, NEARBY_SENTENCE, OWN_FACT_LINES, SERVICE_NOUN } from "../../copy/core"
import { bridgeReadyOf, canStartService, type CoreState, type DemoProposal, type NewProposal } from "../core"
import { NO_NEEDS, type NeedItem, type ServiceId, type ServiceState, type SliceCtx } from "../types"
import { castById, nodeName, type DemoService, type World } from "../world"
import type { DemoAction } from "./index"

// ------------------------------------------------------------------------------------ timing

/** Virtual ms per streamed step. A tool line takes a beat; a word is quick (the mock's 25-60 word replies). */
export const AGENT_TIMING = { toolMs: 450, wordMs: 60 } as const

/** The scheduler key of the streaming reply (one at a time; stop / new conversation cancel it). */
export const AGENT_STREAM_KEY = "agent:stream"

/** At most this many tool lines per reply (plan §6.3). */
export const MAX_TOOL_LINES = 4

// ------------------------------------------------------------------------------------- state

export type AgentToolKey = keyof typeof AGENT_TOOLS

export interface AgentRow {
  key: string
  /** "note": a decision on a proposal this chat wrote. */
  role: "user" | "assistant" | "note"
  text: string
  /** Tool lines shown with an assistant reply. */
  tools: readonly string[]
  /** The user stopped this reply early. */
  stopped: boolean
  /** The fallback reply: the starters follow it as buttons. */
  starters: boolean
  /** A note about an accepted proposal: the service it starts (its state shows beside the note). */
  target: ServiceId | null
}

/** The reply being streamed (real LiveTurn). */
export interface AgentLive {
  key: string
  words: readonly string[]
  /** Words shown so far. */
  shown: number
  tools: readonly string[]
  /** Tool lines shown so far (they come first). */
  toolsShown: number
  /** Written when the reply finishes (not when it is stopped). */
  proposal: NewProposal | null
  starters: boolean
}

export interface AgentQueued {
  id: string
  text: string
  /** Reduced motion at send time: the reply lands whole when the queue releases it. */
  instant: boolean
}

export interface AgentState {
  /** Key counter for rows and queued messages (never from ctx.now). */
  seq: number
  /** Counter of the proposals this chat wrote ("agent-p1", "agent-p2" …). */
  proposalSeq: number
  /** 1, 2, 3 … one per "new conversation" (seeds the conversation label). */
  conversation: number
  rows: readonly AgentRow[]
  live: AgentLive | null
  queued: readonly AgentQueued[]
  /** One plain sentence about why a message did not go out; null when there is nothing to say. */
  notice: string | null
  /** The message box (kept here so it survives leaving the page). */
  draft: string
  /** +1 whenever text is put into the message box for the user (starter, Why?, prefill): the box takes focus. */
  staged: number
  /** The banner of a prompt prepared on another page. */
  prepared: { from: string; text: string } | null
  /** Ids of the proposals this conversation wrote. */
  written: readonly string[]
}

export type AgentAction =
  /** Typing in the message box. */
  | { type: "agent/draft"; text: string }
  /** A starter or "Why?" puts text in the message box. Never sent. */
  | { type: "agent/stage"; text: string }
  | { type: "agent/dismissPrepared" }
  /** Send (or queue, while the agent cannot answer). Ignored when empty or while a reply streams. */
  | { type: "agent/send"; text: string; instant?: boolean }
  /** One streamed step of the reply `turn` (scheduled). */
  | { type: "agent/step"; turn: string }
  | { type: "agent/stop" }
  | { type: "agent/newConversation" }
  | { type: "agent/removeQueued"; id: string }

export function initialAgent(): AgentState {
  return { seq: 0, proposalSeq: 0, conversation: 1, rows: [], live: null, queued: [], notice: null, draft: "", staged: 0, prepared: null, written: [] }
}

// ---------------------------------------------------------------------- agent state machine

/**
 * ready       agent live, model live
 * starting    agent or model starting
 * no-model    agent live, model not set
 * unavailable agent not set / error, or model error
 * (the real `offloaded` and `loading` states never occur in the demo)
 */
export type AgentStateKind = keyof typeof AGENT_STATE_LABEL

export interface AgentStateInfo {
  kind: AgentStateKind
  label: string
  dot: ServiceState
  /** One plain sentence about why, when not ready. */
  reason: string | null
  /** A send goes to the agent now; otherwise it is queued. */
  canSend: boolean
}

function info(kind: AgentStateKind, dot: ServiceState, reason: string | null = null): AgentStateInfo {
  return { kind, label: AGENT_STATE_LABEL[kind], dot, reason, canSend: kind === "ready" }
}

/** The chat state from the registry's agent and model rows (real state.ts agentState). */
export function agentStateOf(services: readonly DemoService[]): AgentStateInfo {
  const agent = services.find((s) => s.id === "agent")
  const model = services.find((s) => s.id === "model")
  if (!agent || agent.state === "unset" || agent.state === "error") return info("unavailable", agent?.state ?? "unset", agent?.reason ?? null)
  if (agent.state === "starting") return info("starting", "starting", agent.reason)
  if (!model || model.state === "error") return info("unavailable", "error", model?.reason ?? null)
  if (model.state === "starting") return info("starting", "starting", model.reason)
  if (model.state === "unset") return info("no-model", "unset", model.reason)
  return info("ready", "live")
}

/** The sentence shown when a message is queued (real queuedNotice); null when it can go now. */
export function queuedNoticeFor(state: AgentStateInfo): string | null {
  switch (state.kind) {
    case "starting":
      return AGENT_COPY.queuedNotice.starting
    case "no-model":
      return AGENT_COPY.queuedNotice.noModel
    case "unavailable":
      return AGENT_COPY.queuedNotice.unavailable(state.reason ?? "")
    default:
      return null
  }
}

/** The one-line notice above the transcript while the agent cannot answer (real StateNotice); null when ready. */
export function stateNoticeFor(state: AgentStateInfo): string | null {
  switch (state.kind) {
    case "starting":
      return AGENT_COPY.stateNotice.starting(state.reason ?? "")
    case "unavailable":
      return AGENT_COPY.stateNotice.unavailable(state.reason ?? "")
    case "no-model":
      return AGENT_COPY.stateNotice.noModel
    default:
      return null
  }
}

// ---------------------------------------------------------------------------------- helpers

/** Word tokens that keep their trailing whitespace (real mock tokenize). */
export function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? []
}

/** The streamed text so far. */
export function liveText(live: Pick<AgentLive, "words" | "shown">): string {
  return live.words.slice(0, live.shown).join("")
}

/** The tool lines shown so far. */
export function liveTools(live: Pick<AgentLive, "tools" | "toolsShown">): readonly string[] {
  return live.toolsShown >= live.tools.length ? live.tools : live.tools.slice(0, live.toolsShown)
}

/** The conversation's display label (a–z and 2–7 only; display-only, like every demo label). */
export function conversationLabel(world: World, n: number): string {
  return groupedLabel(`${world.seed}:conversation:${n}`)
}

/**
 * Why Accept would be refused right now (core refuses while the target cannot start): the target's
 * own reason sentence, or null when Accept works. Same rule as selectors.proposalBlockedReason, over core.
 */
export function proposalBlocked(core: Pick<CoreState, "services" | "radio" | "internet">, world: World, p: DemoProposal): string | null {
  if (p.decision !== null || p.target === null) return null
  const t = core.services.find((s) => s.id === p.target)
  if (!t || t.state === "live" || t.state === "starting") return null
  return canStartService(core, world, t.id) ? null : t.reason
}

/** "A", "A and B", "A, B and C". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

const svc = (core: CoreState, id: ServiceId): DemoService | undefined => core.services.find((s) => s.id === id)

const isLive = (core: CoreState, id: ServiceId): boolean => svc(core, id)?.state === "live"

const hasOpenFor = (core: CoreState, id: ServiceId): boolean => core.proposals.some((p) => p.decision === null && p.target === id)

/** Real transport_state, from the mesh link and the joined network only (selectors.transportStatusOf). */
function transportOf(core: CoreState): keyof typeof NEARBY_SENTENCE {
  const mesh = svc(core, "mesh")
  if (!mesh || mesh.state === "unset") return "no transport"
  if (mesh.state === "error") return "transport degraded"
  return core.transport.joined !== null ? "joined" : "isolated"
}

/** NOT SET services the agent can set up now (the bridge only once the radio is live, as in "needs you"). */
function settable(core: CoreState): DemoService[] {
  return core.services.filter((s) => s.canRunHere && s.state === "unset" && s.setup === "agent" && (s.id !== "bridge" || isLive(core, "radio")))
}

/** Which service a message names, by its plain words (most specific first). */
const SERVICE_WORDS: readonly [ServiceId, RegExp][] = [
  ["bridge", /\bbridg/i],
  ["radio", /\bradio\b|\bboard\b/i],
  ["messaging", /\bmessag/i],
  ["storage", /\bstor(e|age)\b/i],
  ["repairs", /\brepair (loop|s)\b|\brepairs\b/i],
  ["gateway", /\bgateway\b|\binternet\b/i],
  ["kb", /\bknowledge\b/i],
  ["model", /\bmodel\b/i],
  ["agent", /\bagent\b/i],
  ["mesh", /\bmesh\b/i],
]

export function serviceIn(text: string): ServiceId | null {
  for (const [id, re] of SERVICE_WORDS) if (re.test(text)) return id
  return null
}

// ------------------------------------------------------------------------------ intent table

export type AgentIntent = "why" | "layer" | "fix" | "quiet" | "radio" | "setup" | "device" | "check" | "fallback"

/**
 * The ORDERED intent table: the first match wins. It covers the four starters, the prompts other
 * pages prepare ("Set up the … on this node and test it.", "Fix the … on this node.", "About Layer N
 * (…): …", "Check this node end to end …") and the "Why?" button. Everything else is the fallback.
 */
export const AGENT_INTENTS: readonly { id: Exclude<AgentIntent, "fallback">; match: RegExp }[] = [
  { id: "why", match: /\bexplain the proposal\b/i },
  { id: "layer", match: /\blayer\s*[0-9]\b/i },
  { id: "fix", match: /\b(fix|repair|broken|restart)\b/i },
  { id: "quiet", match: /\b(quiet|silent|hears?|heard|hearing|nearby|neighbou?rs?)\b/i },
  { id: "radio", match: /\b(radio|board)\b/i },
  { id: "setup", match: /\b(set\s?up|install|configure|enable|start)\b/i },
  { id: "device", match: /\b(device|hardware|laptop|run|runs|capable)\b/i },
  { id: "check", match: /\b(check|status|health|healthy|attention|wrong|working|ok|okay)\b/i },
]

export function matchIntent(text: string): AgentIntent {
  return AGENT_INTENTS.find((i) => i.match.test(text))?.id ?? "fallback"
}

/** What a reply says and does. */
export interface AgentScript {
  intent: AgentIntent
  text: string
  tools: readonly AgentToolKey[]
  proposal: NewProposal | null
  starters: boolean
}

interface ScriptCtx {
  text: string
  core: CoreState
  world: World
  /** The id the next proposal this chat writes gets. */
  pid: string
}

interface Part {
  text: string
  tools: AgentToolKey[]
  proposal?: NewProposal | null
}

const say = (parts: readonly (string | false | null | undefined)[]): string => parts.filter((p): p is string => typeof p === "string" && p !== "").join(" ")

function fixProposal(s: DemoService, pid: string): NewProposal {
  const noun = SERVICE_NOUN[s.id]
  return { id: pid, kind: "fix", title: AGENT_PROPOSAL.fix.title(noun), body: AGENT_PROPOSAL.fix.body(noun), target: s.id, from: "agent" }
}

function bridgeProposal(pid: string): NewProposal {
  return { id: pid, kind: "setup", title: AGENT_PROPOSAL.bridge.title, body: AGENT_PROPOSAL.bridge.body, target: "bridge", from: "agent" }
}

function setupProposal(s: DemoService, pid: string): NewProposal {
  const noun = SERVICE_NOUN[s.id]
  return { id: pid, kind: "setup", title: AGENT_PROPOSAL.setup.title(noun), body: AGENT_PROPOSAL.setup.body(noun), target: s.id, from: "agent" }
}

/** The bridge's part of a radio reply (radio already live). */
function bridgePart(c: ScriptCtx, lead: string | null): Part {
  const R = AGENT_REPLY.radio
  const bridge = svc(c.core, "bridge")
  const tools: AgentToolKey[] = ["kb", "health"]
  if (!bridge) return { text: say([lead]), tools }
  switch (bridge.state) {
    case "live":
      return { text: say([lead, R.bridgeLive]), tools }
    case "starting":
      return { text: say([lead, R.bridgeStarting]), tools }
    case "error":
      return { text: say([lead, R.bridgeProblem]), tools }
    case "unset":
      if (hasOpenFor(c.core, "bridge")) return { text: say([lead, R.bridgeWaiting]), tools }
      if (!bridgeReadyOf(c.core, c.world)) return { text: say([lead, R.bridgeNeedsLink]), tools }
      return { text: say([lead, R.bridgeOffer, R.bridgeWrote]), tools: [...tools, "proposal"], proposal: bridgeProposal(c.pid) }
  }
}

function checkScript(c: ScriptCtx): Part {
  const R = AGENT_REPLY.check
  const tools: AgentToolKey[] = ["health", "logs"]
  const errors = c.core.services.filter((s) => s.canRunHere && s.state === "error")
  const parts: string[] = [R.lead, ...errors.map((e) => R.problem(e.name, e.reason))]
  let proposal: NewProposal | null = null
  const first = errors[0]
  if (first) {
    if (hasOpenFor(c.core, first.id)) parts.push(R.fixWaiting)
    else if (canStartService(c.core, c.world, first.id)) {
      proposal = fixProposal(first, c.pid)
      parts.push(R.wroteFix)
      tools.push("proposal")
    }
  }
  parts.push(NEARBY_SENTENCE[transportOf(c.core)])
  parts.push(c.core.internet === "connected" ? R.internet : R.offline)
  const unset = settable(c.core)
  if (unset.length > 0) parts.push(R.notSet(joinList(unset.map((s) => s.name))))
  if (unset.some((s) => s.id === "radio") && !c.core.radio) parts.push(R.askRadio)
  const waiting = c.core.proposals.filter((p) => p.decision === null && !(first && p.target === first.id)).length
  if (waiting > 0) parts.push(R.waiting(waiting))
  if (errors.length === 0 && unset.length === 0 && waiting === 0) parts.push(R.clear)
  return { text: say(parts), tools, proposal }
}

function radioScript(c: ScriptCtx): Part {
  const R = AGENT_REPLY.radio
  const tools: AgentToolKey[] = ["kb", "health"]
  const radio = svc(c.core, "radio")
  if (radio?.state === "error") return { text: R.problem(radio.reason), tools }
  if (!c.core.radio) return { text: R.noBoard, tools }
  if (radio?.state !== "live") return { text: R.stage[c.core.radio.stage], tools }
  return bridgePart(c, c.core.radio.region ? R.running(c.core.radio.region) : null)
}

function quietScript(c: ScriptCtx): Part {
  const Q = AGENT_REPLY.quiet
  const tools: AgentToolKey[] = ["health", "logs", "kb"]
  const radio = svc(c.core, "radio")
  if (radio?.state === "error") return { text: AGENT_REPLY.radio.problem(radio.reason), tools }
  if (!c.core.radio) {
    const tried = isLive(c.core, "mesh") && c.core.transport.joined === null ? Q.tried(joinList(c.world.networks.map((n) => n.name))) : null
    return { text: say([Q.noBoard, tried, Q.plugIn]), tools }
  }
  if (radio?.state === "starting") return { text: Q.starting, tools }
  if (radio?.state !== "live") return { text: Q.notReady, tools }
  const heard = c.core.heard.filter((h) => h.via === "radio")
  if (heard.length === 0) return { text: Q.none, tools }
  const relays = heard.filter((h) => castById(c.world, h.id)?.canRead === false).map((h) => Q.relay(nodeName(c.world, h.id)))
  return { text: say([Q.heard(joinList(heard.map((h) => nodeName(c.world, h.id)))), ...relays, Q.nearby]), tools }
}

function deviceScript(c: ScriptCtx): Part {
  const D = AGENT_REPLY.device
  const facts = [...c.world.self.factLines, c.core.radio ? OWN_FACT_LINES.radio : OWN_FACT_LINES.noRadio]
  // The bootstrap rule (plan §6.8): "also bridges" only with a live radio plus a hotspot-capable Wi-Fi or ethernet.
  const bridges = bridgeReadyOf(c.core, c.world) ? D.bridges : D.couldBridge
  return { text: say([D.lead(joinList(facts)), D.runs, D.transport, bridges, D.gateway, D.offload]), tools: ["kb", "health"] }
}

function layerScript(c: ScriptCtx): Part {
  const L = AGENT_REPLY.layer
  const n = Number(/\blayer\s*([0-9])\b/i.exec(c.text)?.[1] ?? "0")
  const page = LAYER_PAGES.find((p) => p.n === n) ?? LAYER_PAGES[0]
  const services = c.core.services.filter((s) => s.layer === page.n && s.canRunHere)
  const states = services.length > 0 ? L.states(services.map((s) => `${s.name} ${AGENT_STATE_WORD[s.state]}`).join("; ")) : L.none
  const next = settable(c.core).find((s) => s.layer === page.n)
  const hasError = services.some((s) => s.state === "error")
  return { text: say([L.lead(page.n, page.title, page.description), states, next ? L.setUp(SERVICE_NOUN[next.id]) : hasError ? null : L.nothing]), tools: ["kb", "health"] }
}

function fixScript(c: ScriptCtx, named: ServiceId | null): Part {
  const F = AGENT_REPLY.fix
  const target = named ? svc(c.core, named) : c.core.services.find((s) => s.canRunHere && s.state === "error")
  if (!target) return { text: F.nothing, tools: ["health", "logs"] }
  if (target.state !== "error") return { text: F.fine(target.name, AGENT_STATE_WORD[target.state]), tools: ["health"] }
  if (hasOpenFor(c.core, target.id)) return { text: F.waiting(target.name, target.reason), tools: ["health", "logs"] }
  if (!canStartService(c.core, c.world, target.id)) return { text: AGENT_REPLY.check.problem(target.name, target.reason), tools: ["health", "logs"] }
  return { text: F.wrote(target.name, target.reason), tools: ["health", "logs", "kb", "proposal"], proposal: fixProposal(target, c.pid) }
}

function setupScript(c: ScriptCtx): Part {
  const S = AGENT_REPLY.setup
  const id = serviceIn(c.text)
  if (id === "radio") return radioScript(c)
  if (id === "gateway") return { text: S.gateway, tools: ["kb"] }
  if (id === null) {
    const unset = settable(c.core)
    return { text: unset.length > 0 ? S.list(joinList(unset.map((s) => s.name))) : S.allSet, tools: ["health"] }
  }
  const s = svc(c.core, id)
  if (!s) return { text: S.allSet, tools: ["health"] }
  if (s.state === "error") return fixScript(c, id)
  if (s.state === "live") return { text: S.already(s.name, s.reason), tools: ["health"] }
  if (s.state === "starting") return { text: S.starting(s.name), tools: ["health"] }
  if (id === "bridge") return isLive(c.core, "radio") ? bridgePart(c, S.bridgeReady) : { text: S.bridgeNeedsRadio, tools: ["kb", "health"] }
  if (hasOpenFor(c.core, id) || !canStartService(c.core, c.world, id)) return { text: AGENT_REPLY.check.notSet(s.name), tools: ["health"] }
  return { text: say([AGENT_REPLY.check.notSet(s.name), S.wrote]), tools: ["kb", "health", "proposal"], proposal: setupProposal(s, c.pid) }
}

function whyScript(c: ScriptCtx): Part {
  const W = AGENT_REPLY.why
  const title = /"([^"]+)"/.exec(c.text)?.[1]
  const p = title ? [...c.core.proposals].reverse().find((x) => x.title.replace(/"/g, "'") === title) : undefined
  if (!p) return { text: W.missing, tools: ["kb"] }
  return { text: [W.lead(p.title), p.body, p.decision === null ? W.tail : ""].filter(Boolean).join("\n\n"), tools: ["kb"] }
}

/** The reply to `text` in the current state (pure; exported for tests). */
export function replyFor(text: string, core: CoreState, world: World, pid: string): AgentScript {
  const c: ScriptCtx = { text, core, world, pid }
  const intent = matchIntent(text)
  let part: Part
  switch (intent) {
    case "why":
      part = whyScript(c)
      break
    case "layer":
      part = layerScript(c)
      break
    case "fix":
      part = fixScript(c, serviceIn(text))
      break
    case "quiet":
      part = quietScript(c)
      break
    case "radio":
      part = radioScript(c)
      break
    case "setup":
      part = setupScript(c)
      break
    case "device":
      part = deviceScript(c)
      break
    case "check":
      part = checkScript(c)
      break
    case "fallback":
      return { intent, text: AGENT_COPY.fallback, tools: [], proposal: null, starters: true }
  }
  const tools = [...new Set(part.tools)].slice(0, MAX_TOOL_LINES)
  return { intent, text: part.text, tools, proposal: part.proposal ?? null, starters: false }
}

// ----------------------------------------------------------------------------------- reducer

function row(key: string, role: AgentRow["role"], text: string, extra: Partial<AgentRow> = {}): AgentRow {
  return { key, role, text, tools: [], stopped: false, starters: false, target: null, ...extra }
}

const nextDelay = (live: AgentLive): number =>
  live.toolsShown < live.tools.length || (live.shown === 0 && live.tools.length > 0) ? AGENT_TIMING.toolMs : AGENT_TIMING.wordMs

const isDone = (live: AgentLive): boolean => live.toolsShown >= live.tools.length && live.shown >= live.words.length

/** Write the reply's proposal, unless one for the same target opened in the meantime. */
function writeProposal(state: AgentState, proposal: NewProposal, ctx: SliceCtx): AgentState {
  if (proposal.target && hasOpenFor(ctx.core, proposal.target)) return state
  ctx.dispatch({ type: "core/proposalAdded", proposal })
  return { ...state, proposalSeq: state.proposalSeq + 1, written: [...state.written, proposal.id] }
}

/** The live turn becomes a transcript row (finished: its proposal is written). */
function commit(state: AgentState, live: AgentLive, ctx: SliceCtx): AgentState {
  const done = row(live.key, "assistant", liveText(live), { tools: liveTools(live), starters: live.starters })
  const next: AgentState = { ...state, live: null, rows: [...state.rows, done] }
  return live.proposal ? writeProposal(next, live.proposal, ctx) : next
}

function startTurn(state: AgentState, text: string, instant: boolean, ctx: SliceCtx): AgentState {
  const script = replyFor(text, ctx.core, ctx.world, `agent-p${state.proposalSeq + 1}`)
  const user = row(`u${state.seq + 1}`, "user", text)
  const words = tokenize(script.text)
  const tools = script.tools.map((k) => AGENT_TOOLS[k])
  const live: AgentLive = { key: `a${state.seq + 2}`, words, shown: 0, tools, toolsShown: 0, proposal: script.proposal, starters: script.starters }
  const next: AgentState = { ...state, seq: state.seq + 2, rows: [...state.rows, user], notice: null }
  if (instant) return commit(next, { ...live, shown: words.length, toolsShown: tools.length }, ctx)
  ctx.schedule(nextDelay(live), { type: "agent/step", turn: live.key }, { key: AGENT_STREAM_KEY })
  return { ...next, live }
}

/** Release queued messages while the agent can answer (real session pump). */
function pump(state: AgentState, ctx: SliceCtx): AgentState {
  let next = state
  while (next.live === null && next.queued.length > 0 && agentStateOf(ctx.core.services).canSend) {
    const [first, ...rest] = next.queued
    next = startTurn({ ...next, queued: rest }, first.text, first.instant, ctx)
  }
  return next
}

function step(state: AgentState, action: DemoAction, ctx: SliceCtx): AgentState {
  switch (action.type) {
    case "agent/draft":
      return action.text === state.draft ? state : { ...state, draft: action.text }
    case "agent/stage":
      return { ...state, draft: action.text, staged: state.staged + 1, prepared: null }
    case "agent/dismissPrepared":
      return state.prepared ? { ...state, prepared: null } : state
    case "core/agentPrefill":
      return { ...state, draft: action.text, staged: state.staged + 1, prepared: { from: action.from, text: action.text } }

    case "agent/send": {
      const text = action.text.trim()
      if (text === "" || state.live !== null) return state
      const base: AgentState = { ...state, draft: "", prepared: null }
      const agent = agentStateOf(ctx.core.services)
      if (!agent.canSend || state.queued.length > 0) {
        const q: AgentQueued = { id: `q${state.seq + 1}`, text, instant: action.instant === true }
        return { ...base, seq: state.seq + 1, queued: [...state.queued, q], notice: queuedNoticeFor(agent) }
      }
      return startTurn(base, text, action.instant === true, ctx)
    }
    case "agent/step": {
      const live = state.live
      if (!live || action.turn !== live.key) return state
      const next: AgentLive = live.toolsShown < live.tools.length ? { ...live, toolsShown: live.toolsShown + 1 } : { ...live, shown: live.shown + 1 }
      if (isDone(next)) return commit(state, next, ctx)
      ctx.schedule(nextDelay(next), { type: "agent/step", turn: live.key }, { key: AGENT_STREAM_KEY })
      return { ...state, live: next }
    }
    case "agent/stop": {
      const live = state.live
      if (!live) return state
      ctx.cancel(AGENT_STREAM_KEY)
      const text = liveText(live)
      const tools = liveTools(live)
      if (text.trim() === "" && tools.length === 0) return { ...state, live: null }
      return { ...state, live: null, rows: [...state.rows, row(live.key, "assistant", text, { tools, stopped: true })] }
    }
    case "agent/newConversation":
      ctx.cancel(AGENT_STREAM_KEY)
      return { ...state, conversation: state.conversation + 1, rows: [], live: null, queued: [], notice: null, written: [] }
    case "agent/removeQueued": {
      const queued = state.queued.filter((q) => q.id !== action.id)
      return queued.length === state.queued.length ? state : { ...state, queued, notice: queued.length === 0 ? null : state.notice }
    }

    case "core/proposalAccepted":
    case "core/proposalDismissed": {
      if (!state.written.includes(action.id)) return state
      const before = ctx.prev.core.proposals.find((p) => p.id === action.id)
      const after = ctx.core.proposals.find((p) => p.id === action.id)
      if (!before || before.decision !== null || !after?.decision) return state
      const accepted = after.decision.decision === "accepted"
      const text = accepted ? AGENT_COPY.decided.accepted(after.title) : AGENT_COPY.decided.dismissed(after.title)
      const note = row(`n${state.seq + 1}`, "note", text, { target: accepted ? after.target : null })
      return { ...state, seq: state.seq + 1, rows: [...state.rows, note] }
    }
    default:
      return state
  }
}

export function reduceAgent(state: AgentState, action: DemoAction, ctx: SliceCtx): AgentState {
  return pump(step(state, action, ctx), ctx)
}

/** Open proposals are counted by core (needsYou); the chat adds no rows of its own. */
export function needsAgent(): readonly NeedItem[] {
  return NO_NEEDS
}
