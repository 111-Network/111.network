// Derived values (plan §6.3–6.4), following the real dashboard's rules: `lib/verdict.ts`,
// `views/overview/model.ts`, `lib/attention.ts`, `lib/nav.ts`. Pure; results are cached per state
// object, so the same state always returns the same reference (safe for useDemo).
import {
  ATTENTION_COPY,
  CHECKLIST_COPY,
  DEVICE_COPY,
  LAYER_PAGES,
  NEARBY_SENTENCE,
  NEEDS_COPY,
  OWN_FACT_LINES,
  RADIO_STAGE_REASON,
  ROUTE_TITLES,
  SERVICE_NOUN,
  VERDICT_COPY,
} from "../copy/core"
import { deviceById } from "@/lib/devices"
import { bridgeReadyOf, canStartService, RADIO_BOARD_ID, type CoreState, type DemoProposal, type HeardEntry } from "./core"
import { PATHS, type DemoRoute } from "./router"
import { sliceNeeds, type DemoState } from "./slices"
import type { CauseId, DemoEvent, LayoutPref, NeedItem, RadioStage, ServiceId, ServiceState } from "./types"
import type { DemoService, World } from "./world"

// ------------------------------------------------------------------------------------ caching

/** Structural equality of plain data (strings, numbers, booleans, null, arrays, plain objects). */
export function samePlain(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  const ka = Object.keys(ra)
  if (ka.length !== Object.keys(rb).length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && samePlain(ra[k], rb[k]))
}

/**
 * Cached per state object, and STABLE: a result equal (samePlain) to the previous one is returned
 * as the previous reference, so a view re-renders only when the value really changed (an agent
 * reply streaming word by word does not re-render Overview).
 */
function memoState<R>(fn: (s: DemoState) => R): (s: DemoState) => R {
  const cache = new WeakMap<DemoState, R>()
  let seen = false
  let last: R | undefined
  return (s) => {
    if (cache.has(s)) return cache.get(s) as R
    let r = fn(s)
    if (seen && samePlain(last, r)) r = last as R
    seen = true
    last = r
    cache.set(s, r)
    return r
  }
}

/**
 * memoState for selectors that also read the (static) world: cached per world and state, stable
 * per world. Read them in a component with useDemoWorld(selector) (engine/react.tsx).
 */
function memoWorld<R>(fn: (s: DemoState, world: World) => R): (s: DemoState, world: World) => R {
  const perWorld = new WeakMap<World, (s: DemoState) => R>()
  return (s, world) => {
    let sel = perWorld.get(world)
    if (!sel) {
      sel = memoState((st) => fn(st, world))
      perWorld.set(world, sel)
    }
    return sel(s)
  }
}

/** Cached on one part of core (an array or object that keeps its identity until it changes). */
function memoOn<K extends object, R>(key: (core: CoreState) => K, fn: (k: K) => R): (s: DemoState) => R {
  const cache = new WeakMap<K, R>()
  return (s) => {
    const k = key(s.core)
    if (cache.has(k)) return cache.get(k) as R
    const r = fn(k)
    cache.set(k, r)
    return r
  }
}

// ----------------------------------------------------------------------------------- basics

export const selectCore = (s: DemoState): CoreState => s.core
export const selectRoute = (s: DemoState): DemoRoute | null => s.core.route
export const selectServices = (s: DemoState): readonly DemoService[] => s.core.services

export function serviceById(s: DemoState, id: ServiceId | string): DemoService | undefined {
  return s.core.services.find((x) => x.id === id)
}

const byStateCache = new WeakMap<CoreState, Map<ServiceState, DemoService[]>>()

/** Services in `state`, registry order (cached per core state). */
export function servicesByState(s: DemoState, state: ServiceState): readonly DemoService[] {
  let m = byStateCache.get(s.core)
  if (!m) {
    m = new Map()
    byStateCache.set(s.core, m)
  }
  let list = m.get(state)
  if (!list) {
    list = s.core.services.filter((x) => x.state === state)
    m.set(state, list)
  }
  return list
}

