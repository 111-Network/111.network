import { StatusDot, type StatusState } from "@/components/common/status-dot"
import { cn } from "@/lib/utils"
import {
  LINKS,
  NODES,
  NODE_IDS,
  WORLD_EDGE,
  isGateway,
  isOnline,
  linkState,
  packetPlacement,
  reachOf,
  roleOf,
  type LabelSide,
  type Link,
  type NodeId,
  type PresenceState,
  type Reach,
} from "./model"
import { FOCUS_OFFSET, FOCUS_RING } from "./styles"

// The Presence Map (port of V4's NetworkMap): role-tagged square nodes under a
// "wider world" band, mesh links between them, an uplink from every gateway
// to the band, and the one packet. Real <button>s select a node. Rendered only
// inside the client board (it takes a function prop).

/** Plain-words description of the drawing for screen readers. */
const MAP_DESCRIPTION =
  "Five nodes under the wider world band. The phone reaches the relay, the laptop and the radio box. The relay also reaches the laptop, the home server and the radio box. The home server and the radio box reach each other. Every gateway has a line up to the wider world."

const GRID = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

// Below 640 px every role label sits under the square; from 640 px up the
// upper pair moves beside it (outward), and "below" nodes keep it underneath.
const LABEL_SIDE: Readonly<Record<LabelSide, string>> = {
  below: "top-full left-1/2 -mt-1 -translate-x-1/2 items-center",
  left: "top-full left-1/2 -mt-1 -translate-x-1/2 items-center sm:top-1/2 sm:right-full sm:left-auto sm:mt-0 sm:-mr-1 sm:translate-x-0 sm:-translate-y-1/2 sm:items-end",
  right: "top-full left-1/2 -mt-1 -translate-x-1/2 items-center sm:top-1/2 sm:left-full sm:mt-0 sm:-ml-1 sm:translate-x-0 sm:-translate-y-1/2 sm:items-start",
}

const REACH_DOT: Readonly<Record<Reach, { state: StatusState; label: string }>> = {
  "in-range": { state: "live", label: "in range" },
  silent: { state: "starting", label: "silent" },
  unreachable: { state: "error", label: "unreachable" },
}

/** The StatusDot props for a node's reachability (always labelled). */
export function reachDot(reach: Reach): { state: StatusState; label: string } {
  return REACH_DOT[reach]
}

