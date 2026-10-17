import { FollowingDevice } from "@/components/common/following-device"
import { LayerSection } from "@/components/common/layer-section"
import { getLayer, type LayerSpec } from "@/lib/layers"
import { PatchBay } from "./patch-bay"
import { Screws, Tape } from "./rack"

/** The four layer specs as a screwed-on rack label plate (server-rendered). */
function SpecPlate({ specs }: { specs: readonly LayerSpec[] }) {
  return (
    <div className="relative mt-6 border border-border bg-card px-8 py-6 shadow-panel">
      <Screws />
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Specifications</h3>
      <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {specs.map((spec) => (
          <div key={spec.label} className="flex flex-col items-start gap-2">
            <dt>
              <Tape>{spec.label}</Tape>
            </dt>
            <dd className="font-mono text-sm font-bold text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Layer 3 · Local Intelligence: "Patch Bay: Borrow a Brain" (plan §5 L3). */
export function Layer3() {
  const { specs } = getLayer(3)
  return (
    <LayerSection n={3} aside={<FollowingDevice />}>
      <PatchBay
        caption="Borrowing goes over the local mesh or Wi-Fi to a hub nearby, never over a long-range radio relay."
      />
      <SpecPlate specs={specs} />
    </LayerSection>
  )
}
