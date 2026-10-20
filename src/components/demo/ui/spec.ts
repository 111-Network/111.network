// Spec-table model (React-free). Real source: os/4-interface/ui/src/components/spec-table.tsx.
import type { ReactNode } from "react"

/** Density mode (SIMPLE | ADVANCED). Structurally identical to the shell's own mode type. */
export type UiMode = "simple" | "advanced"

/** One label/value row. */
export interface SpecRow {
  label: string
  value: ReactNode
  /** Lowest mode that shows this row. Absent or "simple" = always; "advanced" = advanced mode only. */
  minMode?: UiMode
}

/** Rows visible in `mode`; with no mode every row shows. */
export function visibleSpecRows<R extends SpecRow>(rows: readonly R[], mode: UiMode = "advanced"): R[] {
  return rows.filter((r) => r.minMode === undefined || r.minMode === "simple" || mode === "advanced")
}
