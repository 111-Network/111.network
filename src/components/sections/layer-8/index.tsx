import { FollowingDevice } from "@/components/common/following-device"
import { LayerSection } from "@/components/common/layer-section"
import { Panel } from "@/components/common/panel"
import { getLayer } from "@/lib/layers"
import { SHARED_LOG_CAPTION, SHARED_LOG_GLYPH, SHARED_LOG_LINE } from "./copy"
import { HubShelf } from "./hub-shelf"
import { StoreMap } from "./store-map"

/**
 * Layer 8 · Storage & Shared State: "Store Map" (plan §5 L8, disk-usage /
 * defrag genre). Server Component: the header, the shared log and the store
 * properties render here; the store map and the hub shelf are client islands
 * that follow the page-level device.
 */
export function Layer8() {
  return (
    <LayerSection n={8} aside={<FollowingDevice />}>
      <StoreMap />
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <HubShelf />
        <SharedLog />
        <StoreProperties />
      </div>
    </LayerSection>
  )
}

/** The optional shared log: one caption and a tiny static glyph. */
function SharedLog() {
  // The box-drawing bar is shown, but read aloud as "and".
  const [left, right] = SHARED_LOG_LINE.split("│")
  return (
    <Panel as="figure" className="flex h-full flex-col p-4 md:p-6">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Shared log</h3>
      <div
        role="img"
        aria-label="Two nodes, A and B, hold the same entries in the same order."
        className="mt-4 self-start border border-border px-4 py-3"
      >
        {/* Tight leading, as DESIGN.md sets for ASCII art: the │ column and the ┼ arm join row to row. */}
        <pre aria-hidden="true" className="font-mono text-sm leading-none text-foreground">
          {SHARED_LOG_GLYPH}
        </pre>
      </div>
      <figcaption className="mt-4 space-y-2 font-mono text-xs leading-relaxed">
        <span className="block text-foreground">
          {left}
          <span aria-hidden="true">│</span>
          <span className="sr-only">and</span>
          {right}
        </span>
        <span className="block text-muted-foreground">{SHARED_LOG_CAPTION}</span>
      </figcaption>
    </Panel>
  )
}

/** The four layer specs, as a disk's properties sheet with dotted leaders. */
function StoreProperties() {
  const { specs } = getLayer(8)
  return (
    <Panel className="flex h-full flex-col p-4 md:col-span-2 md:p-6 lg:col-span-1">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Store properties</h3>
      <dl className="mt-4 space-y-4">
        {specs.map((spec) => (
          <div key={spec.label} className="flex items-baseline gap-2 font-mono text-xs">
            {/* The dotted leader lives inside the dt: a dl group may hold only dt and dd. */}
            <dt className="flex min-w-0 flex-1 items-baseline gap-2 text-muted-foreground">
              <span className="shrink-0">{spec.label}</span>
              <span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-border" />
            </dt>
            <dd className="max-w-[65%] text-right text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
