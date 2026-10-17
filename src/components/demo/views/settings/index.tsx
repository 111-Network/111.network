// Settings (#/settings, #/settings/l0 .. l9; real views/settings/index.tsx). No layer = Essentials;
// l0..l9 = a layer page, with its own panels on Install & updates (L1), Identity (L2) and
// Messaging & data (L5, the home hub). The router already sends any other segment to 404, and the
// shell marks an advanced page opened in simple mode (every layer page but L5, as the real nav).
import type { ViewProps } from "../../shell/view-types"
import { Essentials } from "./essentials"
import { HubPanel } from "./hub"
import { IdentityPanels } from "./identity"
import { InstallPanels } from "./install"
import { LayerPage } from "./layer-page"

export default function SettingsView({ route }: ViewProps) {
  if (route.view !== "settings-layer") return <Essentials />
  const n = route.layer
  const own = n === 1 ? <InstallPanels /> : n === 2 ? <IdentityPanels /> : n === 5 ? <HubPanel /> : null
  // Keyed on the layer: a drafted node name or an open confirm never carries over to another page.
  return (
    <LayerPage key={n} n={n}>
      {own}
    </LayerPage>
  )
}