/** Services that can run on this device (the sidebar's services group). Same reference until the registry changes. */
export const servicesHere = memoOn(
  (c) => c.services,
  (services) => services.filter((x) => x.canRunHere),
)

/** `canRunHere === false`: the collapsed "not available on this device (n)" group. */
export const servicesElsewhere = memoOn(
  (c) => c.services,
  (services) => services.filter((x) => !x.canRunHere),
)

export const isServiceLive = (s: DemoState, id: ServiceId): boolean => serviceById(s, id)?.state === "live"

/** Can `id` go STARTING -> LIVE now? (see core canStartService) */
export const canStart = (s: DemoState, world: World, id: ServiceId): boolean => canStartService(s.core, world, id)

/** The bootstrap rule: a live radio plus Wi-Fi that can host a hotspot, or ethernet. */
export const bridgeReady = (s: DemoState, world: World): boolean => bridgeReadyOf(s.core, world)

export const openProposals = memoOn(
  (c) => c.proposals,
  (proposals): readonly DemoProposal[] => proposals.filter((p) => p.decision === null),
)

export function proposalById(s: DemoState, id: string): DemoProposal | undefined {
  return s.core.proposals.find((p) => p.id === id)
}

/**
 * Why Accept would be refused right now (core/proposalAccepted refuses while the target cannot
 * start): the target service's own reason sentence, e.g. "Needs a radio board.". null = Accept works.
 * Show it beside the Accept button, or write proposals only for targets where canStart is true.
 */
export function proposalBlockedReason(s: DemoState, world: World, id: string): string | null {
  const p = proposalById(s, id)
  if (!p || p.decision !== null || p.target === null) return null
  const t = serviceById(s, p.target)
  if (!t || t.state === "live" || t.state === "starting") return null
  return canStartService(s.core, world, t.id) ? null : t.reason
}

/** Every heard node, in the order first heard (each entry carries its latest `cause`, `via` and `blip`). */
export const selectHeard = (s: DemoState): readonly HeardEntry[] => s.core.heard

/** Is this entry the home hub reached over the local Wi-Fi (the custody link), not a mesh neighbour? */
export function isHomeLink(h: Pick<HeardEntry, "id" | "via">, world: World): boolean {
  return h.id === world.homeHub && h.via === "wifi"
}

/**
 * Nodes heard over the mesh: what Nearby's radar and list call "nearby nodes". The home hub heard
 * over Wi-Fi (its custody ACK) is listed apart (homeHubHeard), so the verdict "alone on the mesh
 * right now: no nearby nodes heard" stays true while it shows.
 */
export const meshNeighbours = memoWorld((s, world): readonly HeardEntry[] => {
  const all = s.core.heard
  return all.some((h) => isHomeLink(h, world)) ? all.filter((h) => !isHomeLink(h, world)) : all
})

/** The home hub's entry while it was last heard over the local Wi-Fi, else null. */
export function homeHubHeard(s: DemoState, world: World): HeardEntry | null {
  return s.core.heard.find((h) => isHomeLink(h, world)) ?? null
}

const NO_EVENTS: readonly DemoEvent[] = []

/** Events after `seq` (oldest first), e.g. what arrived since a view last looked. Not cached: memoise in the view. */
export function eventsSince(s: DemoState, seq: number): readonly DemoEvent[] {
  const ev = s.core.events
  if (ev.length === 0 || ev[ev.length - 1].seq <= seq) return NO_EVENTS
  return ev.filter((e) => e.seq > seq)
}

/** The newest event, optionally of one cause. */
export function latestEvent(s: DemoState, cause?: CauseId): DemoEvent | undefined {
  const ev = s.core.events
  for (let i = ev.length - 1; i >= 0; i--) if (cause === undefined || ev[i].cause === cause) return ev[i]
  return undefined
}

