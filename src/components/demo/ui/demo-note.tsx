import { cn } from "@/lib/utils"
import { demoNoteText, type DemoNoteKind } from "./demo"

export type { DemoNoteKind } from "./demo"

/** Props of DemoNote. */
export interface DemoNoteProps {
  /** "message" (default) for the cast's messages, "reply" for agent replies, "node" for radar blips. */
  kind?: DemoNoteKind
  className?: string
}

/**
 * The small dashed note on every incoming demo item (W14): `demo message`, `demo reply` or
 * `demo node`. Dashed = not real (the site's candidate marker). Server-safe.
 */
export function DemoNote({ kind = "message", className }: DemoNoteProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-wider text-muted-foreground",
        className,
      )}
    >
      {demoNoteText(kind)}
    </span>
  )
}
