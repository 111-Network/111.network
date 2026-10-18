// Pure model of Settings (real os/40-interface/ui/src/views/settings/model.ts): the Essentials rows,
// the node-name and restart rules, the update block and its steps, the per-layer status rows, the
// "On this dashboard" links and the "ask the agent" prompt. No React, so vitest runs it in node.
// The views map these plain values onto primitives. Everything reads the demo store instead of
// /status, and every value is in plain words: no addresses, hashes, hostnames or version numbers.
import { createRng } from "@/lib/prng"
import { deviceById } from "@/lib/devices"
import { LAYER_PAGES, SERVICE_COPY } from "../../copy/core"
import { SETTINGS_COPY, SETTINGS_NAME_MAX } from "../../copy/settings"
import { formatClock, formatClockSeconds, formatDay } from "../../engine/clock"
import type { TransportState } from "../../engine/core"
import { PATHS } from "../../engine/router"
import { layerPageTitle, meshNeighbours, openProposals, transportStatusOf } from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import type { LanState, UpdateState } from "../../engine/slices/settings"
import type { LayerNumber, ServiceId, ServiceState, UiMode } from "../../engine/types"
import type { DemoService, World } from "../../engine/world"

const C = SETTINGS_COPY

// ---------------------------------------------------------------- essentials

export type EssentialId = "alias" | "mode" | "backup" | "restart" | "updates"

export interface EssentialRow {
  id: EssentialId
  label: string
  help: string
  /** Extra sentence below the control (identity backup only). */
  note?: string
}

const ESSENTIAL_ORDER: readonly EssentialId[] = ["alias", "mode", "backup", "restart", "updates"]

/** The five Essentials rows, in their fixed order (real `essentialRows`). A fresh array each call. */
export function essentialRows(): EssentialRow[] {
  return ESSENTIAL_ORDER.map((id) => {
    const row: { label: string; help: string; note?: string } = C.rows[id]
    return row.note === undefined ? { id, label: row.label, help: row.help } : { id, label: row.label, help: row.help, note: row.note }
  })
}

/** The longest node name the field takes (real input maxLength). */
export const ALIAS_MAX = 64

/** The name a draft saves as: trimmed, or the name the node came with when empty (core/renameNode). */
export function aliasValue(draft: string, fallback: string): string {
  return draft.trim() || fallback
}

/** Is there something to save? Only when the draft would change the current name. */
export function aliasDirty(draft: string | null, current: string, fallback: string): boolean {
  return draft !== null && aliasValue(draft, fallback) !== current
}

/** The destructive confirm label: "Restart {name}", cut so the question stays readable (real `restartConfirmText`). */
export function restartConfirmText(alias: string): string {
  const name = alias.trim() || "this node"
  return C.restart.confirm(name.slice(0, SETTINGS_NAME_MAX))
}

/** The sentence under "Share on this network" (real `lanNote`): derived from the store, so toggle and note never disagree. */
export function lanNote(lan: LanState): string | null {
  return lan.enabled !== lan.bound ? C.sharing.lan.pending(lan.enabled) : null
}

/** What a toggle announces: the pending note, or the plain state when it went back to what the node runs. */
export function lanAnnouncement(lan: LanState): string {
  return lanNote(lan) ?? C.sharing.lan.state(lan.enabled)
}

// ---------------------------------------------------------------- update block

export interface FactRow {
  label: string
  /** A string, or several lines stacked. */
  value: string | readonly string[]
  /** A service row: the dot (with its state word) goes before the value. */
  state?: ServiceState
  /** When set, the view renders a copy button for this text next to the value. */
  copy?: string
  minMode?: UiMode
}

/** "17 Oct, 05:48", or "never". Virtual time, formatted by hand (no wall clock). */
export function formatWhen(at: number | null): string {
  return at === null ? C.update.never : C.update.when(formatDay(at), formatClock(at))
}

function runningText(u: Pick<UpdateState, "onNewer">): string {
  return u.onNewer ? C.update.running.newer : C.update.running.installed
}

function sourceText(source: UpdateState["source"]): string {
  return source === "internet" ? C.update.source.internet : C.update.source.hub
}

/** The update fields under "Check for updates" (real `updateRows`). */
export function updateRows(u: UpdateState): FactRow[] {
  const rows: FactRow[] = [
    { label: C.update.rows.state, value: C.update.phase[u.phase] },
    { label: C.update.rows.running, value: runningText(u) },
    { label: C.update.rows.lastCheck, value: formatWhen(u.lastCheck) },
    { label: C.update.rows.lastResult, value: u.lastResult ? C.update.result[u.lastResult] : C.update.noResult },
  ]
  if (u.source !== null) rows.push({ label: C.update.rows.source, value: sourceText(u.source) })
  return rows
}

export type StepState = "done" | "current" | "pending" | "skipped" | "failed"
export type StepId = "check" | "verify" | "trial" | "result"