/** This laptop's facts as plain lines, the radio line following the board. */
export const ownFactLines = memoWorld((s, world): string[] => {
  const radio = s.core.radio ? OWN_FACT_LINES.radio : OWN_FACT_LINES.noRadio
  return [...world.self.factLines, radio]
})

// ------------------------------------------------------------------------------------ devices

/** An attached device's state (real DeviceState, plain words). */
export type DemoDeviceState = keyof typeof DEVICE_COPY.state

export interface DemoDevice {
  /** RADIO_BOARD_ID ("radio-board"); its page is PATHS.device(id). */
  id: string
  /** The user's alias, else the detected name. */
  name: string
  /** Plain kind words: "long-range radio board". */
  kind: string
  state: DemoDeviceState
  /** The dot to draw (real deviceDot): connected = live, needs setup = unset, error = error. */
  dot: ServiceState
  /** Its state word, always printed beside the dot (real stateLabel). */
  stateLabel: string
  /** One plain sentence. */
  reason: string
  href: string
  stage: RadioStage
}

/**
 * The attached devices, from core only (real device registry): none until "[DEMO] plug in a radio
 * board", then the board through its stages. This laptop is the node, not a device: see ownDevice.
 * Every view that lists, counts or summarises devices reads this; the devices slice adds UI state only.
 */
export const selectDevices = memoState((s): readonly DemoDevice[] => {
  const r = s.core.radio
  if (!r) return []
  const state: DemoDeviceState = r.stage === "ready" ? "connected" : "needs setup"
  return [
    {
      id: RADIO_BOARD_ID,
      name: r.alias ?? r.name,
      kind: DEVICE_COPY.radioKind,
      state,
      dot: state === "connected" ? "live" : "unset",
      stateLabel: DEVICE_COPY.state[state],
      reason: r.stage === "ready" ? DEVICE_COPY.radioReady : RADIO_STAGE_REASON[r.stage],
      href: PATHS.device(RADIO_BOARD_ID),
      stage: r.stage,
    },
  ]
})

export interface DevicesSummary {
  total: number
  connected: number
  needSetup: number
  error: number
  /** The real overview sentence: "Nothing attached or paired yet.", "1 device, connected.", "1 device: 1 needs setup." */
  text: string
}

/** Overview's device summary (real views/overview/model.ts devicesSummary + lib/devices.ts summary). */
export const devicesSummary = memoState((s): DevicesSummary => {
  const list = selectDevices(s)
  const count = (st: DemoDeviceState) => list.filter((d) => d.state === st).length
  const connected = count("connected")
  const needSetup = count("needs setup")
  const error = count("error")
  const disconnected = count("disconnected")
  const total = list.length
  const c = DEVICE_COPY.summary
  let text: string
  if (total === 0) text = c.none
  else if (connected === total) text = total === 1 ? c.oneConnected : c.allConnected(total)
  else {
    const parts: string[] = []
    if (connected) parts.push(c.connected(connected))
    if (needSetup) parts.push(c.needsSetup(needSetup))
    if (error) parts.push(c.error(error))
    if (disconnected) parts.push(c.disconnected(disconnected))
    text = c.mixed(total, parts.join(", "))
  }
  return { total, connected, needSetup, error, text }
})

export interface OwnDevice {
  id: "workshop-laptop"
  /** core.alias (Settings L2). */
  name: string
  /** Node chip words: "LAPTOP". */
  badge: string
  /** Plain device words from src/lib/devices.ts: "laptop". */
  deviceLabel: string
  /** Grouped label, a–z and 2–7 only. */
  label: string
  facts: string[]
  health: "live" | "error"
  /** The bootstrap rule (plan §6.8): true only with a live radio plus a hotspot-capable Wi-Fi or ethernet. Then say DEVICE_COPY.ownBridges. */
  bridges: boolean
}

