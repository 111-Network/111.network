import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Props of TerminalChrome. */
export interface TerminalChromeProps {
  /** Left part of the label: `{title} ~ {suffix}`. */
  title: string
  /** Right part of the label. Default "terminal" (DESIGN.md); the agent panel uses "chat". */
  suffix?: string
  /** Optional slot pushed to the end of the bar (status text, a DEMO tag, small actions). */
  end?: ReactNode
  className?: string
}

/** The terminal header: three square dots + `{title} ~ terminal`. The dots are hidden from AT. Server-safe. */
export function TerminalChrome({ title, suffix = "terminal", end, className }: TerminalChromeProps) {
  return (
    <div className={cn("flex items-center gap-2 border-b border-border px-4 py-2", className)}>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-foreground" />
      <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-muted-foreground/50" />
      <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-muted-foreground/30" />
      <span className="ms-2 min-w-0 truncate font-mono text-[10px] text-muted-foreground">
        {title} ~ {suffix}
      </span>
      {end ? (
        <div className="ms-auto flex shrink-0 items-center gap-2 font-mono text-[10px] text-muted-foreground">{end}</div>
      ) : null}
    </div>
  )
}
