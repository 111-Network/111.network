// The CORE slice and the cross-view action catalog (plan §6.3–6.5). Plain TS: no React.
//
// Core owns what more than one view reads or changes: the route, layout and mode, the service
// registry, the attached radio board, the joined network, the internet, heard nodes, proposals,
// the agent prefill and the named-cause events log. View slices (engine/slices/*.ts) react to
// these actions; they never write core state except by dispatching a "core/…" action.
import { BRIDGE_REASON, EVENT_LINE, EVENT_TEXT, MEDIUM_LABEL, RADIO_STAGE_REASON, SERVICE_COPY, meshJoinedReason, radioLiveReason } from "../copy/core"
import { AGENT_PATH, parsePath, sameRoute, type DemoRoute } from "./router"
import type {
  CauseId,
  KnownCause,
  LayoutPref,
  Medium,
  NetworkId,
  NetworkTry,
  PeerId,
  RadioStage,
  ReduceCtx,
  ServiceId,
  ServiceState,
  UiMode,
  DemoEvent,
} from "./types"
import { networkById, nodeName, type DemoService, type World } from "./world"

/** Virtual durations of the timed steps (ms). Every timed step goes through the scheduler. */
export const TIMING = {
  /** STARTING blink before LIVE. */
  startingMs: 1600,
  /** The consented one-time identify. */
  identifyMs: 1500,
  /** Writing firmware. */
  flashMs: 3200,
  /** One rung of the preferred-network seek. */
  seekStepMs: 900,
  /** Between two nodes blipping in. */
  heardGapMs: 1200,
} as const

/** The events log keeps the newest this many entries. */
export const EVENT_LOG_LIMIT = 200

export const RADIO_BOARD_ID = "radio-board"

export interface RadioBoard {
  id: typeof RADIO_BOARD_ID
  /** Detected name, plain words ("USB radio board"). */
  name: string
  /** The name the user gave it, or null. The flash confirm types `alias ?? name`. */
  alias: string | null
  stage: RadioStage
  /** The one-time identify consent was given. */
  consent: boolean
  /** "none" until flashed. */
  firmware: "none" | "mesh"
  region: string | null
  /** Virtual ms of the last stage change. */
  since: number
}

export interface TransportState {
  /** The preferred network this node joined, or null (alone on the mesh). */
  joined: NetworkId | null
  /** The seek ladder: each preferred network on the last try. */
  tries: Readonly<Record<NetworkId, NetworkTry>>
  seeking: boolean
}

export interface HeardEntry {
  id: PeerId
  /** How it was heard most recently. */
  via: Medium
  /** Why it was heard most recently: the cause of its latest blip ("radio-ready", "custody-ack", "listen-burst" …). */
  cause: CauseId
  /** Why it was heard at all: the cause of its first blip. */
  firstCause: CauseId
  firstAt: number
  lastAt: number
  /** Times heard. */
  count: number
  /** core.blipSeq at its latest hear: key one radar blip per hear with `${id}:${blip}`. */
  blip: number
}

export type ProposalKind = "setup" | "fix" | "diagnose" | "change"

/** A proposal card (real `Proposal`, plain words). Accept/Dismiss are core actions. */
export interface DemoProposal {
  id: string
  kind: ProposalKind
  title: string
  /** Plain text; paragraphs separated by a blank line. */
  body: string
  /** The service that goes STARTING -> LIVE on accept, or null. */
  target: ServiceId | null
  /** Who wrote it: "agent" (chat), "repairs", or another slice name. */
  from: string
  cause: CauseId | null
  createdAt: number
  decision: null | { decision: "accepted" | "dismissed"; at: number }
}

export interface NewProposal {
  /** Stable and unique, chosen by the slice that writes it ("repairs-fix-1"), so it can follow its own proposal. */
  id: string
  kind: ProposalKind
  title: string
  body: string
  target?: ServiceId | null
  from?: string
  cause?: CauseId | null
}

/** A prompt prepared for the Agent view (real `StagedPrompt`): shown in the composer, never auto-sent. */
export interface AgentPrefill {
  seq: number
  text: string
  /** Banner label: "prepared from: Identity · L2". */
  from: string
}

