import { cn } from "@/lib/utils"
import { visibleSpecRows, type SpecRow, type UiMode } from "./spec"

export type { SpecRow, UiMode } from "./spec"

/** Props of SpecTable. */
export interface SpecTableProps {
  rows: readonly SpecRow[]
  /** Current mode. Omit to show every row. */
  mode?: UiMode
  /** Optional small header (square + uppercase label), as in DESIGN.md. */
  title?: string
  /** Drop the outer border (when nested in a flush Panel). */
  bare?: boolean
  className?: string
}

/** Label/value rows as a description list. No entrance motion (the real dashboard has none). Server-safe. */
export function SpecTable({ rows, mode, title, bare = false, className }: SpecTableProps) {
  const shown = visibleSpecRows(rows, mode)
  return (
    <div className={cn(!bare && "border border-border", className)}>
      {title ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</span>
        </div>
      ) : null}
      <dl className="divide-y divide-border">
        {shown.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 px-4 py-2.5 font-mono text-xs transition-colors duration-200 hover:bg-secondary/50"
          >
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 break-words text-end text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
