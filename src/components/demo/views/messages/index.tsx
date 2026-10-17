// Messages and conversation (#/messages, #/messages/<peer>; Layers 5 and 2). STUB: the messages view
// task replaces this body (threads, delivery states, custody line, requests, demo notes).
import { ROUTE_TITLES } from "../../copy/core"
import { useWorld } from "../../engine/react"
import { nodeName } from "../../engine/world"
import { ViewPlaceholder } from "../../shell/view-placeholder"
import type { ViewProps } from "../../shell/view-types"

export default function MessagesView({ route }: ViewProps) {
  const world = useWorld()
  const title = route.view === "conversation" ? nodeName(world, route.peer) : ROUTE_TITLES.messages
  return <ViewPlaceholder kicker="messages" title={title} />
}
