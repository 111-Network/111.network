// The Nearby radar (plan §6.4): its own lazy chunk. An SVG redrawn only when the store changes (a
// new hear, the gateway overlay), sized to its container by its viewBox. No sweep and no loop: a
// node pulses ONCE for a hear that has a cause (radio set up, a custody acknowledgement, a listen),
// keyed by the hear, and never again until it is heard again. Static under reduced motion. The list
// beside it (and the LIST view) carries the same facts for screen readers; this is one labelled image.
import { memo, useState } from "react"
import { NEARBY_COPY } from "../../copy/nearby"
import { useDemo, useDemoStore, useDemoWorld } from "../../engine/react"
import { homeHubHeard, meshNeighbours } from "../../engine/selectors"
import { nodeName } from "../../engine/world"
import { selectAlias } from "../../shell/select"
import { RADAR, labelY, radarNodes, shouldPulse, type RadarNode, type RadarPoint } from "./radar-model"
import { radarBaseOf, selectGatewayState, selectInternetSeq, type RadarBase } from "./select"

export interface RadarProps {
  /** Reduced motion: no pulse at all, the drawing is static. */
  reduced: boolean
}

const TEXT = "fill-muted-foreground font-mono"
const STRONG = "fill-foreground font-mono"
const FONT = 6
const SMALL = 5
/** One pulse ring: the P0 heartbeat ring, scaled around its own centre. */
const PULSE = "animate-ping-once fill-none stroke-foreground [transform-box:fill-box] origin-center"

function Marker({ p, kind, size }: { p: RadarPoint; kind: RadarNode["kind"] | "self" | "hub"; size: number }) {
  const h = size / 2
  if (kind === "relay") {
    // A relay: hollow (it forwards sealed traffic; it cannot read it).
    return <rect x={p.x - h} y={p.y - h} width={size} height={size} className="fill-background stroke-foreground" strokeWidth={1.2} />
  }
  return <rect x={p.x - h} y={p.y - h} width={size} height={size} className="fill-foreground" />
}

function Pulse({ p, size }: { p: RadarPoint; size: number }) {
  const h = size / 2
  return <rect x={p.x - h} y={p.y - h} width={size} height={size} className={PULSE} strokeWidth={1} />
}

const sizeOf = (kind: RadarNode["kind"]): number => (kind === "person" ? 5 : kind === "relay" ? 6 : 7)

/**
 * It reads the store itself, through selectors that change only with a hear, the gateway or the
 * node's name, so nothing else (the clock, another view's state) redraws it.
 */
