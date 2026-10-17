// Pure logic of the service page template (real os/interface/ui/src/views/services/model.ts: the Restart
// phase and button label, the control panel rows that `flattenDetail` built from the registry's `detail`,
// and tabs.tsx `nextTab`). No React, so every rule is unit-tested in node.
//
// The real control panel prints whatever the daemon knows (ports, ids, model names, reason codes). The
// demo prints the same kind of facts in plain words only, from the demo state: no ports, ids, versions
// or reason codes (W1, plan §6.8).
import { deviceById } from "@/lib/devices"
import { SERVICES_COPY } from "../../../copy/services"
import { formatClock, formatClockSeconds, formatDay } from "../../../engine/clock"
import type { HeardEntry, RadioBoard, TransportState } from "../../../engine/core"
import { PATHS } from "../../../engine/router"
import { openProposals } from "../../../engine/selectors"
import type { DemoState } from "../../../engine/slices"
import { canRestartService, LOG_KEEP, SERVICE_KIND, type ServiceLogLine, type TemplateServiceId } from "../../../engine/slices/services"
import type { ServiceId, ServiceState, UiMode } from "../../../engine/types"
import { nodeName, type DemoService, type World } from "../../../engine/world"
import { DOT_LABEL } from "../../../ui/status"

// ---------------------------------------------------------------------------------- selectors

/** Module-scope selectors for useDemo (each returns a reference core or the slice keeps until it changes). */
export const selectRadio = (s: DemoState): RadioBoard | null => s.core.radio
export const selectTransport = (s: DemoState): TransportState => s.core.transport
export const selectServiceLogs = (s: DemoState): DemoState["services"]["logs"] => s.services.logs
export const selectRestarting = (s: DemoState): DemoState["services"]["restarting"] => s.services.restarting
export const selectOpenProposalCount = (s: DemoState): number => openProposals(s).length

// --------------------------------------------------------------------------------------- tabs

export type TabId = "details" | "log"

export const TAB_DEFS: readonly { id: TabId; label: string }[] = [
  { id: "details", label: SERVICES_COPY.tabs.details },
  { id: "log", label: SERVICES_COPY.tabs.log },
]

/** Index to move to from `from` in direction `dir`, wrapping (real tabs.tsx `nextTab`). */
export const nextTab = (count: number, from: number, dir: 1 | -1): number => (count <= 0 ? 0 : (from + dir + count) % count)

// ------------------------------------------------------------------------------------ restart

export interface RestartView {
  /** Render the Restart control at all. */
  show: boolean
  /** The press is settling: the button reads "Restarting…" and ignores clicks (real RestartPhase "waiting"). */
  loading: boolean
  label: string
}

/**
 * The Restart control (real: `restart` is offered while LIVE or in ERROR, for supervised children only).
 * It stays on screen while its own restart is STARTING, as the busy "Restarting…" button, so focus is never
 * dropped; a service STARTING for any other reason offers no Restart.
 */
export function restartView(service: Pick<DemoService, "id" | "state">, restarting: readonly ServiceId[]): RestartView {
  const mine = restarting.includes(service.id)
  const show = canRestartService(service.id) && (service.state === "live" || service.state === "error" || (service.state === "starting" && mine))
  const loading = show && service.state === "starting"
  return { show, loading, label: loading ? SERVICES_COPY.restart.busy : SERVICES_COPY.restart.label }
}

// -------------------------------------------------------------------------------------- radio

/** The radio page's contextual step: plug a board in ([DEMO]), continue on the board's page, or none. */
export type RadioStep = "plug" | "continue" | null

export function radioStep(radio: Pick<RadioBoard, "stage"> | null): RadioStep {
  if (!radio) return "plug"
  return radio.stage === "ready" ? null : "continue"
}

/** Does the page put anything in the frame's `actions` slot? (An empty slot would still take a row.) */
export function hasActions(service: Pick<DemoService, "id" | "state">, restarting: readonly ServiceId[], radio: Pick<RadioBoard, "stage"> | null): boolean {
  return restartView(service, restarting).show || (service.id === "radio" && radioStep(radio) !== null)
}

// ---------------------------------------------------------------------------------------- log

/** Simple mode shows the newest few lines; advanced shows every kept line (real: a 5-line peek vs the 100-line tail). */
export const LOG_LINES: Readonly<Record<UiMode, number>> = { simple: 8, advanced: LOG_KEEP }

/** "09:12:05  Restart asked for from the dashboard." Rendered whole, oldest first. */
export function logText(lines: readonly ServiceLogLine[], limit: number): string[] {
  const shown = limit > 0 && lines.length > limit ? lines.slice(lines.length - limit) : lines
  return shown.map((l) => `${formatClockSeconds(l.at)}  ${l.text}`)
}

// -------------------------------------------------------------------------------------- facts

