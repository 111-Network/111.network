import { LayerSection } from "@/components/common/layer-section"
import { getLayer } from "@/lib/layers"
import { CourierReceipt } from "./courier-receipt"
import { CARGO_KINDS } from "./model"

/**
 * Layer 5 · Messaging & Data: the Courier Receipt (plan §5 L5). A vertical
 * tracking receipt (client island) beside the four specs printed as the
 * receipt's terms, then a static row of the five kinds of cargo the same
 * fabric carries. No map: that genre belongs to L7.
 */
export function Layer5() {
  const { specs } = getLayer(5)

  return (
    <LayerSection n={5}>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-7">
          <CourierReceipt />
        </div>

        <div className="min-w-0 lg:col-span-5">
          <div className="border border-border bg-card shadow-panel lg:sticky lg:top-24">
            <h3
              id="layer-5-terms"
              className="border-b border-dashed border-border px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:px-6"
            >
              Terms of carriage
            </h3>
            <dl className="divide-y divide-dashed divide-border px-4 sm:px-6">
              {specs.map((spec) => (
                // Only dt + dd inside the group: the dotted leader is the dt's ::after.
                <div key={spec.label} className="flex items-baseline gap-3 py-3">
                  <dt className="flex flex-1 shrink-0 items-baseline gap-3 font-mono text-[10px] whitespace-nowrap uppercase tracking-widest text-muted-foreground after:min-w-4 after:flex-1 after:border-b after:border-dotted after:border-muted-foreground/40">
                    {spec.label}
                  </dt>
                  <dd className="min-w-0 text-right font-mono text-xs font-bold text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-dashed border-border pt-8">
        <h3 id="layer-5-cargo" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          What the same fabric carries
        </h3>
        <ul aria-labelledby="layer-5-cargo" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {CARGO_KINDS.map((kind) => (
            <li key={kind} className="border border-border border-t-foreground px-3 py-4 font-mono text-xs text-foreground">
              {kind}
            </li>
          ))}
        </ul>
      </div>
    </LayerSection>
  )
}