function Radar({ reduced }: RadarProps) {
  const store = useDemoStore()
  const world = store.world
  const neighbours = useDemoWorld(meshNeighbours)
  const home = useDemoWorld(homeHubHeard)
  const gateway = useDemo(selectGatewayState)
  const internetSeq = useDemo(selectInternetSeq)
  const selfName = useDemo(selectAlias)
  // What was already known when the radar mounted, read once (a useState initialiser, never a ref),
  // with the scheduler's virtual clock: a hear older than RADAR.recentMs never replays its pulse.
  const [base] = useState<RadarBase>(() => radarBaseOf(store.getSnapshot(), store.scheduler.now()))
  const nodes = radarNodes(neighbours, world)
  const c: RadarPoint = { x: RADAR.cx, y: RADAR.cy }
  const r = NEARBY_COPY.radar
  const overlay = gateway === "live" || gateway === "starting"
  const label = r.describe({
    self: selfName,
    names: nodes.map((n) => n.name),
    home: home ? nodeName(world, home.id) : null,
    gateway: gateway === "live",
  })

  return (
    <svg viewBox={`0 0 ${RADAR.width} ${RADAR.height}`} role="img" aria-label={label} className="block h-auto w-full max-w-lg">
      {/* the two rings: how a node is heard, not how far it is */}
      {RADAR.rings.map((radius) => (
        <circle key={radius} cx={c.x} cy={c.y} r={radius} className="fill-none stroke-border" strokeDasharray="2 3" />
      ))}
      <text x={c.x} y={c.y + RADAR.rings[0] - 3} textAnchor="middle" fontSize={SMALL} className={TEXT}>
        {r.ringDirect}
      </text>
      <text x={c.x} y={c.y + RADAR.rings[1] - 3} textAnchor="middle" fontSize={SMALL} className={TEXT}>
        {r.ringRelay}
      </text>

      {/* the gateway overlay: a role this node holds while online (its chip never changes) */}
      {overlay ? (
        <g>
          <line
            x1={c.x}
            y1={c.y}
            x2={RADAR.internet.x}
            y2={RADAR.internet.y}
            className="stroke-muted-foreground"
            strokeWidth={0.8}
            strokeDasharray={gateway === "live" ? undefined : "2 2"}
          />
          <rect x={RADAR.internet.x - 4} y={RADAR.internet.y - 4} width={8} height={8} className="fill-background stroke-foreground" strokeWidth={1} />
          <text x={RADAR.internet.x} y={labelY(RADAR.internet)} textAnchor="middle" fontSize={FONT} className={STRONG}>
            {r.internet}
          </text>
          <rect
            x={c.x - 11}
            y={c.y - 11}
            width={22}
            height={22}
            className="fill-none stroke-foreground"
            strokeWidth={1}
            strokeDasharray={gateway === "live" ? undefined : "2 2"}
          />
          <text x={c.x} y={c.y - 14} textAnchor="middle" fontSize={SMALL} className={STRONG}>
            {gateway === "live" ? r.gateway : r.gatewayStarting}
          </text>
          {!reduced && internetSeq > base.event ? <Pulse key={`internet:${internetSeq}`} p={c} size={22} /> : null}
        </g>
      ) : null}

      {/* the home link, apart: your home hub over this Wi-Fi */}
      {home ? (
        <g>
          <line x1={c.x} y1={c.y} x2={RADAR.home.x} y2={RADAR.home.y} className="stroke-muted-foreground" strokeWidth={0.8} strokeDasharray="1 2" />
          <Marker p={RADAR.home} kind="hub" size={7} />
          {shouldPulse(home, base, reduced) ? <Pulse key={`${home.id}:${home.blip}`} p={RADAR.home} size={7} /> : null}
          <text x={RADAR.home.x} y={labelY(RADAR.home)} textAnchor="middle" fontSize={FONT} className={STRONG}>
            {nodeName(world, home.id)}
          </text>
          <text x={RADAR.home.x} y={labelY(RADAR.home, 18)} textAnchor="middle" fontSize={SMALL} className={TEXT}>
            {r.homeLink}
          </text>
        </g>
      ) : null}

      {/* who forwards for whom */}
      {nodes.map((n) =>
        n.relayFrom ? (
          <line
            key={`path:${n.id}`}
            x1={n.relayFrom.x}
            y1={n.relayFrom.y}
            x2={n.x}
            y2={n.y}
            className="stroke-muted-foreground"
            strokeWidth={0.6}
            strokeDasharray="1 2"
          />
        ) : null,
      )}

      {/* the heard nodes */}
      {nodes.map((n) => (
        <g key={n.id}>
          <Marker p={n} kind={n.kind} size={sizeOf(n.kind)} />
          {shouldPulse(n, base, reduced) ? <Pulse key={`${n.id}:${n.blip}`} p={n} size={sizeOf(n.kind)} /> : null}
          <text x={n.x} y={labelY(n)} textAnchor="middle" fontSize={FONT} className={STRONG}>
            {n.name}
          </text>
        </g>
      ))}

      {/* this node */}
      <Marker p={c} kind="self" size={8} />
      <text x={c.x} y={labelY(c, 14)} textAnchor="middle" fontSize={FONT} className={STRONG}>
        {selfName}
      </text>
    </svg>
  )
}

/** Memoised: a parent re-render with the same `reduced` never redraws it. */
export default memo(Radar)
