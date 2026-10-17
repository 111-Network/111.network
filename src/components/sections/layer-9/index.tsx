import { FollowingDevice } from "@/components/common/following-device"
import { LayerSection } from "@/components/common/layer-section"
import { HealBench } from "./bench"
import { EvolutionTiles, PrSpecs } from "./static"

/**
 * Layer 9 · Self-Healing & Evolution: "Pull Request Bench" + "Gate Rail"
 * (plan §5 L9, V6 + V7 stepper, W13). The header, specs and evolution tiles
 * render on the server; only the bench (bench.tsx) is a client island.
 */
export function Layer9() {
  return (
    <LayerSection n={9} aside={<FollowingDevice />}>
      <HealBench specs={<PrSpecs />} />
      <EvolutionTiles />
    </LayerSection>
  )
}
