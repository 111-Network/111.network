import type { ReactNode } from "react"
import { getLayer, layerTitleId, type LayerNumber } from "@/lib/layers"
import { cn } from "@/lib/utils"

/** Visual genre of a section header: plain ghost-number header, inverted band (L7) or stamp box (L6). */
export type LayerHeaderVariant = "default" | "inverted" | "stamp"

/** Props of LayerHeader. */
export interface LayerHeaderProps {
  n: LayerNumber
  variant?: LayerHeaderVariant
  /** Extra line under the description, e.g. <FollowingDevice />. */
  aside?: ReactNode
  /** Right-aligned slot beside the title, e.g. L7's "HEARTBEAT" band label or a <SimulationChip />. */
  right?: ReactNode
  className?: string
}

/**
 * The pixel H2 of layer `n`, carrying the id the section's aria-labelledby
 * points at. Render it at most once per section: LayerHeader already does, so
 * use it alone only inside <LayerSection variant="custom">.
 */
export function LayerTitle({ n, className }: { n: LayerNumber; className?: string }) {
  const layer = getLayer(n)
  return (
    <h2
      id={layerTitleId(n)}
      className={cn("mt-2 font-pixel-line text-3xl font-bold tracking-tight text-balance md:text-5xl", className)}
    >
      <span className="sr-only">Layer {n}: </span>
      {layer.title}
    </h2>
  )
}

/** Section header from layers.ts: ghost number "0N", subtitle label, pixel H2, description. */
export function LayerHeader({ n, variant = "default", aside, right, className }: LayerHeaderProps) {
  const layer = getLayer(n)
  const inverted = variant === "inverted"

  return (
    <header
      className={cn(
        "mb-12 md:mb-16",
        inverted && "bg-foreground p-6 text-background md:p-8",
        variant === "stamp" && "border-2 border-foreground p-6 md:p-8",
        className,
      )}
    >
      <div className="flex items-end gap-6">
        <span
          aria-hidden="true"
          className={cn(
            "font-pixel-line text-7xl leading-none font-bold md:text-9xl",
            inverted ? "text-background/[0.12]" : "text-foreground/[0.08]",
          )}
        >
          {layer.ghost}
        </span>
        <div className="min-w-0 flex-1 pb-2">
          <p
            className={cn(
              "font-mono text-[10px] uppercase tracking-widest",
              inverted ? "text-background/60" : "text-muted-foreground",
            )}
          >
            {layer.subtitle}
          </p>
          <LayerTitle n={n} className={inverted ? "text-background" : "text-foreground"} />
        </div>
        {right != null && <div className="flex shrink-0 items-center gap-2 self-start">{right}</div>}
      </div>
      <p
        className={cn(
          "mt-6 max-w-3xl font-mono text-sm leading-relaxed md:text-base",
          inverted ? "text-background/70" : "text-muted-foreground",
        )}
      >
        {layer.description}
      </p>
      {aside != null && <div className="mt-4">{aside}</div>}
    </header>
  )
}