function linkKey(a: NodeId, b: NodeId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function nodeName(view: PresenceState, id: NodeId): string {
  const node = view.nodes[id]
  const role = roleOf(id, node.mode)
  const what =
    role === "relay"
      ? "relay, repeats only"
      : role === "stream"
        ? "gateway, always online"
        : role === "flush"
          ? `gateway, online sometimes${isOnline(id, node.mode, view.beat) ? " and online now" : ""}`
          : "no internet"
  return `${NODES[id].label}: ${what}, ${REACH_DOT[reachOf(node, view.beat)].label}`
}

function squareClass(view: PresenceState, id: NodeId): string {
  const node = view.nodes[id]
  const reach = reachOf(node, view.beat)
  if (reach === "unreachable") return "border border-dashed border-muted-foreground/60 bg-card opacity-60"
  if (reach === "silent") return "border border-muted-foreground bg-card"
  if (isOnline(id, node.mode, view.beat)) return "border border-foreground bg-foreground"
  return "border border-foreground bg-card"
}

/** Props of PresenceMap. */
export interface PresenceMapProps {
  view: PresenceState
  /** True on a beat the clock just ticked: heard nodes show one heartbeat ring. */
  rings: boolean
  onSelect: (id: NodeId) => void
  /** id of the description paragraph (useId from the board). */
  descriptionId: string
}

/** The map box: band, grid, links, uplinks, node buttons and the packet. */
export function PresenceMap({ view, rings, onSelect, descriptionId }: PresenceMapProps) {
  const { nodes, beat, packet } = view
  const last = view.lanes.laptop.length - 1

  const routeLinks = new Set<string>()
  if (packet && packet.status !== "out") {
    for (let i = 1; i < packet.route.length; i++) routeLinks.add(linkKey(packet.route[i - 1], packet.route[i]))
  }

  const place = packet === null ? null : packetPlacement(packet)
  const packetPos =
    place === null ? null : { left: `calc(${place.x}% + ${place.dx}px)`, top: `calc(${place.y}% + ${place.dy}px)` }
  const tagLeft = place !== null && place.tag === "left"

  return (
    <div
      role="group"
      aria-label="Presence map, pick one node"
      aria-describedby={descriptionId}
      className="relative aspect-[4/3] w-full overflow-hidden border border-border bg-background sm:aspect-[16/9]"
    >
      <p id={descriptionId} className="sr-only">
        {MAP_DESCRIPTION}
      </p>

      {/* Control-room grid (V4). */}
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.06]">
        {GRID.map((i) => (
          <div key={`h-${i}`} className="absolute h-px w-full bg-foreground" style={{ top: `${i * 10}%` }} />
        ))}
        {GRID.map((i) => (
          <div key={`v-${i}`} className="absolute top-0 h-full w-px bg-foreground" style={{ left: `${i * 10}%` }} />
        ))}
      </div>

      {/* The wider world: what gateways sync the offline mesh with. */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-center border-b border-foreground/50 bg-card"
        style={{ height: `${WORLD_EDGE}%` }}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">wider world</span>
      </div>

      <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
        {NODE_IDS.filter((id) => isGateway(id, nodes[id].mode)).map((id) => {
          const online = isOnline(id, nodes[id].mode, beat)
          return (
            <line
              key={`up-${id}`}
              x1={`${NODES[id].x}%`}
              y1={`${NODES[id].y}%`}
              x2={`${NODES[id].x}%`}
              y2={`${WORLD_EDGE}%`}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray={online ? undefined : "3 5"}
              opacity={nodes[id].outSince === null ? 1 : 0.4}
              className={cn("transition-colors duration-300", online ? "text-foreground/70" : "text-muted-foreground/50")}
            />
          )
        })}
        {LINKS.map((link: Link) => {
          const [a, b] = link
          const state = linkState(nodes, link, beat)
          const onRoute = routeLinks.has(linkKey(a, b))
          return (
            <line
              key={linkKey(a, b)}
              x1={`${NODES[a].x}%`}
              y1={`${NODES[a].y}%`}
              x2={`${NODES[b].x}%`}
              y2={`${NODES[b].y}%`}
              stroke="currentColor"
              strokeWidth={onRoute ? 1.5 : 1}
              strokeDasharray={onRoute ? undefined : state === "down" ? "2 6" : "4 4"}
              className={cn(
                "transition-colors duration-300",
                onRoute ? "text-foreground" : state === "down" ? "text-border" : "text-muted-foreground/50",
              )}
            />
          )
        })}
      </svg>

      {NODE_IDS.map((id) => {
        const node = NODES[id]
        const state = nodes[id]
        const reach = reachOf(state, beat)
        const selected = view.selected === id
        const heard = view.lanes[id][last] === "heard"
        return (
          <button
            key={id}
            type="button"
            aria-current={selected ? "true" : undefined}
            aria-label={nodeName(view, id)}
            onClick={() => onSelect(id)}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            className={cn(
              "absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center border transition-colors duration-200",
              selected ? "border-foreground" : "border-transparent hover:border-muted-foreground/60",
              FOCUS_RING,
              FOCUS_OFFSET,
            )}
          >
            <span aria-hidden="true" className={cn("relative block", node.canBeGateway ? "h-6 w-6 sm:h-7 sm:w-7" : "h-4 w-4", squareClass(view, id))}>
              {rings && heard ? <span key={beat} className="absolute -inset-px animate-ping-once border border-foreground" /> : null}
            </span>
            <span
              aria-hidden="true"
              className={cn("absolute flex flex-col gap-0.5 font-mono leading-tight whitespace-nowrap", LABEL_SIDE[node.side])}
            >
              <span className="bg-card px-1 text-[10px] text-foreground">{node.label}</span>
              {reach !== "in-range" ? (
                <StatusDot {...REACH_DOT[reach]} className="gap-1 bg-card px-1 text-[9px] tracking-normal text-muted-foreground" />
              ) : isGateway(id, state.mode) ? (
                <span className="bg-card px-1 text-[9px] text-muted-foreground">gateway</span>
              ) : null}
            </span>
          </button>
        )
      })}

      {packet !== null && packetPos !== null ? (
        <span
          key={packet.id}
          aria-hidden="true"
          className="pointer-events-none absolute z-20 motion-safe:transition-[left,top] motion-safe:duration-500 motion-safe:ease-out"
          style={packetPos}
        >
          {/* Centre the 10 px square on the anchor, whichever side its tag is on. */}
          <span
            className={cn("flex items-center gap-1.5", tagLeft && "flex-row-reverse")}
            style={{ transform: tagLeft ? "translate(calc(-100% + 5px), -50%)" : "translate(-5px, -50%)" }}
          >
            <span className="block h-2.5 w-2.5 shrink-0 bg-foreground outline outline-1 outline-offset-1 outline-background" />
            {packet.status === "waiting" ? (
              <span className="border border-dashed border-foreground bg-card px-1 font-mono text-[9px] tracking-widest text-foreground">
                WAITING
              </span>
            ) : packet.status === "out" ? (
              <span className="bg-card px-1 font-mono text-[9px] tracking-widest text-foreground">OUT</span>
            ) : null}
          </span>
        </span>
      ) : null}
    </div>
  )
}