/** A piece of a fact's value: plain text, or an in-demo link. Pieces are joined by " · ". */
export interface FactPart {
  text: string
  to?: string
}

export interface FactRow {
  label: string
  parts: readonly FactPart[]
  /** Lowest mode that shows it (SpecRow.minMode). */
  minMode?: UiMode
}

export interface FactInput {
  world: World
  services: readonly DemoService[]
  radio: RadioBoard | null
  transport: TransportState
  /** Nodes heard over the mesh (meshNeighbours: the home hub over Wi-Fi is not one). */
  heard: readonly HeardEntry[]
  openProposals: number
}

const text = (t: string): FactPart => ({ text: t })
const link = (t: string, to: string): FactPart => ({ text: t, to })
const row = (label: string, ...parts: FactPart[]): FactRow => ({ label, parts })

/** "Local model · LIVE": a link to another service's page plus its state word. */
function serviceRef(services: readonly DemoService[], id: ServiceId): FactPart[] {
  const svc = services.find((s) => s.id === id)
  return svc ? [link(svc.name, PATHS.service(svc.id)), text(DOT_LABEL[svc.state])] : []
}

function kbCheck(state: ServiceState): string {
  return SERVICES_COPY.kb.checkValue[state]
}

function ownRows(id: TemplateServiceId, service: DemoService, input: FactInput): FactRow[] {
  const { world, services, radio, transport, heard } = input
  switch (id) {
    case "agent": {
      const c = SERVICES_COPY.agent
      return [
        row(c.thinksWith, ...serviceRef(services, "model")),
        row(c.reads, text(c.readsValue)),
        row(c.tools, text(c.toolsValue)),
        row(c.cannot, text(c.cannotValue)),
        row(c.proposals, text(c.proposalsValue(input.openProposals)), link(c.openChat, PATHS.agent)),
      ]
    }
    case "model": {
      const c = SERVICES_COPY.model
      const device = deviceById(world.self.device).label
      return [row(c.runsOn, text(c.runsOnValue(device))), row(c.consent, text(c.consentValue)), row(c.usedBy, ...serviceRef(services, "agent"))]
    }
    case "mesh": {
      const c = SERVICES_COPY.mesh
      const joined = transport.joined ? world.networks.find((n) => n.id === transport.joined) : undefined
      const names = heard.map((h) => nodeName(world, h.id))
      return [
        row(c.joined, text(joined ? c.joinedValue(joined.name, joined.mediumLabel) : c.joinedNone)),
        ...world.networks.map((n) => row(n.name, text(c.network(n.mediumLabel, transport.tries[n.id])))),
        row(c.heard, text(names.length > 0 ? names.join(", ") : c.heardNone), link(c.openNearby, PATHS.nearby)),
        row(c.reads, text(c.readsValue)),
      ]
    }
    case "radio": {
      const c = SERVICES_COPY.radio
      const board = radio ? [link(radio.alias ?? radio.name, PATHS.device(radio.id)), text(c.stage[radio.stage])] : [text(c.boardNone)]
      return [
        row(c.board, ...board),
        row(c.region, text(radio?.region ?? c.regionNone)),
        row(c.transmits, text(service.state === "live" && radio?.region ? c.transmitsLive(radio.region) : c.transmitsNot)),
      ]
    }
    case "kb": {
      const c = SERVICES_COPY.kb
      return [
        row(c.offline, text(c.offlineValue)),
        row(c.check, text(kbCheck(service.state))),
        row(c.grades, text(c.gradesValue)),
        row(c.notes, link(c.openKb, PATHS.kb)),
      ]
    }
    case "messaging": {
      const c = SERVICES_COPY.messaging
      return [
        row(c.hub, text(c.hubValue(nodeName(world, world.homeHub)))),
        row(c.store, text(c.storeValue)),
        row(c.states, text(c.statesValue)),
        row(c.delivered, text(c.deliveredValue)),
        row(c.conversations, link(c.openMessages, PATHS.messages)),
      ]
    }
  }
}

/**
 * The control panel rows (real ControlPanel: `flattenDetail(detail)` + devices + the advanced-only
 * technical name and reason code). Here: what it does, how it runs, the service's own facts, and in
 * ADVANCED the time of its last state change. Labels are unique (SpecTable keys rows by label).
 */
export function factRows(id: TemplateServiceId, service: DemoService, input: FactInput): FactRow[] {
  const f = SERVICES_COPY.facts
  return [
    row(f.does, text(SERVICES_COPY[id].does)),
    row(f.runsAs, text(SERVICES_COPY.kind[SERVICE_KIND[id]])),
    ...ownRows(id, service, input),
    { label: f.lastChange, parts: [text(f.lastChangeValue(formatDay(service.since), formatClock(service.since)))], minMode: "advanced" },
  ]
}