export interface CoreState {
  /**
   * Virtual ms of the latest action that changed core. Use it for "2 min ago": it moves only when
   * core changes (an action core ignores, or one only a slice handles, leaves it and core as they
   * were). Slices stamp their own records with ctx.now.
   */
  now: number
  /** null on the server and until the url router has read the hash (store.start). */
  route: DemoRoute | null
  /** +1 on every route change: the shell scrolls main to the top and moves focus on it. */
  navCount: number
  /** Fixed by createDemoStore options. */
  layout: LayoutPref
  mode: UiMode
  /** Only meaningful with layout "auto" (forced layouts ignore toggles). */
  railCollapsed: boolean
  drawerOpen: boolean
  /** This node's editable name (Settings L2), shown by the node chip. Starts as world.self.name. */
  alias: string
  /** The registry, in sidebar order. */
  services: readonly DemoService[]
  radio: RadioBoard | null
  transport: TransportState
  internet: "offline" | "connected"
  /** Heard nodes, in the order first heard. */
  heard: readonly HeardEntry[]
  /** +1 on every core/heardNode (every blip), never reused. */
  blipSeq: number
  /** Newest last, at most EVENT_LOG_LIMIT. */
  events: readonly DemoEvent[]
  /** seq of the newest event (0 = none yet). */
  eventSeq: number
  /** Newest last. */
  proposals: readonly DemoProposal[]
  prefill: AgentPrefill | null
  prefillSeq: number
}

export interface CoreInit {
  layout: LayoutPref
  route: DemoRoute | null
}

/** The seek ladder when the demo opens: the node already went down its list once and nothing was in range. */
export const OPENING_TRIES: Readonly<Record<NetworkId, NetworkTry>> = { "network-a": "no signal", "network-b": "no signal", "network-c": "no signal" }

/**
 * Service pages are the advanced part of the dashboard (owner, 2026-10-17): the sidebar lists them
 * in advanced mode only, so opening one (a link, a deep link) switches the mode to advanced.
 */
export function needsAdvanced(route: DemoRoute | null): boolean {
  return route?.view === "service"
}

export function initialCore(world: World, init: CoreInit): CoreState {
  return {
    now: 0,
    route: init.route,
    navCount: 0,
    layout: init.layout,
    mode: needsAdvanced(init.route) ? "advanced" : "simple",
    railCollapsed: init.layout === "rail",
    drawerOpen: false,
    alias: world.self.name,
    services: world.services,
    radio: null,
    transport: {
      joined: null,
      // The node already went down its list once: nothing in range, so messages wait on the device.
      tries: OPENING_TRIES,
      seeking: false,
    },
    internet: "offline",
    heard: [],
    blipSeq: 0,
    events: [],
    eventSeq: 0,
    proposals: [],
    prefill: null,
    prefillSeq: 0,
  }
}

// ------------------------------------------------------------------------------------ actions

export type CoreAction =
  /** Go to a route string ("/devices", "/overview#needs-you"). Closes the drawer. Prefer store.navigate(). */
  | { type: "core/navigate"; path: string; replace?: boolean }
  | { type: "core/setMode"; mode: UiMode }
  | { type: "core/toggleRail" }
  | { type: "core/setRail"; collapsed: boolean }
  | { type: "core/setDrawer"; open: boolean }
  /** Rename this node (Settings L2 alias). Empty goes back to the world's name. */
  | { type: "core/renameNode"; alias: string }
  /**
   * Move a service. "starting" blinks, then turns LIVE after `liveAfterMs` (default TIMING.startingMs)
   * through the scheduler. "starting"/"live" are ignored while the service cannot start
   * (canStartService). `reason` overrides the default sentence for that state.
   * `instant` (reduced motion): every timed step this sets off lands in the same dispatch, so the
   * views only ever see the end state. The same flag exists on every core action that schedules.
   */
  | { type: "core/serviceTransition"; id: ServiceId; to: ServiceState; reason?: string; liveAfterMs?: number; instant?: boolean }
  /** The radio board's life; each is ignored unless the board is in the stage before it. */
  | { type: "core/radioPlugged" }
  | { type: "core/radioAllowed"; instant?: boolean }
  | { type: "core/radioIdentified" }
  | { type: "core/radioFlash"; instant?: boolean }
  | { type: "core/radioFlashed" }
  | { type: "core/radioRegionSet"; region: string; instant?: boolean }
  | { type: "core/radioRenamed"; alias: string | null }
  | { type: "core/radioRemoved" }
  /** A preferred network was found. With cause "radio-ready" the first radio nodes blip in, one by one (the first at once). */
  | { type: "core/transportJoined"; network: NetworkId; cause: CauseId; instant?: boolean }
  | { type: "core/internetConnected"; instant?: boolean }
  | { type: "core/internetLost" }
  /**
   * A node was heard (one radar blip). Every blip carries its cause. Emits a "node-heard" event
   * ("Heard Ridge repeater over long-range radio.") unless `quiet` (a slice that emits its own
   * sentence for a burst passes quiet).
   */
  | { type: "core/heardNode"; id: PeerId; via: Medium; cause: CauseId; quiet?: boolean }
  /** Append to the events log. Prefer ctx.emit() inside reducers. */
  | { type: "core/emitEvent"; cause: CauseId; text?: string; ref?: string | null }
  /** Stage a prompt for the Agent and open it ("Ask the agent about {layer}", "Set up with the agent"). */
  | { type: "core/agentPrefill"; text: string; from: string }
  /** The Agent view took the prefill into its composer. */
  | { type: "core/prefillTaken" }
  | { type: "core/proposalAdded"; proposal: NewProposal }
  /**
   * Accept: the target goes STARTING -> LIVE. If the target cannot start now (canStartService false),
   * the accept is REFUSED: the proposal stays open and a "proposal-blocked" event says why.
   */
  | { type: "core/proposalAccepted"; id: string; instant?: boolean }
  | { type: "core/proposalDismissed"; id: string }

