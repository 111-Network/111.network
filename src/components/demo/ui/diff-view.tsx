import { cn } from "@/lib/utils"
import { FOCUS_RING_INSET } from "./classes"
import { DIFF_KIND_CLASS, classifyDiffLine, diffLines } from "./diff"

/** Props of DiffView. */
export interface DiffViewProps {
  /** Unified diff text. */
  diff: string
  /** Accessible name, default "diff". */
  label?: string
  className?: string
}

/** Monochrome unified-diff viewer, keyboard-scrollable. Server-safe. */
export function DiffView({ diff, label = "diff", className }: DiffViewProps) {
  return (
    <pre
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-x-auto border border-border bg-secondary/20 p-3 font-mono text-xs leading-relaxed",
        FOCUS_RING_INSET,
        className,
      )}
    >
      {diffLines(diff).map((line, i) => {
        const kind = classifyDiffLine(line)
        return (
          <span key={i} className={cn("block", DIFF_KIND_CLASS[kind], kind === "hunk" && "mt-1 first:mt-0")}>
            {line === "" ? " " : line}
          </span>
        )
      })}
    </pre>
  )
}
