// Devices and device detail (#/devices, #/devices/<id>; Layers 1 and 6). STUB: the devices view task
// replaces this body (this laptop's facts, plug in a radio board, consent, identify, flash, region).
import { OWN_FACT_LINES, ROUTE_TITLES } from "../../copy/core"
import { useDemo, useWorld } from "../../engine/react"
import type { DemoState } from "../../engine/slices"
import { ViewPlaceholder } from "../../shell/view-placeholder"
import type { ViewProps } from "../../shell/view-types"
import { SpecTable } from "../../ui/spec-table"

const selectHasRadio = (s: DemoState): boolean => s.core.radio !== null

export default function DevicesView({ route }: ViewProps) {
  const world = useWorld()
  const hasRadio = useDemo(selectHasRadio)
  const facts = [...world.self.factLines, hasRadio ? OWN_FACT_LINES.radio : OWN_FACT_LINES.noRadio].join(" · ")
  return (
    <ViewPlaceholder kicker="devices" title={route.view === "device" ? ROUTE_TITLES.device : ROUTE_TITLES.devices}>
      <SpecTable title={world.self.name} rows={[{ label: "Has", value: facts }]} />
    </ViewPlaceholder>
  )
}
