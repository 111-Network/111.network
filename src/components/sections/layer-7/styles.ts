import type { LaneCell } from "./model"

// Shared by the server legend (index.tsx) and the client lanes, so a legend
// swatch always matches the cells it explains. Grayscale only: lane cells are
// not status dots (DESIGN.md D15).

/** Fill of one heartbeat-lane cell. */
export const LANE_CELL_CLASS: Readonly<Record<LaneCell, string>> = {
  heard: "bg-foreground",
  quiet: "bg-foreground/15",
  gone: "border border-dashed border-muted-foreground/60",
}

/** Legend entries, in order (plan §5 L7: Heard / Quiet / Gone). */
export const LANE_LEGEND: readonly { cell: LaneCell; label: string }[] = [
  { cell: "heard", label: "Heard" },
  { cell: "quiet", label: "Quiet" },
  { cell: "gone", label: "Gone" },
]

/** The focus ring every control on the dark cards uses (P0 contract). */
export const FOCUS_RING = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"

/** Extra offset for white (inverted or active) controls, so the ring stays visible. */
export const FOCUS_OFFSET = "focus-visible:ring-offset-2 focus-visible:ring-offset-background"
