import { cn } from "@/lib/utils"

/** Service / node state shown by a StatusDot. */
export type StatusState = "live" | "unset" | "error" | "starting"

const DOT: Record<StatusState, string> = {
  live: "bg-status-live",
  unset: "bg-status-unset",
  error: "bg-status-error",
  starting: "bg-status-unset animate-blink",
}

const DEFAULT_LABEL: Record<StatusState, string> = {
  live: "LIVE",
  unset: "NOT SET",
  error: "ERROR",
  starting: "STARTING",
}

/** Props of StatusDot. */
export interface StatusDotProps {
  state: StatusState
  /** Text shown next to the dot; defaults to LIVE / NOT SET / ERROR / STARTING. */
  label?: string
  /** Classes for the wrapper; the label inherits its text colour. */
  className?: string
}

/**
 * A 2×2 square status dot that ALWAYS carries a text label (DESIGN.md D15).
 * Use it only for service/node state (never for grades, delivery pips, shelves
 * or badges) and only on dark surfaces: green on white fails contrast.
 * "starting" = grey dot + blink, never a fourth colour.
 */
export function StatusDot({ state, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest", className)}>
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0", DOT[state])} />
      <span>{label ?? DEFAULT_LABEL[state]}</span>
    </span>
  )
}
