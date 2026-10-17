// Nearby, pure (real views/nearby/model.ts, minus everything the API reports that the demo has no
// honest value for: no signal figures, positions or channel use). The page state with its empty
// states, how a heard node reads, the order, and the grouping by how it was heard. React-free.
import { RADIO_BOARD_NAME } from "../../copy/core"
import { NEARBY_COPY } from "../../copy/nearby"
import type { HeardEntry, RadioBoard } from "../../engine/core"
import type { CauseId, Medium, PeerId } from "../../engine/types"
import { castById, nodeName, type DemoService, type World } from "../../engine/world"

// ---------------------------------------------------------------------------------- the page state

export type NearbyPageKind = "no-mesh" | "mesh-error" | "no-board" | "unbound" | "starting" | "error" | "empty" | "list"

export interface NearbyPage {
  kind: NearbyPageKind
  /** Empty states: the small label and the title. Null for the list. */
  kicker: string | null
  title: string | null
  /** Empty states: why, and what happens next. The list: the "last known list" line, or null. */
  text: string | null
}

const reasonOr = (svc: DemoService | undefined, fallback: string): string => (svc?.reason.trim() ? svc.reason : fallback)

/**
 * Which empty state or list the page shows (real nearbyState, by the radio service row and the mesh
 * link instead of the radio stack's own row). `neighbours` = meshNeighbours (the home hub over Wi-Fi
 * is never one). Before the radio board, the honest empty state.
 */
export function nearbyPage(input: {
  neighbours: number
  radio: Pick<RadioBoard, "stage"> | null
  radioService: DemoService | undefined
  meshService: DemoService | undefined
}): NearbyPage {
  const { neighbours, radio, radioService, meshService } = input
  const e = NEARBY_COPY.empty
  if (neighbours > 0) {
    const text =
      meshService?.state === "error"
        ? NEARBY_COPY.stale.mesh
        : radioService?.state === "error"
          ? NEARBY_COPY.stale.radioError
          : radioService?.state === "starting"
            ? NEARBY_COPY.stale.radioStarting
            : null
    return { kind: "list", kicker: null, title: null, text }
  }
  if (!meshService || meshService.state === "unset") return { kind: "no-mesh", kicker: e.noMesh.kicker, title: e.noMesh.title, text: e.noMesh.text }
  if (meshService.state === "error") return { kind: "mesh-error", kicker: e.meshError.kicker, title: e.meshError.title, text: reasonOr(meshService, e.meshError.fallback) }
  if (radioService?.state === "error") return { kind: "error", kicker: e.error.kicker, title: e.error.title, text: reasonOr(radioService, e.error.fallback) }
  if (radioService?.state === "starting") return { kind: "starting", kicker: e.starting.kicker, title: e.starting.title, text: reasonOr(radioService, e.starting.fallback) }
  if (radioService?.state === "live") return { kind: "empty", kicker: e.nobody.kicker, title: e.nobody.title, text: e.nobody.text }
  if (radio) return { kind: "unbound", kicker: e.unbound.kicker, title: e.unbound.title, text: e.unbound.text }
  return { kind: "no-board", kicker: e.noBoard.kicker, title: e.noBoard.title, text: e.noBoard.text }
}

// --------------------------------------------------------------------------------- how a node reads

/**
 * How the sample world's radio nodes are heard: the ridge repeater directly, the valley hub and
 * Bram (out past the ridge) through it. Sample data, like the rest of the world; never a distance.
 */
export const RELAYED_THROUGH: Readonly<Partial<Record<PeerId, PeerId>>> = {
  "valley-hub": "ridge-repeater",
  bram: "ridge-repeater",
}

/** The relay a heard node came through, or null (heard directly). Only radio paths go through a relay. */
export function relayOf(h: Pick<HeardEntry, "id" | "via">): PeerId | null {
  return h.via === "radio" ? (RELAYED_THROUGH[h.id] ?? null) : null
}

/** "heard directly" / "heard through Ridge repeater". */
export function pathText(h: Pick<HeardEntry, "id" | "via">, world: World): string {
  const relay = relayOf(h)
  return relay ? NEARBY_COPY.path.through(nodeName(world, relay)) : NEARBY_COPY.path.direct
}

/** The plain phrase for why a node was heard ("while you listened"). */
export function causePhrase(cause: CauseId): string {
  const c = NEARBY_COPY.cause
  switch (cause) {
    case "radio-ready":
    case "listen-burst":
    case "custody-ack":
    case "network-joined":
      return c[cause]
    default:
      return c.other
  }
}

/** "first heard when the radio board started listening", plus "latest: while you listened" once it differs. */
export function causeLines(h: Pick<HeardEntry, "cause" | "firstCause" | "count">): string[] {
  const first = NEARBY_COPY.firstHeard(causePhrase(h.firstCause))
  if (h.count < 2 || causePhrase(h.cause) === causePhrase(h.firstCause)) return [first]
  return [first, NEARBY_COPY.latest(causePhrase(h.cause))]
}

/** A relay forwards sealed traffic and cannot read it (plan §6.8). */
export function isRelay(id: PeerId, world: World): boolean {
  const c = castById(world, id)
  return c !== undefined && !c.canRead
}

/** Plain device words of a heard node ("radio relay", "home server"), or null. */
export function deviceWords(id: PeerId, world: World): string | null {
  return castById(world, id)?.deviceLabel ?? null
}

// -------------------------------------------------------------------------------- order and groups

/** Real sortedNodes: nearest first (heard directly before through a relay), then by name, then by id. */
export function sortedHeard(entries: readonly HeardEntry[], world: World): HeardEntry[] {
  const hops = (h: HeardEntry) => (relayOf(h) === null ? 0 : 1)
  return [...entries].sort((a, b) => hops(a) - hops(b) || nodeName(world, a.id).localeCompare(nodeName(world, b.id)) || a.id.localeCompare(b.id))
}

export interface HeardGroup {
  medium: Medium
  entries: HeardEntry[]
}

const MEDIUM_ORDER: readonly Medium[] = ["radio", "wifi", "bluetooth", "internet"]

/** One group per way of hearing, in a fixed order (real: one panel per source), each sorted. */
export function groupHeard(entries: readonly HeardEntry[], world: World): HeardGroup[] {
  return MEDIUM_ORDER.map((medium) => ({ medium, entries: sortedHeard(entries.filter((h) => h.via === medium), world) })).filter(
    (g) => g.entries.length > 0,
  )
}

/** A group's heading (real sourceHeading): the radio one names the board by its alias, else its name. */
export function groupHeading(medium: Medium, radio: Pick<RadioBoard, "alias" | "name"> | null): string {
  const s = NEARBY_COPY.source
  switch (medium) {
    case "radio":
      return s.radio(radio ? (radio.alias ?? radio.name) : RADIO_BOARD_NAME)
    case "wifi":
      return s.wifi
    case "bluetooth":
      return s.bluetooth
    case "internet":
      return s.internet
  }
}