export interface UpdateStep {
  id: StepId
  label: string
  state: StepState
  /** The word printed under the step: its state, or the result. */
  word: string
}

type Shape = readonly [StepState, StepState, StepState, StepState]

/** The four steps of the last (or running) check: check -> download and verify -> trial -> result. */
export function updateSteps(u: Pick<UpdateState, "phase" | "lastResult">): UpdateStep[] {
  const w = C.update.resultWord
  let shape: Shape
  let result: string | null = null
  switch (u.phase) {
    case "checking":
      shape = ["current", "pending", "pending", "pending"]
      break
    case "staged":
      shape = ["done", "current", "pending", "pending"]
      break
    case "probation":
      shape = ["done", "done", "current", "pending"]
      break
    case "reverting":
      shape = ["done", "done", "failed", "current"]
      result = w.reverting
      break
    case "idle":
      if (u.lastResult === "up to date") {
        shape = ["done", "skipped", "skipped", "done"]
        result = w.upToDate
      } else if (u.lastResult === "updated") {
        shape = ["done", "done", "done", "done"]
        result = w.healthy
      } else if (u.lastResult === "rolled back") {
        shape = ["done", "done", "failed", "done"]
        result = w.rolledBack
      } else shape = ["pending", "pending", "pending", "pending"]
      break
  }
  const ids: readonly StepId[] = ["check", "verify", "trial", "result"]
  return ids.map((id, i) => ({
    id,
    label: C.update.steps[id],
    state: shape[i],
    word: id === "result" && result !== null ? result : C.update.stepState[shape[i]],
  }))
}

/** The sentence beside the steps. */
export function updateSentence(u: Pick<UpdateState, "phase" | "lastResult" | "source" | "run">): string {
  const s = C.update.status
  switch (u.phase) {
    case "checking":
      return s.checking
    case "staged":
      return s.staged(sourceText(u.source))
    case "probation":
      return s.probation
    case "reverting":
      return s.reverting
    case "idle":
      return u.lastResult ? s[u.lastResult] : s.idle
  }
}

/** A newer version arrived in this session (an incoming demo item: it carries a demo note). */
export function updateArrived(u: Pick<UpdateState, "source" | "run">): boolean {
  return u.run > 0 && u.source !== null
}

/** The "[DEMO] fail the next trial" switch only matters while a newer version is still to try. */
export function showsFailSwitch(u: Pick<UpdateState, "onNewer">): boolean {
  return !u.onNewer
}

/** The update log as terminal lines: "09:12:05  checking for a newer signed version". */
export function updateLogLines(u: Pick<UpdateState, "log">): string[] {
  return u.log.map((l) => `${formatClockSeconds(l.at)}  ${l.text}`)
}

// ---------------------------------------------------------------- layer pages

/** What a layer page reads from the store; existing references, so `shallowEqual` keeps it stable. */
export interface LayerInputs {
  services: readonly DemoService[]
  transport: TransportState
  internet: "offline" | "connected"
  alias: string
  mode: UiMode
  update: UpdateState
  lan: LanState
  /** Nodes heard over the mesh (not the home link). */
  neighbours: number
  openProposals: number
}

/** Module-scope selector for useDemoWorld(selectLayerInputs, shallowEqual). */
export function selectLayerInputs(s: DemoState, world: World): LayerInputs {
  return {
    services: s.core.services,
    transport: s.core.transport,
    internet: s.core.internet,
    alias: s.core.alias,
    mode: s.core.mode,
    update: s.settings.update,
    lan: s.settings.lan,
    neighbours: meshNeighbours(s, world).length,
    openProposals: openProposals(s).length,
  }
}

const serviceRow = (svc: DemoService): FactRow => ({ label: svc.name, value: svc.reason, state: svc.state })

function serviceRows(inputs: Pick<LayerInputs, "services">, ids: readonly ServiceId[]): FactRow[] {
  return ids.flatMap((id) => {
    const svc = inputs.services.find((s) => s.id === id)
    return svc ? [serviceRow(svc)] : []
  })
}

/** The services of a layer, in registry order (L0 knowledge base, L3 agent + model, L6 mesh + radio + bridge …). */
export function layerServices(n: LayerNumber, services: readonly DemoService[]): DemoService[] {
  return services.filter((s) => s.layer === n)
}

const S = C.status

