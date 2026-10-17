import type { LayerSupport } from "@/lib/devices"
import { cn } from "@/lib/utils"

/**
 * The CSS square of a layer-strip cell (DESIGN.md Glyphs: indicators are
 * shapes, never glyphs and never status dots): filled = runs, dashed with a
 * half fill = partly / via a nearby node, hollow = not run.
 */
export function SupportMark({ support, className }: { support: LayerSupport; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-3 w-3 shrink-0 transition-colors duration-200",
        support === "runs" && "border border-foreground bg-foreground",
        support === "partly" && "border border-dashed border-foreground",
        support === "none" && "border border-muted-foreground/50",
        className,
      )}
    >
      {support === "partly" && <span className="block h-full w-1/2 bg-foreground" />}
    </span>
  )
}
