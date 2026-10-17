import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Heading, type HeadingLevel } from "./heading"

/** Props of SectionHeader. */
export interface SectionHeaderProps {
  kicker: string
  title: string
  /** Heading level, default 2. A view's own title takes the shell's level: `level={useHeadingLevel()}` (1 on /demo, 3 in the L4 window). */
  level?: HeadingLevel
  /** Optional slot at the end (status, small actions). */
  end?: ReactNode
  /** Id for the heading, so a region can point `aria-labelledby` at it. */
  id?: string
  className?: string
}

/**
 * Kicker + pixel title. The title grows once the shell is 768 px wide (a container query on the
 * shell root; the real one uses the `md:` viewport query). Server-safe.
 */
export function SectionHeader({ kicker, title, level = 2, end, id, className }: SectionHeaderProps) {
  return (
    <header className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{kicker}</span>
        <Heading level={level} id={id} className="mt-1 font-pixel-line text-2xl font-bold text-foreground @min-[768px]:text-3xl">
          {title}
        </Heading>
      </div>
      {end ? <div className="shrink-0">{end}</div> : null}
    </header>
  )
}
