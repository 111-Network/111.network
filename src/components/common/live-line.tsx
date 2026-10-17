import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Props of LiveLine. */
export interface LiveLineProps {
  /** The current announcement; change it to announce. */
  children?: ReactNode
  /** Keep it for screen readers only. */
  visuallyHidden?: boolean
  className?: string
}

/**
 * The one polite aria-live line of an interactive component (plan §7 A11y).
 * Keep it mounted from the first render and only change its text, or
 * screen readers will not announce it.
 */
export function LiveLine({ children, visuallyHidden, className }: LiveLineProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(visuallyHidden ? "sr-only" : "font-mono text-[10px] text-muted-foreground", className)}
    >
      {children}
    </p>
  )
}