/** The status fields layer `n` owns today, from the demo store (real `layerStatusRows`). Never throws. */
export function layerStatusRows(n: LayerNumber, inputs: LayerInputs, world: World): FactRow[] {
  const own = (ids: readonly ServiceId[]) => serviceRows(inputs, ids)
  switch (n) {
    case 0:
      return [...own(["kb"]), { label: S.works, value: S.yes }]
    case 1:
      return [{ label: S.device, value: deviceById(world.self.device).label }, ...updateRows(inputs.update)]
    case 2:
      return [
        { label: S.nodeLabel, value: world.self.label, copy: world.self.label },
        { label: S.nodeName, value: inputs.alias },
        { label: S.identity, value: S.identityValue },
        { label: S.backup, value: S.backupValue },
        { label: S.keys, value: S.keysValue },
      ]
    case 3:
      return [...own(["agent", "model"]), { label: S.whereRuns, value: S.whereRunsValue }]
    case 4: {
      const pending = lanNote(inputs.lan) !== null
      return [
        { label: S.servedBy, value: S.servedByValue },
        { label: S.openOn, value: inputs.lan.bound ? S.openOnShared : S.openOnLocal },
        { label: S.sharing, value: pending ? S.sharingPending(inputs.lan.enabled) : inputs.lan.bound ? S.on : S.off },
        { label: S.mode, value: inputs.mode },
      ]
    }
    case 5: {
      const hub = world.cast.find((c) => c.id === world.homeHub)
      return [
        ...own(["messaging"]),
        { label: S.homeHub, value: S.homeHubValue(hub?.name ?? world.homeHub) },
        { label: S.store, value: S.storeValue },
      ]
    }
    case 6: {
      const status = transportStatusOf(inputs)
      const joined = world.networks.find((x) => x.id === inputs.transport.joined)
      const transport = status !== "joined" ? S.transportValue[status] : joined ? S.transportValue.joined(joined.name) : S.transportValue.isolated
      return [
        { label: S.transport, value: transport },
        { label: S.networks, value: world.networks.map((x) => S.networkLine(x.name, x.mediumLabel, inputs.transport.tries[x.id])) },
        ...own(["mesh", "radio", "bridge"]),
      ]
    }
    case 7:
      return [
        ...own(["gateway"]),
        { label: S.heartbeats, value: inputs.transport.joined !== null ? S.heartbeatsOn : S.heartbeatsOff },
        { label: S.heard, value: inputs.neighbours > 0 ? String(inputs.neighbours) : S.heardNone },
      ]
    case 8:
      return [...own(["storage"]), { label: S.libraries, value: S.librariesValue }]
    case 9:
      return [...own(["repairs"]), { label: S.proposals, value: String(inputs.openProposals) }, { label: S.gate, value: S.gateValue }]
  }
}

/** The plain title of a layer page ("Identity"); the header reads "Identity · L2". */
export function layerTitle(n: LayerNumber): string {
  return LAYER_PAGES[n].title
}

export function layerDescription(n: LayerNumber): string {
  return LAYER_PAGES[n].description
}

/** How the layer works on this node: two or three plain sentences (os/README.md). */
export function layerPoints(n: LayerNumber): readonly string[] {
  return C.points[n]
}

/**
 * The prepared prompt of "Ask the agent about {title}" (real `layerAskPrompt`): core/agentPrefill
 * opens the Agent with it in the composer. It is never sent by itself.
 */
export function layerAsk(n: LayerNumber): { text: string; from: string } {
  return { text: C.layer.prompt(n, layerTitle(n)), from: layerPageTitle(n) }
}

export interface WhereLink {
  key: string
  to: string
  label: string
  note: string
}

type WhereKey = Exclude<keyof typeof SETTINGS_COPY.where, "serviceNote">

const page = (key: WhereKey, to: string): WhereLink => ({ key, to, label: C.where[key].label, note: C.where[key].note })

const service = (id: ServiceId): WhereLink => ({ key: `service:${id}`, to: PATHS.service(id), label: SERVICE_COPY[id].name, note: C.where.serviceNote })

/** Where the layer shows up on this dashboard (the intended surfaces, L6–L9 included). */
export function layerLinks(n: LayerNumber): WhereLink[] {
  switch (n) {
    case 0:
      return [page("kb", PATHS.kb), service("kb")]
    case 1:
      return [page("identity", PATHS.settingsLayer(2)), page("devices", PATHS.devices), page("essentials", PATHS.settings)]
    case 2:
      return [page("messages", PATHS.messages), page("install", PATHS.settingsLayer(1))]
    case 3:
      return [page("agent", PATHS.agent), service("agent"), service("model")]
    case 4:
      return [page("overview", PATHS.overview), page("essentials", PATHS.settings)]
    case 5:
      return [page("messages", PATHS.messages), service("messaging")]
    case 6:
      return [service("mesh"), service("radio"), service("bridge"), page("devices", PATHS.devices)]
    case 7:
      return [page("nearby", PATHS.nearby), service("gateway")]
    case 8:
      return [service("storage")]
    case 9:
      return [service("repairs"), page("agent", PATHS.agent)]
  }
}

// ---------------------------------------------------------------- identity card

export interface KeyBar {
  width: number
  gap: number
}

/** A key's public half drawn as a deterministic bar strip (CSS bars, never hex, never a glyph). */
export function keyBars(seed: string, count = 22): KeyBar[] {
  const rng = createRng(`public-half:${seed}`)
  return Array.from({ length: count }, () => ({ width: 1 + Math.floor(rng() * 4), gap: 1 + Math.floor(rng() * 3) }))
}
