// Pure derivations for Overview (real views/overview/model.ts): the "needs you" rows and the
// first-run checklist as the view draws them, the nearby list, the node facts and the activity
// lines. No React, no clock except the virtual `now` passed in. The verdict, the needs-you items,
// the nearby sentence and the device summary come from engine/selectors.ts (real lib/verdict.ts,
// lib/attention.ts, views/overview/model.ts) and are not repeated here.
import { DEVICE_COPY, MEDIUM_LABEL } from "../../copy/core"
import { OVERVIEW_COPY } from "../../copy/overview"
import { agoText, formatClockSeconds, formatDuration, HOUR, MIN } from "../../engine/clock"
import type { HeardEntry } from "../../engine/core"
import { PATHS } from "../../engine/router"
import type { ChecklistRow, OwnDevice } from "../../engine/selectors"
import type { CauseId, DemoEvent, NeedItem, ServiceId } from "../../engine/types"
import { castById, nodeName, type DemoService, type World } from "../../engine/world"
import type { DotState } from "../../ui/status"

/** The fragment of the header badge's target (PATHS.needsYou = "/overview#needs-you"). */
export const NEEDS_YOU_ID = "needs-you"

// ---------------------------------------------------------------------------------- needs you

/** How a row is marked: a hollow pip (proposal, message requests) or a labelled status dot. */
export type NeedMarker = { kind: "pip" } | { kind: "dot"; state: DotState }

export interface NeedRow {
  key: string
  /** The small label above the row ("proposal", "messages", "service", "device"). */
  kindLabel: string
  label: string
  detail: string
  href: string
  marker: NeedMarker
  /** A NOT SET service the agent can set up now: the row offers "Set up with the agent". */
  setup: ServiceId | null
  /** Message requests are incoming demo items: the row carries the "demo message" note. */
  demoNote: boolean
}

/** The service a "setup:<id>" row is about, if it is still NOT SET and set up through the agent. */
export function setupTargetOf(item: Pick<NeedItem, "key" | "kind">, services: readonly DemoService[]): ServiceId | null {
  if (item.kind !== "setup" || !item.key.startsWith("setup:")) return null
  const id = item.key.slice("setup:".length)
  const svc = services.find((s) => s.id === id)
  return svc && svc.canRunHere && svc.state === "unset" && svc.setup === "agent" ? svc.id : null
}

function markerOf(item: NeedItem, services: readonly DemoService[]): NeedMarker {
  switch (item.kind) {
    case "proposal":
    case "request":
      return { kind: "pip" }
    case "setup":
      return { kind: "dot", state: "unset" }
    case "service": {
      const id = item.key.startsWith("service:") ? item.key.slice("service:".length) : null
      return { kind: "dot", state: services.find((s) => s.id === id)?.state ?? "error" }
    }
    case "device":
      return { kind: "dot", state: "error" }
  }
}

/** The needs-you items (already ordered by the selector) as the view draws them. */
export function needRows(items: readonly NeedItem[], services: readonly DemoService[]): NeedRow[] {
  return items.map((item) => ({
    key: item.key,
    kindLabel: OVERVIEW_COPY.needs.kind[item.kind],
    label: item.label,
    detail: item.detail,
    href: item.href,
    marker: markerOf(item, services),
    setup: setupTargetOf(item, services),
    demoNote: item.kind === "request",
  }))
}

export interface OverviewChecklistRow {
  id: ChecklistRow["id"] | "identity"
  title: string
  state: DotState
  text: string
  href: string | null
  done: boolean
}

/**
 * The first-run checklist with the real dashboard's identity row first. It stays UNKNOWN (no
 * "backed up" marker exists) and points at Settings L2, never at a command (plan §6.8).
 */
export function overviewChecklist(rows: readonly ChecklistRow[]): OverviewChecklistRow[] {
  const identity: OverviewChecklistRow = {
    id: "identity",
    title: OVERVIEW_COPY.identity.title,
    state: "unknown",
    text: OVERVIEW_COPY.identity.text,
    href: PATHS.settingsLayer(2),
    done: false,
  }
  return [identity, ...rows]
}

/** Until the derivable steps are done the checklist is the point; afterwards it folds away (real rule: identity excluded). */
export function checklistPending(rows: readonly OverviewChecklistRow[]): boolean {
  return rows.some((r) => r.id !== "identity" && !r.done)
}

/** "First-run checklist · 3 of 4 done · 1 unknown". */
export function checklistSummary(rows: readonly OverviewChecklistRow[]): string {
  const done = rows.filter((r) => r.done).length
  const unknown = rows.filter((r) => r.state === "unknown").length
  return OVERVIEW_COPY.needs.checklistSummary(done, rows.length, unknown)
}

