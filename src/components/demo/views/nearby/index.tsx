// Nearby (#/nearby, Layers 5 and 7). STUB: the nearby view task replaces this body (RADAR | LIST,
// heard nodes with their causes, listen for a minute).
import { ROUTE_TITLES } from "../../copy/core"
import { useDemo } from "../../engine/react"
import { nearbySentence } from "../../engine/selectors"
import { ViewPlaceholder } from "../../shell/view-placeholder"

export default function NearbyView() {
  const sentence = useDemo(nearbySentence)
  return (
    <ViewPlaceholder kicker="nearby" title={ROUTE_TITLES.nearby}>
      <p className="font-mono text-sm leading-relaxed text-foreground">{sentence}</p>
    </ViewPlaceholder>
  )
}