/** This laptop's own row (Devices, Overview's node facts, the Agent's "what can this device run?"). */
export const ownDevice = memoWorld(
  (s, world): OwnDevice => ({
    id: world.self.id,
    name: s.core.alias,
    badge: world.self.badge,
    deviceLabel: deviceById(world.self.device).label,
    label: world.self.label,
    facts: ownFactLines(s, world),
    health: nodeHealth(s),
    bridges: bridgeReadyOf(s.core, world),
  }),
)

// ---------------------------------------------------------------------------------- transport

export type TransportStatus = "joined" | "isolated" | "no transport" | "transport degraded"

/** Real `transport_state`: from the mesh link and the joined network, never from hub enrollment. */
export function transportStatusOf(core: Pick<CoreState, "services" | "transport">): TransportStatus {
  const mesh = core.services.find((x) => x.id === "mesh")
  if (!mesh || mesh.state === "unset") return "no transport"
  if (mesh.state === "error") return "transport degraded"
  return core.transport.joined !== null ? "joined" : "isolated"
}

export const transportStatus = (s: DemoState): TransportStatus => transportStatusOf(s.core)

/** Overview's nearby summary (real `nearbySentence`). */
export const nearbySentence = (s: DemoState): string => NEARBY_SENTENCE[transportStatus(s)]

// ------------------------------------------------------------------------------------ verdict

export type VerdictTone = "ok" | "attention" | "error"

export interface Verdict {
  sentence: string
  tone: VerdictTone
}

