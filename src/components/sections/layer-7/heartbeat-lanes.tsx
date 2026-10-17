import type { ReactNode } from "react"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { cn } from "@/lib/utils"
import { NODES, NODE_IDS, laneSummary, laneTag, type PresenceState } from "./model"
import { LANE_CELL_CLASS } from "./styles"

// Heartbeat Lanes (port of V9's ProfilerLanes): one lane per node, beat by
// beat, scripted from the map state (never random). The newest beat is on the
// right. The legend and caption are static and come from the server.

/** Props of HeartbeatLanes. */
export interface HeartbeatLanesProps {
  view: PresenceState
  /** Server-rendered legend row (Heard / Quiet / Gone). */
  legend: ReactNode
  /** Server-rendered caption. */
  caption: ReactNode
  className?: string
}

/** The lanes card. */
export function HeartbeatLanes({ view, legend, caption, className }: HeartbeatLanesProps) {
  return (
    <Panel className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 bg-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Heartbeat lanes</span>
        </span>
        <SimulationChip />
      </div>

      <div aria-hidden="true" className="flex items-center gap-3 border-b border-border px-4 py-1.5">
        <span className="w-24 shrink-0" />
        <span className="flex flex-1 justify-between font-mono text-[10px] text-muted-foreground">
          <span>earlier</span>
          <span>now</span>
        </span>
      </div>

      <ul aria-label="Heartbeat lanes, one per node" className="divide-y divide-border">
        {NODE_IDS.map((id) => (
          <li
            key={id}
            className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors duration-200", view.selected === id && "bg-secondary/60")}
          >
            <span aria-hidden="true" className="w-24 shrink-0 font-mono leading-tight">
              <span className="block text-[10px] text-foreground">{NODES[id].label}</span>
              <span className="block text-[9px] text-muted-foreground">{laneTag(id, view.nodes[id])}</span>
            </span>
            <span aria-hidden="true" className="flex h-3 min-w-0 flex-1 gap-px">
              {view.lanes[id].map((cell, i) => (
                <span key={i} className={cn("h-full min-w-0 flex-1", LANE_CELL_CLASS[cell])} />
              ))}
            </span>
            <span className="sr-only">{laneSummary(id, view.nodes[id])}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        {legend}
        {caption}
      </div>
    </Panel>
  )
}
