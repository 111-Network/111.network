import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Rack hardware primitives for the L3 patch bay. No hooks and no
// "use client": the server-rendered spec plate and the client patch bay
// both use them.

/** Four h-1 w-1 screw dots in the corners of a rack panel (parent must be `relative`). */
export function Screws() {
  const dot = "absolute h-1 w-1 bg-muted-foreground"
  return (
    <span aria-hidden="true">
      <span className={cn(dot, "top-2 left-2")} />
      <span className={cn(dot, "top-2 right-2")} />
      <span className={cn(dot, "bottom-2 left-2")} />
      <span className={cn(dot, "right-2 bottom-2")} />
    </span>
  )
}

/** An inverted tape-strip label, like a label-maker strip stuck on the panel. */
export function Tape({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block bg-foreground px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-background",
        className,
      )}
    >
      {children}
    </span>
  )
}

/** One hollow patch jack; `filled` when a plug sits in it. Decorative: aria-hidden. */
export function Jack({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block h-3 w-3 shrink-0 border border-foreground", filled && "bg-foreground", className)}
    />
  )
}

/**
 * A row of jacks. The first one is the patch point (where the cable plugs in)
 * and carries a small label; the rest are blanks. Both rack panels use the
 * same padding, so their first jacks line up for the cable.
 */
export function JackRow({ patched, label, blanks = 5, className }: { patched: boolean; label: string; blanks?: number; className?: string }) {
  return (
    <div className={cn("flex h-3 items-center gap-3", className)}>
      <Jack filled={patched} />
      <span className="font-mono text-[10px] leading-3 uppercase tracking-widest text-muted-foreground">{label}</span>
      <span aria-hidden="true" className="ml-auto flex items-center gap-3">
        {Array.from({ length: blanks }, (_, i) => (
          <Jack key={i} className="border-foreground/40" />
        ))}
      </span>
    </div>
  )
}
