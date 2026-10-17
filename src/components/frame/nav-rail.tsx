"use client"

import { LAYERS } from "@/lib/layers"
import { cn } from "@/lib/utils"
import { AnchorLink } from "./nav-anchor-link"
import { layerAnchorLabel, readoutLong, readoutShort } from "./nav-model"
import { useActiveLayer } from "./nav-spy"
import { FOCUS, FOCUS_ON_WHITE } from "./nav-styles"

/**
 * Desktop rail (plan §4.1): ten 28 px squares 0…9, each a real `#layer-N`
 * link. The active one is inverted and carries aria-current; hover or
 * keyboard focus shows the layer title below the square.
 */
export function NavRail({ className }: { className?: string }) {
  const active = useActiveLayer()
  return (
    <ol aria-label="Layers" className={cn("flex items-center gap-1", className)}>
      {LAYERS.map((layer) => {
        const current = active === layer.n
        return (
          <li key={layer.id} className="group relative">
            <AnchorLink
              to={layer.id}
              aria-label={layerAnchorLabel(layer.n)}
              aria-current={current ? "location" : undefined}
              className={cn(
                "flex h-7 w-7 items-center justify-center border font-mono text-xs transition-colors duration-200",
                FOCUS,
                current
                  ? cn("border-foreground bg-foreground text-background", FOCUS_ON_WHITE)
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              {layer.n}
            </AnchorLink>
            <span
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap border border-border bg-popover px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground group-focus-within:visible group-hover:visible"
            >
              {layer.title}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** The xl readout beside the rail, e.g. "L3 · LOCAL INTELLIGENCE" (visual only: the rail's aria-current says it). */
export function NavLongReadout({ className }: { className?: string }) {
  const active = useActiveLayer()
  return (
    <span
      aria-hidden="true"
      className={cn(
        "truncate font-mono text-[10px] uppercase tracking-widest",
        active === null ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {readoutLong(active)}
    </span>
  )
}

/** The mobile readout, e.g. "L3/9" (visual only: the sheet's tiles carry aria-current). */
export function NavShortReadout({ className }: { className?: string }) {
  const active = useActiveLayer()
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-mono text-[10px] tabular-nums tracking-widest",
        active === null ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {readoutShort(active)}
    </span>
  )
}