function joinPhrases(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/**
 * The one sentence that leads Overview (real `verdict`), first match wins:
 * 1. something in error (services, then devices a slice reports) -> "…, but <what> has a problem."
 * 2. the mesh link is starting and nothing is joined -> "…still starting."
 * 3. joined / isolated / no transport.
 * " It can reach the internet." is appended while the gateway is live.
 */
export const verdict = memoState((s): Verdict => {
  const c = s.core
  const internet = c.services.some((x) => x.id === "gateway" && x.state === "live") ? VERDICT_COPY.internet : ""
  const parts = c.services.filter((x) => x.state === "error").map((x) => `the ${SERVICE_NOUN[x.id]}`)
  let things = parts.length
  const badDevices =
    selectDevices(s).filter((d) => d.state === "error").length +
    sliceNeeds(s)
      .filter((n) => n.kind === "device")
      .reduce((sum, n) => sum + Math.max(1, n.count), 0)
  if (badDevices > 0) {
    parts.push(VERDICT_COPY.device(badDevices))
    things += badDevices
  }
  if (parts.length > 0) {
    const sentence = parts.length > 3 ? VERDICT_COPY.manyProblems(things) : VERDICT_COPY.problem(joinPhrases(parts), things === 1)
    return { sentence: sentence + internet, tone: "error" }
  }
  const status = transportStatusOf(c)
  if (c.services.some((x) => x.id === "mesh" && x.state === "starting") && status !== "joined") {
    return { sentence: VERDICT_COPY.meshStarting + internet, tone: "attention" }
  }
  switch (status) {
    case "joined":
      return { sentence: VERDICT_COPY.joined + internet, tone: "ok" }
    case "no transport":
      return { sentence: VERDICT_COPY.noTransport + internet, tone: "attention" }
    default:
      return { sentence: VERDICT_COPY.isolated + internet, tone: "attention" }
  }
})

/** The node chip dot (real `healthDot`): LIVE, or ERROR while any service is in error. */
export const nodeHealth = (s: DemoState): "live" | "error" => (s.core.services.some((x) => x.state === "error") ? "error" : "live")

/** The dot beside the verdict. */
export function verdictDot(tone: VerdictTone): ServiceState {
  return tone === "ok" ? "live" : tone === "error" ? "error" : "unset"
}

// ---------------------------------------------------------------------------------- needs you

export interface ChecklistRow {
  id: "model" | "mesh" | "peer"
  title: string
  state: ServiceState
  text: string
  /** Route path of the page that fixes it, or null. */
  href: string | null
  done: boolean
}

export interface NeedsYou {
  /** Proposals, message requests, errors, then NOT SET rows the agent can set up now. */
  items: readonly NeedItem[]
  /** Real first-run checklist, without the identity-backup command (plan §6.8: no CLI strings). */
  checklist: readonly ChecklistRow[]
  /** The header badge number: proposals + service errors + device errors + message requests. */
  count: number
  /** Something wants the person: an item, or a checklist row not done. */
  open: boolean
}

const KIND_RANK: Record<NeedItem["kind"], number> = { proposal: 0, request: 1, service: 2, device: 3, setup: 4 }

function checklistFrom(id: "model" | "mesh", title: string, svc: DemoService | undefined): ChecklistRow | null {
  if (!svc || !svc.canRunHere) return null
  const href = PATHS.service(svc.id)
  switch (svc.state) {
    case "live":
      return { id, title, state: "live", text: CHECKLIST_COPY.running, href, done: true }
    case "starting":
      return { id, title, state: "starting", text: CHECKLIST_COPY.starting, href, done: false }
    default:
      return { id, title, state: svc.state, text: svc.reason, href, done: false }
  }
}

/** Overview's "needs you" block and the header badge, from every slice (real `needsYou` + `computeAttention`). */
export const needsYou = memoState((s): NeedsYou => {
  const c = s.core
  const items: NeedItem[] = []
  for (const p of c.proposals) {
    if (p.decision !== null) continue
    items.push({ key: `proposal:${p.id}`, kind: "proposal", label: p.title, detail: NEEDS_COPY.proposalDetail(p.kind), href: PATHS.agent, count: 1 })
  }
  items.push(...sliceNeeds(s))
  for (const d of selectDevices(s)) {
    if (d.state === "error") items.push({ key: `device:${d.id}`, kind: "device", label: d.name, detail: d.reason, href: d.href, count: 1 })
  }
  for (const svc of c.services) {
    if (svc.state === "error") items.push({ key: `service:${svc.id}`, kind: "service", label: svc.name, detail: svc.reason, href: PATHS.service(svc.id), count: 1 })
  }
  for (const svc of c.services) {
    if (svc.state !== "unset" || !svc.canRunHere || svc.setup !== "agent") continue
    if (svc.id === "bridge" && !bridgeShown(c)) continue
    items.push({ key: `setup:${svc.id}`, kind: "setup", label: svc.name, detail: svc.reason, href: PATHS.service(svc.id), count: 0 })
  }
  const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => KIND_RANK[a.it.kind] - KIND_RANK[b.it.kind] || a.i - b.i).map((x) => x.it)

  const status = transportStatusOf(c)
  const checklist: ChecklistRow[] = []
  const model = checklistFrom("model", CHECKLIST_COPY.model, c.services.find((x) => x.id === "model"))
  if (model) checklist.push(model)
  const mesh = checklistFrom("mesh", CHECKLIST_COPY.mesh, c.services.find((x) => x.id === "mesh"))
  if (mesh) checklist.push(mesh)
  checklist.push(
    status === "joined"
      ? { id: "peer", title: CHECKLIST_COPY.peer, state: "live", text: CHECKLIST_COPY.peerHeard, href: null, done: true }
      : {
          id: "peer",
          title: CHECKLIST_COPY.peer,
          state: "unset",
          text: status === "no transport" ? CHECKLIST_COPY.peerNeedsMesh : CHECKLIST_COPY.peerNone,
          href: PATHS.nearby,
          done: false,
        },
  )

  const count = sorted.reduce((sum, it) => sum + (it.kind === "setup" ? 0 : Math.max(0, it.count)), 0)
  return { items: sorted, checklist, count, open: sorted.length > 0 || checklist.some((r) => !r.done) }
})

