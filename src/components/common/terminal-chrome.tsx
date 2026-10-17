import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Props of TerminalChrome. */
export interface TerminalChromeProps {
  /** Left part of the title, e.g. "install". */
  title: string
  /** Right part after "~", e.g. "111-network"; omitted = title only. */
  subtitle?: string
  /** Right-aligned slot, e.g. <SimulationChip /> or a COPY button. */
  right?: ReactNode
  className?: string
}

/**
 * Terminal header bar from DESIGN.md: three square dots + "title ~ subtitle".
 * Chrome rule (plan §2.1): only the hero box, L1, panels inside the L4 window,
 * /demo and the finale terminal use it.
 */
export function TerminalChrome({ title, subtitle, right, className }: TerminalChromeProps) {
  return (
    <div className={cn("flex items-center gap-2 border-b border-border px-4 py-2", className)}>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-foreground" />
      <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-muted-foreground/50" />
      <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-muted-foreground/30" />
      <span className="ml-2 min-w-0 truncate font-mono text-[10px] text-muted-foreground">
        {subtitle ? `${title} ~ ${subtitle}` : title}
      </span>
      {right != null && <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}
