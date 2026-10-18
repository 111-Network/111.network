// Services slice: the service page TEMPLATE (#/services/<id> for the Local AI agent, Local model, Mesh
// link, Long-range radio, Knowledge base and Messaging). The Internet gateway, Bridge, Storage and
// Repairs have their own slices. Real source: os/40-interface/ui/src/views/services/model.ts (restart
// phases, KIND_LABEL) + log.tsx (the log tail) + lib/api/mock/fixtures.ts (the sample log lines).
//
// What it keeps:
//   logs        one short log per template service: a sample history from before the demo opened,
//               then a line for every caused change (a state or reason change of that service in the
//               registry, a Restart, and the few events that belong to it: nodes heard, messages
//               handed to the home hub, proposals). Nothing is added while idle.
//   restarting  services whose Restart was pressed and that have not settled yet; their button reads
//               "Restarting…" (real RestartPhase "waiting"), every other STARTING service offers none.
//
// Restart (real: offered only for the children the node runs itself, `actions: ["restart"]`) goes
// through core: "services/restart" -> core/serviceTransition to "starting" -> LIVE via the scheduler.
import { SERVICES_COPY, type ServiceKindWord } from "../../copy/services"
import { DOT_LABEL } from "../../ui/status"
import { HOUR, MIN, SEC } from "../clock"
import { TIMING, type CoreState } from "../core"
import { NO_NEEDS, type DemoEvent, type NeedItem, type ServiceId, type SliceCtx } from "../types"
import { nodeName, type World } from "../world"
import type { DemoAction } from "./index"

/** The services that use the template, in registry order. */
export const TEMPLATE_SERVICES = ["agent", "model", "mesh", "radio", "kb", "messaging"] as const satisfies readonly ServiceId[]

export type TemplateServiceId = (typeof TEMPLATE_SERVICES)[number]

export function isTemplateService(id: string): id is TemplateServiceId {
  return (TEMPLATE_SERVICES as readonly string[]).includes(id)
}

/**
 * How each one runs (real registry `kind`): the agent, the model and the mesh link are programs the node
 * starts and supervises; the radio is detected hardware; the knowledge base and messaging are built in.
 */
export const SERVICE_KIND: Readonly<Record<TemplateServiceId, ServiceKindWord>> = {
  agent: "child",
  model: "child",
  mesh: "child",
  radio: "detected",
  kb: "builtin",
  messaging: "builtin",
}

/** Real rule: Restart only for the children the node supervises (registry `actions` has "restart"). */
export function canRestartService(id: string): boolean {
  return isTemplateService(id) && SERVICE_KIND[id] === "child"
}

/** STARTING -> LIVE after a restart (virtual ms). Loading the model takes longer than starting a program. */
export const RESTART_LIVE_MS: Readonly<Partial<Record<TemplateServiceId, number>>> = { model: 2 * TIMING.startingMs }

/** Lines kept per log (the advanced view shows them all; simple mode the newest few). */
export const LOG_KEEP = 40

export interface ServiceLogLine {
  /** "h-<service>-<n>" for the sample history, "l<seq>" for lines added during the visit. */
  id: string
  /** Virtual ms (see clock.ts); negative = before the demo opened. */
  at: number
  text: string
}

export interface ServicesState {
  /** Counter for line ids (never derived from the clock). */
  seq: number
  logs: Readonly<Record<TemplateServiceId, readonly ServiceLogLine[]>>
  /** Restart pressed, not settled yet (registry order of the presses). */
  restarting: readonly TemplateServiceId[]
}

export type ServicesAction =
  /** Restart a supervised service: ignored unless it is LIVE or in ERROR (real: offered only then). */
  { type: "services/restart"; id: ServiceId; instant?: boolean }

// ------------------------------------------------------------------------------- sample history

type HistoryEntry = readonly [at: number, text: string]

const OPENED = -7 * HOUR

/** The hours before the demo opened (the registry has every template service in its state since 7 h ago). */
function historyOf(world: World): Record<TemplateServiceId, readonly ServiceLogLine[]> {
  const h = SERVICES_COPY.history
  const hub = nodeName(world, world.homeHub)
  const entries: Record<TemplateServiceId, readonly HistoryEntry[]> = {
    agent: [
      [OPENED, h.agent.started],
      [OPENED + 2 * SEC, h.agent.kb],
      [OPENED + 3 * SEC, h.agent.model],
      [OPENED + 4 * SEC, h.agent.health],
      [-15 * MIN, h.agent.health],
    ],
    model: [
      [OPENED, h.model.loading],
      [OPENED + 38 * SEC, h.model.loaded],
      [OPENED + 39 * SEC, h.model.health],
      [-40 * MIN, h.model.turn],
      [-15 * MIN, h.model.health],
    ],
    mesh: [
      [OPENED, h.mesh.started],
      ...world.networks.map(
        (n, i): HistoryEntry => [OPENED + (i + 1) * SEC, n.needsRadio ? h.mesh.triedNoBoard(n.name, n.mediumLabel) : h.mesh.tried(n.name, n.mediumLabel)],
      ),
      [OPENED + (world.networks.length + 1) * SEC, h.mesh.none],
    ],
    radio: [
      [OPENED, h.radio.none],
      [OPENED + SEC, h.radio.quiet],
    ],
    kb: [
      [OPENED, h.kb.opened],
      [OPENED + SEC, h.kb.verified],
      [OPENED + 2 * SEC, h.kb.ready],
    ],
    messaging: [
      [OPENED, h.messaging.opened],
      [OPENED + SEC, h.messaging.hub(hub)],
      [OPENED + 2 * SEC, h.messaging.ready],
    ],
  }
  const out = {} as Record<TemplateServiceId, readonly ServiceLogLine[]>
  for (const id of TEMPLATE_SERVICES) out[id] = entries[id].map(([at, text], i) => ({ id: `h-${id}-${i + 1}`, at, text }))
  return out
}

