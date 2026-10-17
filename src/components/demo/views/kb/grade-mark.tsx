// Grade marks of the Knowledge base view, drawn exactly as on the home L0 section
// (src/components/sections/layer-0/grade-mark.tsx): CSS squares in currentColor, never status
// dots, never glyphs, no hatching. Dashed outline = candidate, half fill = testing, solid = proven.
// currentColor lets the same mark sit on a dark card and on an inverted (white) one. No hooks.
import { cn } from "@/lib/utils"
import { KB_COPY } from "../../copy/kb"
import type { Grade } from "./model"

/** The bare square for one grade (decorative; always pair it with words). */
export function GradeSquare({ grade, className }: { grade: Grade; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block h-3 w-3 shrink-0 border border-current",
        grade === "candidate" && "border-dashed",
        grade === "proven" && "bg-current",
        className,
      )}
    >
      {grade === "testing" ? <span className="absolute inset-y-0 left-0 w-1/2 bg-current" /> : null}
    </span>
  )
}

export interface GradeMarkProps {
  /** null = a concept: no grade, only the word "concept". */
  grade: Grade | null
  /** The one proven sample card carries an "example" tag. */
  example?: boolean
  className?: string
}

/** A note's mark: square + grade word (+ "example"), or the word "concept". */
export function GradeMark({ grade, example, className }: GradeMarkProps) {
  if (grade === null) {
    return (
      <span className={cn("inline-flex items-center font-mono text-[10px] uppercase tracking-widest opacity-70", className)}>
        {KB_COPY.grades.concept}
      </span>
    )
  }
  return (
    <span className={cn("inline-flex flex-wrap items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-widest", className)}>
      <GradeSquare grade={grade} />
      <span>{grade}</span>
      {example ? <span className="border border-current px-1 leading-4">{KB_COPY.grades.example}</span> : null}
    </span>
  )
}
