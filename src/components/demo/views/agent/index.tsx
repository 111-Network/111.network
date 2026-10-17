// Agent (#/, Layers 3 and 4). STUB: the agent view task replaces this body (chat, streaming replies,
// tool lines, proposal cards). It shows a prompt prepared by "Set up with the agent" or "Ask the
// agent about …" (core.prefill) so the hand-offs are testable before the chat lands.
import { useDemo } from "../../engine/react"
import type { DemoState } from "../../engine/slices"
import { ViewPlaceholder } from "../../shell/view-placeholder"
import { Panel } from "../../ui/panel"

const selectPrefill = (s: DemoState) => s.core.prefill

export default function AgentView() {
  const prefill = useDemo(selectPrefill)
  return (
    <ViewPlaceholder kicker="agent" title="Agent">
      {prefill ? (
        <Panel title="agent" suffix="chat">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">prepared from: {prefill.from}</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-foreground">{prefill.text}</p>
        </Panel>
      ) : null}
    </ViewPlaceholder>
  )
}