export function initialServices(world: World): ServicesState {
  return { seq: 0, logs: historyOf(world), restarting: [] }
}

// ------------------------------------------------------------------------------------ reducer

/**
 * Events that change no service but belong in one's log. State and reason changes are logged from the
 * registry itself (so "radio-plugged", "network-joined" or "service-live" would only repeat them).
 */
const EVENT_LOG: Readonly<Partial<Record<string, TemplateServiceId>>> = {
  "node-heard": "mesh",
  "listen-burst": "mesh",
  "message-sent": "messaging",
  "custody-ack": "messaging",
  delivered: "messaging",
  "queue-flushed": "messaging",
  "proposal-added": "agent",
  "proposal-accepted": "agent",
  "proposal-dismissed": "agent",
  "proposal-blocked": "agent",
}

/** The logs an event lands in. A node heard over long-range radio is in the radio's log too. */
export function eventLogTargets(event: Pick<DemoEvent, "cause" | "ref">, core: Pick<CoreState, "heard">): TemplateServiceId[] {
  const target = EVENT_LOG[event.cause]
  if (!target) return []
  if (event.cause === "node-heard" && core.heard.some((h) => h.id === event.ref && h.via === "radio")) return ["mesh", "radio"]
  return [target]
}

function append(state: ServicesState, id: TemplateServiceId, at: number, text: string): ServicesState {
  if (text === "") return state
  const seq = state.seq + 1
  const line: ServiceLogLine = { id: `l${seq}`, at, text }
  const old = state.logs[id]
  const lines = old.length >= LOG_KEEP ? [...old.slice(old.length - LOG_KEEP + 1), line] : [...old, line]
  return { ...state, seq, logs: { ...state.logs, [id]: lines } }
}

function restart(state: ServicesState, id: ServiceId, instant: boolean | undefined, ctx: SliceCtx): ServicesState {
  if (!isTemplateService(id) || !canRestartService(id) || state.restarting.includes(id)) return state
  const svc = ctx.core.services.find((s) => s.id === id)
  if (!svc || (svc.state !== "live" && svc.state !== "error")) return state
  ctx.emit("services/restart", { text: SERVICES_COPY.restart.event(svc.name), ref: id })
  ctx.dispatch({ type: "core/serviceTransition", id, to: "starting", liveAfterMs: RESTART_LIVE_MS[id], instant })
  return { ...append(state, id, ctx.now, SERVICES_COPY.restart.logged), restarting: [...state.restarting, id] }
}

/** The newest event, if this very action appended it (core reduced "core/emitEvent" just before us). */
function addedEvent(ctx: SliceCtx): DemoEvent | null {
  if (ctx.core.eventSeq === ctx.prev.core.eventSeq) return null
  const ev = ctx.core.events[ctx.core.events.length - 1]
  return ev && ev.seq === ctx.core.eventSeq ? ev : null
}

/** A line for each template service whose state or reason changed in this action. */
function logRegistry(state: ServicesState, ctx: SliceCtx): ServicesState {
  let next = state
  for (const id of TEMPLATE_SERVICES) {
    const before = ctx.prev.core.services.find((s) => s.id === id)
    const after = ctx.core.services.find((s) => s.id === id)
    if (!before || !after || before === after) continue
    if (before.state !== after.state) next = append(next, id, ctx.now, SERVICES_COPY.log.stateLine(DOT_LABEL[after.state], after.reason))
    else if (before.reason !== after.reason) next = append(next, id, ctx.now, after.reason)
    if (after.state !== "starting" && next.restarting.includes(id)) next = { ...next, restarting: next.restarting.filter((x) => x !== id) }
  }
  return next
}

export function reduceServices(state: ServicesState, action: DemoAction, ctx: SliceCtx): ServicesState {
  let next = state
  if (action.type === "services/restart") next = restart(next, action.id, action.instant, ctx)
  if (action.type === "core/emitEvent") {
    const ev = addedEvent(ctx)
    if (ev) for (const id of eventLogTargets(ev, ctx.core)) next = append(next, id, ev.at, ev.text)
  }
  if (ctx.prev.core.services !== ctx.core.services) next = logRegistry(next, ctx)
  return next
}

/** Service errors and NOT SET rows already come from core's registry rules; the template adds none. */
export function needsServices(): readonly NeedItem[] {
  return NO_NEEDS
}