// ------------------------------------------------------------------------------------ helpers

/** Can `id` go STARTING / LIVE right now? (radio: region set; bridge: radio live plus a hotspot or ethernet; gateway: internet.) */
export function canStartService(core: Pick<CoreState, "radio" | "services" | "internet">, world: World, id: ServiceId): boolean {
  switch (id) {
    case "radio":
      return core.radio?.stage === "ready"
    case "bridge":
      return bridgeReadyOf(core, world)
    case "gateway":
      return core.internet === "connected"
    default:
      return true
  }
}

/** The bootstrap rule (plan §6.8): a bridge only with a live radio plus Wi-Fi that can host a hotspot, or ethernet. */
export function bridgeReadyOf(core: Pick<CoreState, "radio" | "services">, world: World): boolean {
  const radioLive = core.services.some((s) => s.id === "radio" && s.state === "live")
  return radioLive && (world.self.facts.hotspot || world.self.facts.ethernet)
}

function bridgeUnsetReason(core: CoreState, world: World): string {
  const radioLive = core.services.some((s) => s.id === "radio" && s.state === "live")
  if (!radioLive) return BRIDGE_REASON.needsRadio
  return bridgeReadyOf(core, world) ? BRIDGE_REASON.ready : BRIDGE_REASON.needsLink
}

function liveReason(core: CoreState, world: World, id: ServiceId): string {
  if (id === "radio" && core.radio?.region) return radioLiveReason(core.radio.region)
  if (id === "mesh" && core.transport.joined) return meshJoinedReason(networkById(world, core.transport.joined).name)
  return SERVICE_COPY[id].reasons.live
}

function unsetReason(core: CoreState, world: World, id: ServiceId): string {
  if (id === "radio" && core.radio) return RADIO_STAGE_REASON[core.radio.stage]
  if (id === "bridge") return bridgeUnsetReason(core, world)
  return SERVICE_COPY[id].reasons.unset
}

function defaultReason(core: CoreState, world: World, id: ServiceId, to: ServiceState): string {
  if (to === "live") return liveReason(core, world, id)
  if (to === "unset") return unsetReason(core, world, id)
  return SERVICE_COPY[id].reasons[to]
}

function findService(core: CoreState, id: ServiceId): DemoService | undefined {
  return core.services.find((s) => s.id === id)
}

function patchService(core: CoreState, id: ServiceId, patch: Partial<DemoService>, now: number): CoreState {
  let changed = false
  const services = core.services.map((s) => {
    if (s.id !== id) return s
    const next = { ...s, ...patch }
    if (patch.state !== undefined && patch.state !== s.state) next.since = now
    if (next.state === s.state && next.reason === s.reason) return s
    changed = true
    return next
  })
  return changed ? { ...core, services } : core
}

/** Refresh the reason of a service that is not live/starting/error (e.g. the radio while it changes stage). */
function refreshUnset(core: CoreState, world: World, id: ServiceId, now: number): CoreState {
  const s = findService(core, id)
  if (!s || s.state !== "unset") return core
  return patchService(core, id, { reason: unsetReason(core, world, id) }, now)
}

const serviceKey = (id: ServiceId): string => `service:${id}`

/**
 * A timed follow-up: through the scheduler after `ms`, or (instant, reduced motion) as a follow-up
 * of this same dispatch, so listeners hear only the end state.
 */
