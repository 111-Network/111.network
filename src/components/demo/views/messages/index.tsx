// Messages and conversation (#/messages, #/messages/<peer>; Layers 5 and 2). Real source:
// os/interface/ui/src/views/messages/index.tsx: the route picks the list or one conversation. The
// state lives in the messages slice (engine/slices/messages.ts); this module only draws it.
//
// Focus: moving inside this view (list -> conversation and back) lands on the new title. The first
// render of the view (a sidebar click, a deep link, the Layer 4 window) leaves the focus alone.
import { useState } from "react"
import { useDemo } from "../../engine/react"
import { selectNavCount } from "../../shell/select"
import type { ViewProps } from "../../shell/view-types"
import ThreadList from "./list"
import ThreadView from "./thread"

export default function MessagesView({ route }: ViewProps) {
  const navCount = useDemo(selectNavCount)
  // The navigation count this view opened with (read once; never storage).
  const [opened] = useState(navCount)
  const moved = navCount !== opened
  if (route.view === "conversation") return <ThreadView key={route.peer} peer={route.peer} autoFocus={moved} />
  return <ThreadList autoFocus={moved} />
}
