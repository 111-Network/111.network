// The sample world of /demo (plan §6.5 "Copy"): this node, the cast, the service registry, the
// preferred networks and the radio regions. Plain TS, seeded and deterministic.
//
// Labels come from groupedLabel (a–z and 2–7 only) and are display-only. There are no enrollment
// codes, pair codes or lockouts anywhere in the demo (plan §6.8).
import { deviceById, type DeviceId } from "@/lib/devices"
import { groupedLabel } from "@/lib/labels"
import type { LayerNumber } from "@/lib/layers"
import { CAST_COPY, MEDIUM_LABEL, NETWORK_COPY, OWN_BADGE, OWN_FACT_LINES, RADIO_BOARD_NAME, REGIONS, SERVICE_COPY } from "../copy/core"
import { HOUR, MIN } from "./clock"
import type { CastId, Medium, NetworkId, PeerId, ServiceId, ServiceState } from "./types"

/** One service registry row (real `ServiceRecord`, in plain words; no technical name, no detail blob). */
export interface DemoService {
  id: ServiceId
  /** Plain name, e.g. "Local AI agent" (real `plain_name`). */
  name: string
  layer: LayerNumber
  state: ServiceState
  /** One plain sentence. */
  reason: string
  canRunHere: boolean
  /** 2–3 plain sentences: what it is. */
  description: string
  requires: string | null
  /** "agent": an unset row offers "Set up with the agent". "none": it turns live by itself (the gateway). */
  setup: "agent" | "none"
  /** A role granted by circumstance, not hardware (the gateway). The node chip never changes for it. */
  overlay: boolean
  /** Knowledge base note for the recipe, "drawer/note", or null. The KB view provides these notes. */
  kb: string | null
  /** Virtual ms of the last state change. */
  since: number
}

/** This node's hardware facts, the inputs of the bootstrap rule (plan §6.8). */
export interface OwnFacts {
  wifi: boolean
  /** Its Wi-Fi can host a hotspot. */
  hotspot: boolean
  bluetooth: boolean
  ethernet: boolean
  usb: boolean
}

export interface OwnNode {
  id: "workshop-laptop"
  name: string
  device: DeviceId
  /** Plain device words for the node chip: "LAPTOP". */
  badge: string
  label: string
  facts: OwnFacts
  /** The facts as plain lines (without the radio line; that one follows the board). */
  factLines: readonly string[]
}

export interface CastNode {
  id: PeerId
  name: string
  kind: "person" | "hub" | "relay"
  device: DeviceId
  /** Plain device words from src/lib/devices.ts ("old phone", "radio relay" …). */
  deviceLabel: string
  label: string
  /** How this node is normally reached in the sample world. */
  reach: Medium
  /** Relays forward sealed traffic and cannot read it. */
  canRead: boolean
  blurb: string
}

export interface PreferredNetwork {
  id: NetworkId
  name: string
  medium: Medium
  mediumLabel: string
  /** Needs a radio board before it can be heard at all. */
  needsRadio: boolean
}

export interface World {
  seed: string
  self: OwnNode
  /** Every other node, in a stable order. */
  cast: readonly CastNode[]
  /** The registry at the moment the demo opens, in sidebar order. */
  services: readonly DemoService[]
  /** The preferred list, in the order it is tried. */
  networks: readonly PreferredNetwork[]
  regions: readonly string[]
  radioBoardName: string
  /**
   * This node's home hub, reached over the local Wi-Fi (it takes custody of sealed messages). Heard
   * over Wi-Fi it is the home link, not a mesh neighbour: see selectors meshNeighbours / homeHubHeard.
   */
  homeHub: PeerId
}

interface ServiceSeed {
  id: ServiceId
  layer: LayerNumber
  state: ServiceState
  setup?: "agent" | "none"
  overlay?: boolean
  kb: string | null
  sinceMs: number
}

/** Registry order = sidebar order. Bridge, Storage and Repairs are the demo's new Layer 6–9 services. */
const SERVICE_SEEDS: readonly ServiceSeed[] = [
  { id: "agent", layer: 3, state: "live", kb: "concepts/local-agent", sinceMs: 7 * HOUR },
  { id: "model", layer: 3, state: "live", kb: "local-models/small-local-model", sinceMs: 7 * HOUR },
  { id: "mesh", layer: 6, state: "live", kb: "concepts/preferred-networks", sinceMs: 7 * HOUR },
  { id: "radio", layer: 6, state: "unset", kb: "recipes/set-up-a-radio-board", sinceMs: 7 * HOUR },
  { id: "kb", layer: 0, state: "live", kb: null, sinceMs: 7 * HOUR },
  { id: "gateway", layer: 7, state: "unset", setup: "none", overlay: true, kb: "concepts/gateway-role", sinceMs: 3 * HOUR },
  { id: "messaging", layer: 5, state: "live", kb: "concepts/store-and-forward", sinceMs: 7 * HOUR },
  { id: "bridge", layer: 6, state: "unset", kb: "concepts/thin-bridge", sinceMs: 7 * HOUR },
  { id: "storage", layer: 8, state: "live", kb: "concepts/capacity-pruning", sinceMs: 7 * HOUR },
  { id: "repairs", layer: 9, state: "live", kb: "concepts/sandbox-first", sinceMs: 7 * HOUR + 12 * MIN },
]