function later(ctx: ReduceCtx, instant: boolean | undefined, ms: number, action: CoreAction, key: string): void {
  if (instant) {
    ctx.cancel(key)
    ctx.dispatch(action)
  } else {
    ctx.schedule(ms, action, { key })
  }
}

/** One service transition with its side effects (the reducer's only path to change a state). */
function transition(
  core: CoreState,
  ctx: ReduceCtx,
  id: ServiceId,
  to: ServiceState,
  opts: { reason?: string; liveAfterMs?: number; instant?: boolean } = {},
): CoreState {
  const svc = findService(core, id)
  if (!svc) return core
  if ((to === "starting" || to === "live") && !canStartService(core, ctx.world, id)) return core
  const before = svc.state
  let next = patchService(core, id, { state: to, reason: opts.reason ?? defaultReason(core, ctx.world, id, to) }, ctx.now)
  if (to === "starting") {
    later(ctx, opts.instant, opts.liveAfterMs ?? TIMING.startingMs, { type: "core/serviceTransition", id, to: "live", instant: opts.instant }, serviceKey(id))
  } else {
    ctx.cancel(serviceKey(id))
  }
  if (to === "live" && before !== "live") {
    ctx.emit("service-live", { text: EVENT_LINE.serviceLive(svc.name), ref: id })
    next = afterLive(next, ctx, id, opts.instant)
  }
  if (to === "error" && before !== "error") ctx.emit("service-error", { text: EVENT_LINE.serviceError(svc.name), ref: id })
  if (id === "radio") next = refreshUnset(next, ctx.world, "bridge", ctx.now)
  return next
}

/** What a service going LIVE sets in motion. */
function afterLive(core: CoreState, ctx: ReduceCtx, id: ServiceId, instant: boolean | undefined): CoreState {
  if (id !== "radio") return core
  ctx.emit("radio-ready", { ref: RADIO_BOARD_ID })
  if (core.transport.joined !== null) return core
  // Layer 6: try the preferred list in order; with the radio up, Network A answers first.
  later(ctx, instant, TIMING.seekStepMs, { type: "core/transportJoined", network: "network-a", cause: "radio-ready", instant }, "transport:seek")
  return { ...core, transport: { joined: null, tries: { "network-a": "trying", "network-b": "not tried", "network-c": "not tried" }, seeking: true } }
}

function setRadio(core: CoreState, world: World, patch: Partial<RadioBoard>, now: number): CoreState {
  if (!core.radio) return core
  const radio = { ...core.radio, ...patch, since: patch.stage !== undefined && patch.stage !== core.radio.stage ? now : core.radio.since }
  return refreshUnset({ ...core, radio }, world, "radio", now)
}

/** The radio nodes the board hears first, in blip order. */
const FIRST_HEARD: readonly PeerId[] = ["ridge-repeater", "valley-hub", "bram"]

// ------------------------------------------------------------------------------------ reducer

const heardKey = (id: PeerId): string => `heard:radio:${id}`

/**
 * The core reducer. Returns `state` itself when the action changes nothing, so an ignored action
 * (or one only a slice handles) never wakes a subscriber; `now` moves only with a real change.
 */
export function reduceCore(state: CoreState, action: CoreAction | { type: string }, ctx: ReduceCtx): CoreState {
  const next = step(state, action as CoreAction, ctx)
  return next === state || next.now === ctx.now ? next : { ...next, now: ctx.now }
}

