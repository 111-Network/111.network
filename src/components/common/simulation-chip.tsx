import { cn } from "@/lib/utils"

/** Props of SimulationChip. */
export interface SimulationChipProps {
  /** "SIMULATION" on home-page components, "DEMO" inside /demo. Default "SIMULATION". */
  kind?: "SIMULATION" | "DEMO"
  className?: string
}

/** The only disclaimer on simulated components (W4): a small bordered tag. */
export function SimulationChip({ kind = "SIMULATION", className }: SimulationChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {kind}
    </span>
  )
}
