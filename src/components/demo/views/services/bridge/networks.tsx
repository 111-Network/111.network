// Preferred networks, tried in order (Layer 6, os/README.md "Transport & Bridge"): the short list
// curated in the knowledge base, labelled by generic medium, "first hit wins". The ladder is core's
// transport (core/transportJoined after the radio goes LIVE): no signal / trying / FOUND (inverted) /
// not tried. Once a network is joined the node starts heartbeats on it. Nothing here moves by itself:
// the ladder changes only when core does (a caused seek), and the "network-joined" event is announced
// by the shell.
import type { Ref } from "react"
import { cn } from "@/lib/utils"
import { BRIDGE_COPY } from "../../../copy/bridge"
import { formatClock } from "../../../engine/clock"
import { useDemo, useWorld } from "../../../engine/react"
import { PATHS } from "../../../engine/router"
import { RouteButtonLink } from "../../../shell/links"
import type { HeadingLevel } from "../../../ui/heading"
import { Panel } from "../../../ui/panel"
import { SpecTable } from "../../../ui/spec-table"
import { FocusHeading } from "./focus-heading"
import { ladderOutcome, ladderRows, outcomeText } from "./model"
import { selectJoinedAt, selectTransport } from "./select"

const C = BRIDGE_COPY.networks
const NOTE = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

export function NetworksPanel({ level, headingRef }: { level: HeadingLevel; headingRef?: Ref<HTMLHeadingElement> }) {
  const transport = useDemo(selectTransport)
  const joinedAt = useDemo(selectJoinedAt)
  const world = useWorld()
  const rows = ladderRows({ transport }, world)
  const outcome = ladderOutcome({ transport }, world)

  return (
    <Panel title={C.title} suffix={C.suffix} bodyClassName="space-y-4">
      <FocusHeading level={level} headingRef={headingRef}>
        {C.heading}
      </FocusHeading>
      <SpecTable
        bare
        rows={[
          { label: C.priority, value: C.priorityValue },
          { label: C.result, value: outcomeText(outcome) },
        ]}
      />
      <ol aria-label={C.listLabel} className="divide-y divide-border border border-border">
        {rows.map((r) => {
          const found = r.state === "found"
          return (
            <li
              key={r.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 font-mono text-xs transition-colors duration-200",
                found ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              <span aria-hidden="true" className="w-4 shrink-0">
                {r.rank}
              </span>
              <span className={found ? "text-background" : "text-foreground"}>{r.name}</span>
              <span>{r.medium}</span>
              <span className={cn("ms-auto", found && "font-bold")}>
                {r.word}
                {r.state === "trying" ? (
                  <span aria-hidden="true" className="ms-1 animate-blink">
                    {"█"}
                  </span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
      {outcome.kind === "joined" ? (
        <p className="font-mono text-xs leading-relaxed text-foreground">{C.heartbeats(outcome.network, joinedAt === null ? null : formatClock(joinedAt))}</p>
      ) : null}
      <p className={NOTE}>{C.note}</p>
      <div>
        <RouteButtonLink to={PATHS.kbNote("concepts", "preferred-networks")} size="sm">
          {C.read}
        </RouteButtonLink>
      </div>
    </Panel>
  )
}
