"use client"

import { LAYERS } from "@/lib/layers"
import { cn } from "@/lib/utils"
import { AnchorLink } from "./nav-anchor-link"
import { layerAnchorLabel, readoutShort } from "./nav-model"
import { useActiveLayer } from "./nav-spy"
import { FOCUS, FOCUS_ON_WHITE } from "./nav-styles"

/**
 * Desktop layer nav (plan §4.1, in the old header's style, owner 2026-10-17): one text button per
 * layer, dim number + uppercase label, hover inverted, the active one solid. Each is a real
 * `#layer-N` link with aria-current on the active one.
 *
 * Widths: from 1536 px the full row at text-xs (the header widens to 96rem); from 1280 px every
 * label in a compact 10 px row (the header goes edge to edge); below 1280 px every button shows its
 * number and only the active one adds its label, and hover or keyboard focus names a number-only
 * button in a small tag under it.
 */
export function NavRail({ className }: { className?: string }) {
  const active = useActiveLayer()
  return (
    <ol aria-label="Layers" className={cn("flex min-w-0 items-center", className)}>
      {LAYERS.map((layer) => {
        const current = active === layer.n
        return (
          <li key={layer.id} className="group relative">
            <AnchorLink
              to={layer.id}
              aria-label={layerAnchorLabel(layer.n)}
              aria-current={current ? "location" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-2 font-mono text-xs transition-colors duration-200",
                "min-[80rem]:gap-1 min-[80rem]:px-1 min-[80rem]:text-[10px] min-[96rem]:gap-1.5 min-[96rem]:px-2 min-[96rem]:text-xs",
                FOCUS,
                current
                  ? cn("bg-foreground text-background", FOCUS_ON_WHITE)
                  : "text-muted-foreground hover:bg-foreground hover:text-background",
              )}
            >
              <span aria-hidden="true" className="opacity-50">
                {layer.n}
              </span>
              <span aria-hidden="true" className={cn(current ? "inline" : "hidden", "min-[80rem]:inline")}>
                {layer.navLabel}
              </span>
            </AnchorLink>
            {current ? null : (
              <span
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap border border-border bg-popover px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground group-focus-within:visible group-hover:visible min-[80rem]:hidden"
              >
                {layer.title}
              </span>
            )}
          </li>
        )
      })}
    </ol>
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