// -------------------------------------------------------------------------------------- nearby

export interface NearbyRow {
  /** Stable per node (one row each). */
  key: string
  name: string
  /** Plain device words ("radio relay"). */
  device: string
  /** "over long-range radio". */
  via: string
  /** A relay forwards sealed traffic and cannot read it. */
  relay: boolean
}

/** The nodes heard over the mesh (meshNeighbours), in the order first heard. */
export function nearbyRows(heard: readonly HeardEntry[], world: World): NearbyRow[] {
  return heard.map((h) => {
    const cast = castById(world, h.id)
    return {
      key: h.id,
      name: nodeName(world, h.id),
      device: cast?.deviceLabel ?? "",
      via: OVERVIEW_COPY.nearby.via(MEDIUM_LABEL[h.via]),
      relay: cast ? !cast.canRead : false,
    }
  })
}

/** The home-link line while the home hub was last heard over this Wi-Fi (homeHubHeard), else null. */
export function homeHubLine(hub: HeardEntry | null, world: World): string | null {
  return hub ? OVERVIEW_COPY.nearby.homeHub(nodeName(world, hub.id)) : null
}

// ---------------------------------------------------------------------------------- node facts

/** The sample world's last update check before the demo opened (the real sample: 3 h 12 min earlier). */
export const SAMPLE_LAST_CHECK = -(3 * HOUR + 12 * MIN)

const UPDATE_CAUSES: readonly CauseId[] = ["update-check", "update-healthy", "update-rolled-back"]

/** When this node started: its longest-running service in the opening registry. */
export function nodeStartedAt(world: World): number {
  return world.services.reduce((min, s) => Math.min(min, s.since), 0)
}

/**
 * The update rows (real updateText + lastCheck): "up to date" until the visitor checks on this
 * page, then the latest update event's own sentence; the last check is the latest "update-check".
 */
export function updateFacts(events: readonly DemoEvent[], now: number): { updates: string; lastCheck: string } {
  let latest: DemoEvent | undefined
  let check: DemoEvent | undefined
  for (let i = events.length - 1; i >= 0 && (!latest || !check); i--) {
    const e = events[i]
    if (!latest && UPDATE_CAUSES.includes(e.cause)) latest = e
    if (!check && e.cause === "update-check") check = e
  }
  return {
    updates: latest?.text || OVERVIEW_COPY.node.upToDate,
    lastCheck: agoText(check?.at ?? SAMPLE_LAST_CHECK, now),
  }
}

/** Real nodeFacts gateway row: from the gateway service (an overlay role; the node chip never changes). */
export function gatewayText(services: readonly DemoService[]): string {
  const gw = services.find((s) => s.id === "gateway")
  const g = OVERVIEW_COPY.node.gateway
  return gw?.state === "live" ? g.live : gw?.state === "starting" ? g.starting : g.none
}

/** "laptop", or "laptop · also bridges radio and Wi-Fi" only under the bootstrap rule (plan §6.8). */
export function deviceText(own: Pick<OwnDevice, "deviceLabel" | "bridges">): string {
  return own.bridges ? `${own.deviceLabel} · ${DEVICE_COPY.ownBridges}` : own.deviceLabel
}

export interface NodeFacts {
  name: string
  label: string
  device: string
  hardware: string
  version: string
  uptime: string
  updates: string
  lastCheck: string
  gateway: string
  dashboard: string
}

export interface NodeFactsInput {
  own: OwnDevice
  services: readonly DemoService[]
  events: readonly DemoEvent[]
  now: number
  world: World
  /** The software version this node runs (the site's SITE_VERSION). */
  version: string
}

export function nodeFacts({ own, services, events, now, world, version }: NodeFactsInput): NodeFacts {
  const up = updateFacts(events, now)
  return {
    name: own.name,
    label: own.label,
    device: deviceText(own),
    hardware: own.facts.join(" · "),
    version,
    uptime: formatDuration(now - nodeStartedAt(world)),
    updates: up.updates,
    lastCheck: up.lastCheck,
    gateway: gatewayText(services),
    dashboard: OVERVIEW_COPY.node.dashboard,
  }
}

// ------------------------------------------------------------------------------------ activity

/** "09:12:05 · Joined Network A. Heartbeats started." */
export function activityLine(e: Pick<DemoEvent, "at" | "text">): string {
  return `${formatClockSeconds(e.at)} · ${e.text}`
}

/** The newest `n` events, oldest first (a terminal reads top to bottom; the log is already newest last). */
export function activityLines(events: readonly DemoEvent[], n: number): string[] {
  return events.slice(Math.max(0, events.length - n)).map(activityLine)
}
