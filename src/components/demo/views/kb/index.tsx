// Knowledge base (#/kb, #/kb/<drawer>, #/kb/<drawer>/<note>; Layer 0). STUB: the kb view task replaces
// this body (index by drawer, note view, grades) and must provide every note named in
// DEMO_WORLD.services[].kb.
import { ROUTE_TITLES } from "../../copy/core"
import { ViewPlaceholder } from "../../shell/view-placeholder"
import type { ViewProps } from "../../shell/view-types"
import { Badge } from "../../ui/badge"

export default function KbView({ route }: ViewProps) {
  return (
    <ViewPlaceholder kicker="knowledge" title={ROUTE_TITLES.kb}>
      {route.view === "kb-drawer" || route.view === "kb-note" ? (
        <div>
          <Badge>{route.view === "kb-note" ? `${route.drawer} / ${route.note}` : route.drawer}</Badge>
        </div>
      ) : null}
    </ViewPlaceholder>
  )
}
