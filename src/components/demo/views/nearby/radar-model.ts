// The radar's geometry (plan §6.4), pure. Real views/nearby/radar.ts drew rings and this node only,
// because the real node did not know who was around yet; the demo draws the heard nodes too, each
// one placed by HOW it is heard (the rings), never by a distance the node cannot know. Nothing here
// moves by itself: the radar is redrawn only when the store changes, and a node pulses once only
// for a hear that has a cause (see shouldPulse).
import type { HeardEntry } from "../../engine/core"
import type { PeerId } from "../../engine/types"
import { castById, nodeName, type CastNode, type World } from "../../engine/world"
import { relayOf } from "./model"

/** The drawing, in viewBox units (the SVG scales to its container). */
export const RADAR = {
  width: 240,
  height: 200,
  cx: 120,
  cy: 104,
  /** Ring 1 = heard directly, ring 2 = heard through a relay. */
  rings: [40, 78] as const,
  /** The home hub over Wi-Fi sits apart, outside the rings: it is the home link, not a neighbour. */
  home: { x: 30, y: 168 },
  /** Where the internet link of the gateway overlay points. */
  internet: { x: 22, y: 16 },
  /** A hear this recent when the radar mounts still pulses (you arrived while nodes were blipping in). */
  recentMs: 3000,
} as const

/** Where each node of the sample world sits on its ring (degrees; 0 = east, negative = up). */
const ANGLE: Readonly<Record<PeerId, number>> = {
  "ridge-repeater": -40,
  "valley-hub": -100,
  bram: -15,
  ada: 200,
  "workshop-hub": 140,
}

export interface RadarPoint {
  x: number
  y: number
}

export interface RadarNode extends RadarPoint {
  id: PeerId
  name: string
  kind: CastNode["kind"] | "unknown"
  /** 1 = heard directly, 2 = through a relay. */
  ring: 1 | 2
  /** The relay's point when that relay is on the radar too (a dashed line joins them), else null. */
  relayFrom: RadarPoint | null
  /** core.blipSeq of its latest hear: the pulse key is `${id}:${blip}`. */
  blip: number
  lastAt: number
}

const round = (n: number): number => Math.round(n * 10) / 10

/** A point on ring `ring` at `deg` degrees around the centre. */
export function polar(ring: 1 | 2, deg: number): RadarPoint {
  const r = RADAR.rings[ring - 1]
  const a = (deg * Math.PI) / 180
  return { x: round(RADAR.cx + r * Math.cos(a)), y: round(RADAR.cy + r * Math.sin(a)) }
}

/** The ring of a heard node: directly, or through a relay. */
export function ringOf(h: Pick<HeardEntry, "id" | "via">): 1 | 2 {
  return relayOf(h) === null ? 1 : 2
}

/** Every mesh neighbour as a radar node, in the order first heard. */
export function radarNodes(neighbours: readonly HeardEntry[], world: World): RadarNode[] {
  const placed = new Map<PeerId, RadarPoint>()
  for (const h of neighbours) placed.set(h.id, polar(ringOf(h), ANGLE[h.id]))
  return neighbours.map((h) => {
    const p = placed.get(h.id) as RadarPoint
    const relay = relayOf(h)
    return {
      id: h.id,
      name: nodeName(world, h.id),
      kind: castById(world, h.id)?.kind ?? "unknown",
      ring: ringOf(h),
      x: p.x,
      y: p.y,
      relayFrom: relay ? (placed.get(relay) ?? null) : null,
      blip: h.blip,
      lastAt: h.lastAt,
    }
  })
}

/** What the radar knew when it mounted: hears up to here do not replay their pulse. */
export interface PulseBase {
  blip: number
  now: number
}

/**
 * Pulse once for a hear that happened while the radar is on screen, or just before it mounted
 * (RADAR.recentMs): opening the view never replays old hears, so nothing moves without a cause.
 * Never under reduced motion.
 */
export function shouldPulse(h: Pick<RadarNode, "blip" | "lastAt">, base: PulseBase, reduced: boolean): boolean {
  if (reduced) return false
  return h.blip > base.blip || base.now - h.lastAt <= RADAR.recentMs
}

/** Label baseline under a marker. */
export const labelY = (p: RadarPoint, gap = 11): number => round(p.y + gap)
