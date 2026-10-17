// Layout shared by the Essentials and Sharing panels (real views/settings/row.tsx): a label with help
// text on the start side and the control on the end side, stacked below a 768 px shell (a container
// query on the shell root; the real one uses the `md:` viewport query). Every row is a named group.
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useHeadingLevel } from "../../shell/context"
import { Heading } from "../../ui/heading"

export const FEEDBACK = "font-mono text-xs leading-relaxed"

/** The small uppercase section heading of the settings panels. */
export const H2 = "font-mono text-[10px] uppercase tracking-widest text-foreground"

export interface RowProps {
  id: string
  label: string
  help?: ReactNode
  children: ReactNode
}

export function Row({ id, label, help, children }: RowProps) {
  const level = useHeadingLevel(1)
  return (
    <div
      data-row={id}
      role="group"
      aria-labelledby={`${id}-label`}
      className="grid gap-3 border-b border-border p-4 last:border-b-0 @min-[768px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @min-[768px]:gap-8"
    >
      <div className="min-w-0">
        <Heading level={level} id={`${id}-label`} className={H2}>
          {label}
        </Heading>
        {help ? <p className={cn("mt-2 max-w-prose text-muted-foreground", FEEDBACK)}>{help}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * One inline line of feedback under a control. Not a live region: the shell's polite announcer
 * says it (useAnnounce, or the store event behind it), so a screen reader hears it once.
 */
export function Feedback({ text, strong = false }: { text: string | null; strong?: boolean }) {
  if (!text) return null
  return <p className={cn("mt-2", FEEDBACK, strong ? "text-foreground" : "text-muted-foreground")}>{text}</p>
}
