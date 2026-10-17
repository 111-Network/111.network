import { cn } from "@/lib/utils"
import { sparkGlyphs, sparkPath } from "./spark"

/** Props of Sparkline. */
export interface SparklineProps {
  values: readonly number[]
  /** Required: what the chart says, in words (the glyphs or the line are hidden from AT). */
  label: string
  min?: number
  max?: number
  /** "glyphs" (default, as in the real dashboard) = block characters; "line" = a thin SVG line. */
  variant?: "glyphs" | "line"
  /** Size the line variant with h-* / w-* classes (default h-4 w-24). */
  className?: string
}

const VIEW_W = 100
const VIEW_H = 20

/** A tiny trend, labelled in words. Static: it redraws only when the store hands it new values. Server-safe. */
export function Sparkline({ values, label, min, max, variant = "glyphs", className }: SparklineProps) {
  if (variant === "line" && values.length > 0) {
    return (
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        focusable="false"
        className={cn("inline-block h-4 w-24 overflow-visible text-foreground", className)}
      >
        <path
          d={sparkPath(values, { width: VIEW_W, height: VIEW_H, min, max })}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeLinecap="square"
          strokeLinejoin="miter"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }
  return (
    <span role="img" aria-label={label} className={cn("inline-block font-mono leading-none tracking-normal text-foreground", className)}>
      <span aria-hidden="true">{values.length === 0 ? "—" : sparkGlyphs(values, min, max)}</span>
    </span>
  )
}
