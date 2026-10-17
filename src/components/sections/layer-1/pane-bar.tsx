import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** A pane header inside the boot window (V3 "Network Bootstrap" style): small uppercase label + optional right slot. */
export function PaneBar({
  children,
  right,
  marker,
  className,
}: {
  children: ReactNode
  right?: ReactNode
  /** Draw V3's small square before the label. */
  marker?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex min-h-9 items-center gap-2 border-b border-border px-4 py-2", className)}>
      {marker && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-foreground" />}
      <p className="min-w-0 flex-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{children}</p>
      {right != null && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}
