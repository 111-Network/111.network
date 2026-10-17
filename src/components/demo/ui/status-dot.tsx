import { cn } from "@/lib/utils"
import { DOT_CLASS, DOT_LABEL, dotLabelEmphasis, statusDotText, type DotState } from "./status"

export type { DotState } from "./status"

/** Props of StatusDot. */
export interface StatusDotProps {
  state: DotState
  /**
   * Show the text label next to the dot. Default true. Pass false ONLY where the same state word is
   * already printed beside the dot (the sidebar's state column, the rail's tooltip row); the label is
   * then kept for screen readers, so the dot is never unlabelled.
   */
  label?: boolean
  /** Names the thing the dot describes; used in the screen-reader text when the label is hidden. */
  name?: string
  className?: string
}

/**
 * A 2×2 square status dot with its label (LIVE / NOT SET / ERROR / STARTING / UNKNOWN). Only for
 * service and node state, only on dark surfaces. Server-safe.
 */
export function StatusDot({ state, label = true, name, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className={cn("inline-block h-2 w-2 shrink-0", DOT_CLASS[state])} />
      {label ? (
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            dotLabelEmphasis(state) === "strong" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {DOT_LABEL[state]}
        </span>
      ) : (
        <span className="sr-only">{statusDotText(state, name)}</span>
      )}
    </span>
  )
}
