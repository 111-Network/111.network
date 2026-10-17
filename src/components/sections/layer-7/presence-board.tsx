"use client"

import { useEffect, useId, useMemo, useReducer, useRef, type ReactNode } from "react"
import { ChipGroup, type ChipOption } from "@/components/common/chip-group"
import { LiveLine } from "@/components/common/live-line"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { StatusDot } from "@/components/common/status-dot"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { HeartbeatLanes } from "./heartbeat-lanes"
import {
  BEAT_MS,
  INTERNET_LABELS,
  INTERNET_MODES,
  NODES,
  ORIGIN,
  createInitialState,
  isActive,
  pathLine,
  presenceReducer,
  reachOf,
  roleLine,
  roleOf,
  settle,
  type InternetMode,
  type NodeId,
} from "./model"
import { PresenceMap, reachDot } from "./presence-map"
import { FOCUS_OFFSET, FOCUS_RING } from "./styles"

// The L7 client island: Presence Map + controls + Heartbeat Lanes, one state.
// The section runs ONE JS loop (the beat clock). It ticks only while the board
// is in view, the tab is visible, motion is allowed, and something a click
// caused is still resolving; idle, nothing moves. Under reduced motion every
// action resolves to its final state at once (travel cuts to the destination).

const MODE_OPTIONS: readonly ChipOption<InternetMode>[] = INTERNET_MODES.map((mode) => ({
  value: mode,
  label: INTERNET_LABELS[mode],
}))

const SECONDARY_BUTTON = cn(
  "inline-flex min-h-11 items-center justify-center border border-border px-4 font-mono text-xs text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground sm:min-h-9",
  FOCUS_RING,
)

const PRIMARY_BUTTON = cn(
  "group inline-flex min-h-11 items-center justify-center gap-2 border border-foreground bg-foreground px-4 font-mono text-xs tracking-widest text-background transition-colors duration-200 hover:bg-transparent hover:text-foreground sm:min-h-9",
  FOCUS_RING,
  FOCUS_OFFSET,
)

/** Props of PresenceBoard: static, server-rendered parts of the lanes card. */
export interface PresenceBoardProps {
  lanesLegend: ReactNode
  lanesCaption: ReactNode
}

/** Presence Map + Heartbeat Lanes, driven by real buttons and one in-view clock. */
export function PresenceBoard({ lanesLegend, lanesCaption }: PresenceBoardProps) {
  const [state, dispatch] = useReducer(presenceReducer, null, createInitialState)
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInViewPlay(rootRef)
  const reduced = useReducedMotion()
  const descriptionId = useId()

  // Reduced motion shows the settled state, so nothing is ever left mid-way.
  const view = useMemo(() => (reduced ? settle(state) : state), [reduced, state])
  const running = inView && !reduced && isActive(state)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => dispatch({ type: "tick" }), BEAT_MS)
    return () => window.clearInterval(id)
  }, [running])

  const selected = view.selected
  const selectedNode = view.nodes[selected]
  const reach = reachOf(selectedNode, view.beat)
  const role = roleOf(selected, selectedNode.mode)
  const inRange = selectedNode.outSince === null
  const rings = !reduced && view.pulseBeat === view.beat

  const onSelect = (id: NodeId) => dispatch({ type: "select", id, settle: reduced })
  const onMode = (mode: InternetMode) => dispatch({ type: "setMode", id: selected, mode, settle: reduced })
  const onRange = () => dispatch({ type: "setRange", id: selected, inRange: !inRange, settle: reduced })
  const onSend = () => dispatch({ type: "send", settle: reduced })

  const path = view.packet
    ? `${pathLine(view.nodes, view.packet)}${view.packet.status === "waiting" ? " · waiting" : view.packet.status === "out" ? " · out" : ""}`
    : null

  return (
    <div ref={rootRef} className="grid gap-4 lg:grid-cols-3">
      <Panel className="flex min-w-0 flex-col lg:col-span-2">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Presence map</span>
          </span>
          <SimulationChip />
        </div>

        <div className="p-3 sm:p-4">
          <PresenceMap view={view} rings={rings} onSelect={onSelect} descriptionId={descriptionId} />
          <p className="mt-2 min-h-[2lh] font-mono text-[10px] leading-relaxed text-muted-foreground sm:min-h-0">
            {path === null ? (
              `Sends start at ${NODES[ORIGIN].the} and follow a path formed from what is reachable now.`
            ) : (
              <>
                <span className="mr-2 uppercase tracking-widest text-foreground">Path</span>
                {path}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Node</span>
            <span className="font-mono text-sm font-bold text-foreground">{NODES[selected].label}</span>
            <StatusDot {...reachDot(reach)} className="text-muted-foreground" />
          </div>
          <p className="-mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{roleLine(role)}</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Internet</span>
            <ChipGroup
              aria-label={`internet for ${NODES[selected].the}`}
              value={selectedNode.mode}
              onValueChange={onMode}
              options={MODE_OPTIONS}
              disabled={!NODES[selected].canBeGateway}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onRange} className={SECONDARY_BUTTON}>
              {inRange ? "move out of range" : "back in range"}
              <span className="sr-only">{` (${NODES[selected].the})`}</span>
            </button>
            <button type="button" onClick={onSend} className={PRIMARY_BUTTON}>
              SEND TO THE OUTSIDE
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                {"->"}
              </span>
            </button>
          </div>

          {/* Reserve the longest narration (4 lines at 375 px, 2 from 640 px) so beat-driven text never shifts the lanes below. */}
          <LiveLine className="min-h-[4lh] text-[11px] leading-relaxed sm:min-h-[2lh]">{view.notice}</LiveLine>
        </div>
      </Panel>

      <HeartbeatLanes view={view} legend={lanesLegend} caption={lanesCaption} />
    </div>
  )
}
