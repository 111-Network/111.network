// Settings: Essentials and the ten layer pages (#/settings, #/settings/l0 .. l9). STUB: the settings
// view task replaces this body (Essentials rows, layer pages, "Ask the agent about {layer}", Install
// & updates, Identity).
import { LAYER_PAGES, ROUTE_TITLES } from "../../copy/core"
import { layerPageTitle } from "../../engine/selectors"
import { ViewPlaceholder } from "../../shell/view-placeholder"
import type { ViewProps } from "../../shell/view-types"

export default function SettingsView({ route }: ViewProps) {
  if (route.view === "settings-layer") {
    const page = LAYER_PAGES.find((l) => l.n === route.layer)
    return (
      <ViewPlaceholder kicker={`Layer ${route.layer}`} title={layerPageTitle(route.layer)}>
        {page ? <p className="max-w-prose font-mono text-xs leading-relaxed text-muted-foreground">{page.description}</p> : null}
      </ViewPlaceholder>
    )
  }
  return <ViewPlaceholder kicker="settings" title={ROUTE_TITLES.settings} />
}