/** The bridge's setup row appears once the radio is live (its reason then says whether anything else is missing). */
function bridgeShown(c: CoreState): boolean {
  return c.services.some((x) => x.id === "radio" && x.state === "live")
}

/** The header badge number. */
export const attentionCount = (s: DemoState): number => needsYou(s).count

function attentionParts(s: DemoState): { proposals: number; serviceErrors: number; deviceErrors: number; requests: number } {
  const counted = needsYou(s).items
  const sum = (kind: NeedItem["kind"]) => counted.filter((i) => i.kind === kind).reduce((n, i) => n + Math.max(0, i.count), 0)
  return { proposals: sum("proposal"), serviceErrors: sum("service"), deviceErrors: sum("device"), requests: sum("request") }
}

/** "2 proposals, 1 service error, 1 message request"; "Nothing needs you" (real `attentionSummary`). */
export const attentionSummary = memoState((s): string => {
  const a = attentionParts(s)
  const parts: string[] = []
  if (a.proposals > 0) parts.push(ATTENTION_COPY.proposals(a.proposals))
  if (a.serviceErrors > 0) parts.push(ATTENTION_COPY.serviceErrors(a.serviceErrors))
  if (a.deviceErrors > 0) parts.push(ATTENTION_COPY.deviceErrors(a.deviceErrors))
  if (a.requests > 0) parts.push(ATTENTION_COPY.requests(a.requests))
  return parts.length > 0 ? parts.join(", ") : ATTENTION_COPY.none
})

/** Where the badge leads: Messages when requests are all it counts, else Overview's needs-you (real `attentionHref`). */
export const attentionHref = memoState((s): string => {
  const a = attentionParts(s)
  return a.requests > 0 && a.proposals + a.serviceErrors + a.deviceErrors === 0 ? PATHS.messages : PATHS.needsYou
})

// -------------------------------------------------------------------------------- shell, titles

/** The header title of a route (real `titleFor`); "" while the route is unknown (server render). */
export function titleFor(route: DemoRoute | null, services: readonly DemoService[]): string {
  if (!route) return ""
  switch (route.view) {
    case "agent":
      return ROUTE_TITLES.agent
    case "overview":
      return ROUTE_TITLES.overview
    case "devices":
      return ROUTE_TITLES.devices
    case "device":
      return ROUTE_TITLES.device
    case "nearby":
      return ROUTE_TITLES.nearby
    case "messages":
      return ROUTE_TITLES.messages
    case "conversation":
      return ROUTE_TITLES.conversation
    case "kb":
    case "kb-drawer":
    case "kb-note":
      return ROUTE_TITLES.kb
    case "service":
      return services.find((x) => x.id === route.id)?.name ?? ROUTE_TITLES.service
    case "settings":
      return ROUTE_TITLES.settings
    case "settings-layer":
      return layerPageTitle(route.layer)
    case "not-found":
      return ROUTE_TITLES.notFound
  }
}

export const routeTitle = memoState((s) => titleFor(s.core.route, s.core.services))

/** "Identity · L2" (sidebar row and header of a layer page). */
export function layerPageTitle(n: number): string {
  const page = LAYER_PAGES.find((l) => l.n === n)
  return page ? `${page.title} · L${n}` : ROUTE_TITLES.settings
}

export type ShellLayout = Exclude<LayoutPref, "auto">

/**
 * The sidebar layout to render. `wide` = the shell root is at least 1024px wide (the shell measures
 * its own root with a ResizeObserver; never the viewport). Forced layouts ignore `wide`.
 */
export function shellLayout(core: Pick<CoreState, "layout" | "railCollapsed">, wide: boolean): ShellLayout {
  if (core.layout !== "auto") return core.layout
  if (!wide) return "drawer"
  return core.railCollapsed ? "rail" : "docked"
}