function step(s: CoreState, a: CoreAction, ctx: ReduceCtx): CoreState {
  const { world } = ctx
  switch (a.type) {
    case "core/navigate": {
      const route = parsePath(a.path)
      if (sameRoute(s.route, route)) return s.drawerOpen ? { ...s, drawerOpen: false } : s
      return { ...s, route, navCount: s.navCount + 1, drawerOpen: false, mode: needsAdvanced(route) ? "advanced" : s.mode }
    }
    case "core/setMode":
      return s.mode === a.mode ? s : { ...s, mode: a.mode }
    case "core/toggleRail":
      return s.layout === "auto" ? { ...s, railCollapsed: !s.railCollapsed } : s
    case "core/setRail":
      return s.layout !== "auto" || s.railCollapsed === a.collapsed ? s : { ...s, railCollapsed: a.collapsed }
    case "core/setDrawer":
      return s.drawerOpen === a.open ? s : { ...s, drawerOpen: a.open }
    case "core/renameNode": {
      const alias = a.alias.trim() || world.self.name
      return alias === s.alias ? s : { ...s, alias }
    }

    case "core/serviceTransition":
      return transition(s, ctx, a.id, a.to, { reason: a.reason, liveAfterMs: a.liveAfterMs, instant: a.instant })

    case "core/radioPlugged": {
      if (s.radio) return s
      const radio: RadioBoard = { id: RADIO_BOARD_ID, name: world.radioBoardName, alias: null, stage: "plugged", consent: false, firmware: "none", region: null, since: ctx.now }
      ctx.emit("radio-plugged", { ref: RADIO_BOARD_ID })
      return refreshUnset({ ...s, radio }, world, "radio", ctx.now)
    }
    case "core/radioAllowed": {
      if (s.radio?.stage !== "plugged") return s
      later(ctx, a.instant, TIMING.identifyMs, { type: "core/radioIdentified" }, "radio:step")
      return setRadio(s, world, { stage: "identifying", consent: true }, ctx.now)
    }
    case "core/radioIdentified": {
      if (s.radio?.stage !== "identifying") return s
      ctx.emit("radio-identified", { ref: RADIO_BOARD_ID })
      return setRadio(s, world, { stage: "identified" }, ctx.now)
    }
    case "core/radioFlash": {
      if (s.radio?.stage !== "identified") return s
      later(ctx, a.instant, TIMING.flashMs, { type: "core/radioFlashed" }, "radio:step")
      return setRadio(s, world, { stage: "flashing" }, ctx.now)
    }
    case "core/radioFlashed": {
      if (s.radio?.stage !== "flashing") return s
      ctx.emit("radio-flashed", { ref: RADIO_BOARD_ID })
      return setRadio(s, world, { stage: "flashed", firmware: "mesh" }, ctx.now)
    }
    case "core/radioRegionSet": {
      const region = a.region.trim()
      if (region === "" || (s.radio?.stage !== "flashed" && s.radio?.stage !== "ready")) return s
      if (s.radio.stage === "ready" && s.radio.region === region) return s
      const next = setRadio(s, world, { stage: "ready", region }, ctx.now)
      return transition(next, ctx, "radio", "starting", { reason: RADIO_STAGE_REASON.ready, instant: a.instant })
    }
    case "core/radioRenamed": {
      if (!s.radio) return s
      const alias = a.alias?.trim() || null
      return alias === s.radio.alias ? s : { ...s, radio: { ...s.radio, alias } }
    }
    case "core/radioRemoved": {
      if (!s.radio) return s
      ctx.cancel("radio:step")
      ctx.cancel("transport:seek")
      for (const id of FIRST_HEARD) ctx.cancel(heardKey(id))
      // The board was the only way to hear radio nodes: they leave the heard list with it.
      let next: CoreState = { ...s, radio: null, heard: s.heard.filter((h) => h.via !== "radio") }
      next = transition(next, ctx, "radio", "unset")
      const bridge = findService(next, "bridge")
      if (bridge && bridge.state !== "unset") next = transition(next, ctx, "bridge", "unset")
      const radioNet = next.transport.joined !== null && networkById(world, next.transport.joined).needsRadio
      if (radioNet || next.transport.seeking) {
        // Back to the opening ladder: nothing in range without the board.
        next = { ...next, transport: { joined: null, tries: OPENING_TRIES, seeking: false } }
        const mesh = findService(next, "mesh")
        if (mesh?.state === "live") next = patchService(next, "mesh", { reason: liveReason(next, world, "mesh") }, ctx.now)
      }
      return next
    }

    case "core/transportJoined": {
      const tries = { ...s.transport.tries }
      let hit = false
      for (const n of world.networks) {
        if (hit) tries[n.id] = "not tried"
        else if (n.id === a.network) {
          tries[n.id] = "found"
          hit = true
        } else tries[n.id] = "no signal"
      }
      let next: CoreState = { ...s, transport: { joined: a.network, tries, seeking: false } }
      const mesh = findService(next, "mesh")
      if (mesh?.state === "live") next = patchService(next, "mesh", { reason: liveReason(next, world, "mesh") }, ctx.now)
      ctx.emit("network-joined", { text: EVENT_LINE.networkJoined(networkById(world, a.network).name), ref: a.network })
      if (a.cause === "radio-ready") {
        // The first node is heard in the same moment the network is joined (so "joined" never reads
        // "a nearby node has been heard" over an empty list); the others follow one by one.
        FIRST_HEARD.forEach((id, i) => {
          const blip: CoreAction = { type: "core/heardNode", id, via: "radio", cause: "radio-ready" }
          later(ctx, a.instant || i === 0, TIMING.heardGapMs * i, blip, heardKey(id))
        })
      }
      return next
    }

    case "core/internetConnected": {
      if (s.internet === "connected") return s
      ctx.emit("internet-connected", { ref: "gateway" })
      return transition({ ...s, internet: "connected" }, ctx, "gateway", "starting", { instant: a.instant })
    }
    case "core/internetLost": {
      if (s.internet === "offline") return s
      ctx.emit("internet-lost", { ref: "gateway" })
      return transition({ ...s, internet: "offline" }, ctx, "gateway", "unset")
    }

    case "core/heardNode": {
      const blip = s.blipSeq + 1
      if (!a.quiet) ctx.emit("node-heard", { text: EVENT_LINE.nodeHeard(nodeName(world, a.id), MEDIUM_LABEL[a.via]), ref: a.id })
      const i = s.heard.findIndex((h) => h.id === a.id)
      if (i < 0) {
        const entry: HeardEntry = { id: a.id, via: a.via, cause: a.cause, firstCause: a.cause, firstAt: ctx.now, lastAt: ctx.now, count: 1, blip }
        return { ...s, blipSeq: blip, heard: [...s.heard, entry] }
      }
      const heard = s.heard.slice()
      heard[i] = { ...heard[i], via: a.via, cause: a.cause, lastAt: ctx.now, count: heard[i].count + 1, blip }
      return { ...s, blipSeq: blip, heard }
    }

    case "core/emitEvent": {
      const seq = s.eventSeq + 1
      const text = a.text ?? (EVENT_TEXT as Record<string, string>)[a.cause] ?? ""
      const event: DemoEvent = { seq, cause: a.cause, at: ctx.now, text, ref: a.ref ?? null }
      const events = s.events.length >= EVENT_LOG_LIMIT ? [...s.events.slice(s.events.length - EVENT_LOG_LIMIT + 1), event] : [...s.events, event]
      return { ...s, events, eventSeq: seq }
    }

    case "core/agentPrefill": {
      const prefillSeq = s.prefillSeq + 1
      const route = parsePath(AGENT_PATH)
      const moved = !sameRoute(s.route, route)
      return {
        ...s,
        prefillSeq,
        prefill: { seq: prefillSeq, text: a.text, from: a.from },
        route,
        navCount: moved ? s.navCount + 1 : s.navCount,
        drawerOpen: false,
      }
    }
    case "core/prefillTaken":
      return s.prefill === null ? s : { ...s, prefill: null }

    case "core/proposalAdded": {
      if (s.proposals.some((p) => p.id === a.proposal.id)) return s
      const p = a.proposal
      const proposal: DemoProposal = {
        id: p.id,
        kind: p.kind,
        title: p.title,
        body: p.body,
        target: p.target ?? null,
        from: p.from ?? "agent",
        cause: p.cause ?? null,
        createdAt: ctx.now,
        decision: null,
      }
      ctx.emit("proposal-added", { text: EVENT_LINE.proposalAdded(p.title), ref: p.id })
      return { ...s, proposals: [...s.proposals, proposal] }
    }
    case "core/proposalAccepted":
    case "core/proposalDismissed": {
      const accepted = a.type === "core/proposalAccepted"
      const i = s.proposals.findIndex((p) => p.id === a.id)
      if (i < 0 || s.proposals[i].decision !== null) return s
      const target = s.proposals[i].target ? findService(s, s.proposals[i].target) : undefined
      const moves = accepted && target !== undefined && target.state !== "live" && target.state !== "starting"
      if (moves && !canStartService(s, world, target.id)) {
        // Refused: the proposal stays open and the log says why (the target's own reason sentence).
        ctx.emit("proposal-blocked", { text: EVENT_LINE.proposalBlocked(target.name, target.reason), ref: a.id })
        return s
      }
      const proposals = s.proposals.slice()
      const p = { ...proposals[i], decision: { decision: accepted ? ("accepted" as const) : ("dismissed" as const), at: ctx.now } }
      proposals[i] = p
      ctx.emit(accepted ? "proposal-accepted" : "proposal-dismissed", { ref: p.id })
      const next: CoreState = { ...s, proposals }
      return moves ? transition(next, ctx, target.id, "starting", { instant: a.type === "core/proposalAccepted" ? a.instant : undefined }) : next
    }
    default:
      return s
  }
}

/** Every known cause, for tests and for views that switch on causes. */
export const KNOWN_CAUSES = Object.keys(EVENT_TEXT) as KnownCause[]
