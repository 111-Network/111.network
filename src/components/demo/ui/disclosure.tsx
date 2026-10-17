import type { DetailsHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { FOCUS_RING } from "./classes"

/** Props of Disclosure: details attributes plus summary and the initial state. */
export interface DisclosureProps extends Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "open" | "summary"> {
  summary: ReactNode
  /** Open on first render. Afterwards the platform owns the state (uncontrolled). */
  defaultOpen?: boolean
  children?: ReactNode
}

// The marker follows the nearest <details> only (nested disclosures keep their own `>` / `v`).
const WHEN_OPEN_HIDE = "[details[open]>summary>&]:hidden"
const WHEN_OPEN_SHOW = "hidden [details[open]>summary>&]:inline-block"

/**
 * Native <details>/<summary>. `>` closed, `v` open, no animation. Keyboard and AT behaviour come
 * from the platform, and the marker flips in CSS, so there is no state and it is server-safe.
 */
export function Disclosure({ summary, defaultOpen = false, className, children, ...rest }: DisclosureProps) {
  return (
    <details {...rest} open={defaultOpen} className={className}>
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden",
          FOCUS_RING,
        )}
      >
        <span aria-hidden="true" className={cn("inline-block w-3 shrink-0 text-center", WHEN_OPEN_HIDE)}>
          {">"}
        </span>
        <span aria-hidden="true" className={cn("w-3 shrink-0 text-center", WHEN_OPEN_SHOW)}>
          v
        </span>
        <span className="min-w-0">{summary}</span>
      </summary>
      <div className="pb-2 ps-5 pt-1">{children}</div>
    </details>
  )
}