function serviceFrom(seed: ServiceSeed): DemoService {
  const copy = SERVICE_COPY[seed.id]
  return {
    id: seed.id,
    name: copy.name,
    layer: seed.layer,
    state: seed.state,
    reason: copy.reasons[seed.state],
    canRunHere: true,
    description: copy.description,
    requires: copy.requires,
    setup: seed.setup ?? "agent",
    overlay: seed.overlay ?? false,
    kb: seed.kb,
    since: -seed.sinceMs,
  }
}

const CAST_SEEDS: readonly { id: PeerId; kind: CastNode["kind"]; device: DeviceId; reach: Medium }[] = [
  { id: "ada", kind: "person", device: "old-phone", reach: "wifi" },
  { id: "bram", kind: "person", device: "radio-box", reach: "radio" },
  { id: "workshop-hub", kind: "hub", device: "home-server", reach: "wifi" },
  { id: "ridge-repeater", kind: "relay", device: "radio-relay", reach: "radio" },
  { id: "valley-hub", kind: "hub", device: "home-server", reach: "radio" },
]

const NETWORK_SEEDS: readonly { id: NetworkId; medium: Medium; needsRadio: boolean }[] = [
  { id: "network-a", medium: "radio", needsRadio: true },
  { id: "network-b", medium: "wifi", needsRadio: false },
  { id: "network-c", medium: "bluetooth", needsRadio: false },
]

/** The grouped label of a node in a world seeded with `seed`. */
export function labelFor(seed: string, id: CastId): string {
  return groupedLabel(`${seed}:${id}`)
}

export function createWorld(seed = "111-demo"): World {
  const facts: OwnFacts = { wifi: true, hotspot: true, bluetooth: true, ethernet: false, usb: true }
  return {
    seed,
    self: {
      id: "workshop-laptop",
      name: CAST_COPY["workshop-laptop"].name,
      device: "laptop",
      badge: OWN_BADGE,
      label: labelFor(seed, "workshop-laptop"),
      facts,
      factLines: [OWN_FACT_LINES.wifi, OWN_FACT_LINES.bluetooth, OWN_FACT_LINES.usb, OWN_FACT_LINES.noEthernet],
    },
    cast: CAST_SEEDS.map((c) => ({
      id: c.id,
      name: CAST_COPY[c.id].name,
      kind: c.kind,
      device: c.device,
      deviceLabel: deviceById(c.device).label,
      label: labelFor(seed, c.id),
      reach: c.reach,
      canRead: c.kind !== "relay",
      blurb: CAST_COPY[c.id].blurb,
    })),
    services: SERVICE_SEEDS.map(serviceFrom),
    networks: NETWORK_SEEDS.map((n) => ({
      id: n.id,
      name: NETWORK_COPY[n.id].name,
      medium: n.medium,
      mediumLabel: MEDIUM_LABEL[n.medium],
      needsRadio: n.needsRadio,
    })),
    regions: REGIONS,
    radioBoardName: RADIO_BOARD_NAME,
    homeHub: "workshop-hub",
  }
}

/** The world /demo and the L4 teaser use. */
export const DEMO_WORLD: World = createWorld()

/** A cast node by id (undefined for this node's own id or an unknown one). */
export function castById(world: World, id: string): CastNode | undefined {
  return world.cast.find((c) => c.id === id)
}

/** Display name of any node id, this node included; the id itself when unknown. */
export function nodeName(world: World, id: string): string {
  if (id === world.self.id) return world.self.name
  return castById(world, id)?.name ?? id
}

export function networkById(world: World, id: NetworkId): PreferredNetwork {
  const n = world.networks.find((x) => x.id === id)
  if (!n) throw new Error(`unknown network ${id}`)
  return n
}

/** Every label in the world (this node first), for the alphabet test. */
export function allLabels(world: World): string[] {
  return [world.self.label, ...world.cast.map((c) => c.label)]
}
