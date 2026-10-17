// Messaging & data · L5 (the one layer page simple mode lists): this node's home hub, which takes
// custody of sealed messages for nodes that are away, reached over the local Wi-Fi.
import { CAST_COPY, MEDIUM_LABEL } from "../../copy/core"
import { SETTINGS_COPY } from "../../copy/settings"
import { useWorld } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { useHeadingLevel } from "../../shell/context"
import { RouteButtonLink } from "../../shell/links"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { SpecTable } from "../../ui/spec-table"
import { toSpecRows } from "./facts"
import type { FactRow } from "./model"
import { H2 } from "./row"

const C = SETTINGS_COPY.hub

export function HubPanel() {
  const h1 = useHeadingLevel(1)
  const world = useWorld()
  const hub = world.cast.find((c) => c.id === world.homeHub)
  if (!hub) return null
  const rows: FactRow[] = [
    { label: C.rows.hub, value: hub.name },
    { label: C.rows.device, value: hub.deviceLabel },
    { label: C.rows.label, value: hub.label, copy: hub.label },
    { label: C.rows.reach, value: MEDIUM_LABEL[hub.reach] },
    { label: C.rows.role, value: CAST_COPY[hub.id].blurb },
  ]
  return (
    <Panel title={C.panel} suffix="l5" flush>
      <div className="border-b border-border px-4 py-3">
        <Heading level={h1} className={H2}>
          {C.heading}
        </Heading>
      </div>
      <SpecTable bare rows={toSpecRows(rows)} />
      <div className="border-t border-border px-4 py-3">
        <RouteButtonLink to={PATHS.messages} size="sm">
          {C.open}
        </RouteButtonLink>
      </div>
    </Panel>
  )
}
