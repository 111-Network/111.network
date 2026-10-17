import { LayerSection } from "@/components/common/layer-section"
import { getLayer } from "@/lib/layers"
import { cn } from "@/lib/utils"
import { PresenceBoard } from "./presence-board"
import { LANE_CELL_CLASS, LANE_LEGEND } from "./styles"

// Layer 7 · Relay & Presence: "Presence Map" + "Heartbeat Lanes" (plan §5 L7,
// V4 + V9 lanes). V4's inverted header band labelled HEARTBEAT; the map and
// the lanes sit on dark cards so their status dots stay legible. Header, specs,
// legend and caption render here on the server; only the board is a client island.

// The band label. From 640 px it sits right of the title (V4); on phones it
// moves under the description, so the title column keeps its width.
function HeartbeatTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "w-fit border border-background/40 px-2 py-1 font-mono text-[10px] tracking-widest text-background/70",
        className,
      )}
    >
      HEARTBEAT
    </span>
  )
}

function LanesLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-4 py-2">
      {LANE_LEGEND.map(({ cell, label }) => (
        <span key={cell} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2.5 w-4", LANE_CELL_CLASS[cell])} />
          <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
        </span>
      ))}
    </div>
  )
}

function LanesCaption() {
  return (
    <p className="border-t border-border px-4 py-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
      One lane per node, beat by beat, following the map. A lone tick is a heartbeat. Bursts are a gateway that gets
      online sometimes, solid is one that is always online, and an empty lane is a node out of range.
    </p>
  )
}

/** Layer 7 · Relay & Presence. */
export function Layer7() {
  const layer = getLayer(7)
  // Below 640 px the right slot's wrapper (last div of the title row) is hidden
  // so its flex gap does not narrow the title; from 640 px the aside wrapper
  // (the header's last div) is hidden instead, so it adds no space to the band.
  return (
    <LayerSection
      n={7}
      variant="inverted"
      headerRight={<HeartbeatTag className="hidden sm:inline-flex" />}
      aside={<HeartbeatTag className="inline-flex sm:hidden" />}
      headerClassName="mb-4 md:mb-4 max-sm:[&>div:first-child>div:last-child]:hidden sm:[&>div:last-child]:hidden"
    >
      <PresenceBoard lanesLegend={<LanesLegend />} lanesCaption={<LanesCaption />} />
      <dl className="mt-4 flex flex-wrap gap-3">
        {layer.specs.map((spec) => (
          <div
            key={spec.label}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border border-border bg-card px-4 py-2 font-mono text-xs shadow-panel"
          >
            <dt className="text-muted-foreground">{spec.label}</dt>
            <dd className="font-bold text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </LayerSection>
  )
}
