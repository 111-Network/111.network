import type { ReactNode } from "react"
import { LayerFooter } from "@/components/common/layer-footer"
import { LayerHeader, type LayerHeaderVariant } from "@/components/common/layer-header"
import { getLayer, layerTitleId, type LayerNumber } from "@/lib/layers"
import { cn } from "@/lib/utils"

/**
 * How LayerSection draws the heading:
 * - "default" | "inverted" (L7 band) | "stamp" (L6 box): a LayerHeader;
 * - "none": only a visually hidden H2 (the section has no visible header);
 * - "custom": NO heading at all; the body renders <LayerHeader n> (or its own
 *   layout around <LayerTitle n>) exactly once, so the id stays unique.
 */
export type LayerSectionVariant = LayerHeaderVariant | "none" | "custom"

/** Props of LayerSection. */
export interface LayerSectionProps {
  n: LayerNumber
  /** Heading genre. Default "default". */
  variant?: LayerSectionVariant
  /** Extra header line under the description, e.g. <FollowingDevice /> on L3, L8, L9. */
  aside?: ReactNode
  /** Right-aligned header slot beside the title, e.g. L7's HEARTBEAT label. */
  headerRight?: ReactNode
  /** Classes for the header (restyle it to keep the section's genre). */
  headerClassName?: string
  /** Section body (the layer's visual). Render the four layer specs in it (getLayer(n).specs). */
  children?: ReactNode
  /** Classes for the <section> (full-bleed band). */
  className?: string
  /** Classes for the inner max-w-7xl container. */
  containerClassName?: string
}

/**
 * One home-page layer: <section id="layer-N" aria-labelledby="layer-N-title">
 * with nav-safe scroll margin, the DESIGN.md container + section padding, then
 * header, children and the demo footer.
 */
export function LayerSection({
  n,
  variant = "default",
  aside,
  headerRight,
  headerClassName,
  children,
  className,
  containerClassName,
}: LayerSectionProps) {
  const layer = getLayer(n)
  return (
    <section
      id={layer.id}
      aria-labelledby={layerTitleId(n)}
      className={cn("relative scroll-mt-nav border-b border-border", className)}
    >
      <div className={cn("mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-32", containerClassName)}>
        {variant === "custom" ? null : variant === "none" ? (
          <h2 id={layerTitleId(n)} className="sr-only">
            Layer {n}: {layer.title}
          </h2>
        ) : (
          <LayerHeader n={n} variant={variant} aside={aside} right={headerRight} className={headerClassName} />
        )}
        {children}
        <LayerFooter n={n} />
      </div>
    </section>
  )
}
