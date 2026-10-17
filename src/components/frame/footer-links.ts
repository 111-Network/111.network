import { getLayer } from "@/lib/layers"
import { ANCHORS, DEMO_PATH, DEMO_READY } from "@/lib/site"

// The footer's Explore column (plan §4.5). React-free, so the server footer
// and its tests share it. Demo is listed only once DEMO_READY is true, so no
// link points at a missing /demo during P1–P4 (plan §4.2).

/** Labels of the Explore column, in display order. */
export type ExploreLabel = "Layers" | "Demo" | "Terminal" | "Install"

/** An Explore entry: an in-page anchor (an id, without "#") or a route. */
export type ExploreLink = { label: ExploreLabel; anchor: string } | { label: ExploreLabel; href: string }

/** Layers (#layer-0) · Demo (only when `demoReady`) · Terminal (#terminal) · Install (#install). */
export function exploreLinks(demoReady: boolean = DEMO_READY): readonly ExploreLink[] {
  return [
    { label: "Layers", anchor: getLayer(0).id },
    ...(demoReady ? [{ label: "Demo", href: DEMO_PATH } as const] : []),
    { label: "Terminal", anchor: ANCHORS.terminal },
    { label: "Install", anchor: ANCHORS.install },
  ]
}
