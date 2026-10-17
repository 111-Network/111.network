// The heard nodes as a list (real views/nearby/index.tsx NodeItem + SourceList): one panel per way
// of hearing, each node with its device words, path, how often and why it was heard, and the
// "demo node" note. The home hub over Wi-Fi is listed APART (HomeLinkPanel): it is the home link,
// not a mesh neighbour. Shared by Nearby (LIST) and the Internet gateway page.
import { MEDIUM_LABEL } from "../../copy/core"
import { NEARBY_COPY } from "../../copy/nearby"
import { agoText, formatClockSeconds } from "../../engine/clock"
import type { HeardEntry, RadioBoard } from "../../engine/core"
import { useWorld } from "../../engine/react"
import type { UiMode } from "../../engine/types"
import { castById, nodeName } from "../../engine/world"
import { Badge } from "../../ui/badge"
import { LABEL_CLASS } from "../../ui/classes"
import { DemoNote } from "../../ui/demo-note"
import { Heading, type HeadingLevel } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { causeLines, deviceWords, groupHeading, groupHeard, isRelay, pathText } from "./model"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"

/** One heard node (real NodeItem): what the demo can say honestly, never a signal figure. */
export function HeardNodeRow({ entry, now, mode }: { entry: HeardEntry; now: number; mode: UiMode }) {
  const world = useWorld()
  const device = deviceWords(entry.id, world)
  const label = castById(world, entry.id)?.label
  return (
    <li className="flex flex-col gap-1 px-4 py-3" data-testid="nearby-node">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="min-w-0 break-words font-mono text-sm text-foreground">{nodeName(world, entry.id)}</span>
        {device ? <Badge>{device}</Badge> : null}
        <span className={LABEL_CLASS}>{NEARBY_COPY.lastHeard(agoText(entry.lastAt, now))}</span>
        <DemoNote kind="node" />
      </div>
      <p className={TEXT}>
        {pathText(entry, world)} · {NEARBY_COPY.count(entry.count)}
      </p>
      {isRelay(entry.id, world) ? <p className="font-mono text-xs leading-relaxed text-foreground">{NEARBY_COPY.relay}</p> : null}
      <p className={TEXT}>{causeLines(entry).join(" · ")}</p>
      {mode === "advanced" && label ? <p className="font-mono text-[11px] leading-snug text-muted-foreground">{NEARBY_COPY.label(label)}</p> : null}
    </li>
  )
}

/** The mesh neighbours, one panel per way of hearing (real SourceList per source). */
export function HeardGroups({
  neighbours,
  radio,
  now,
  mode,
  level,
}: {
  neighbours: readonly HeardEntry[]
  radio: Pick<RadioBoard, "alias" | "name"> | null
  now: number
  mode: UiMode
  /** Level of each panel's heading. */
  level: HeadingLevel
}) {
  const world = useWorld()
  const groups = groupHeard(neighbours, world)
  return (
    <>
      {groups.map((g) => (
        <Panel key={g.medium} title={MEDIUM_LABEL[g.medium]} suffix={NEARBY_COPY.source.suffix} flush>
          <div className="border-b border-border px-4 py-3">
            <Heading level={level} className="min-w-0 break-words font-mono text-sm text-foreground">
              {groupHeading(g.medium, radio)}
            </Heading>
            <p className={`mt-1 ${TEXT}`}>{NEARBY_COPY.nodes(g.entries.length)}</p>
          </div>
          <ul className="divide-y divide-border">
            {g.entries.map((h) => (
              <HeardNodeRow key={h.id} entry={h} now={now} mode={mode} />
            ))}
          </ul>
        </Panel>
      ))}
    </>
  )
}

/** The home hub over this Wi-Fi, apart from the neighbours (it holds sealed copies; it is not "nearby"). */
export function HomeLinkPanel({ home, now, mode, level }: { home: HeardEntry; now: number; mode: UiMode; level: HeadingLevel }) {
  const world = useWorld()
  const c = NEARBY_COPY.home
  const device = deviceWords(home.id, world)
  const label = castById(world, home.id)?.label
  return (
    <Panel title={c.title} suffix={c.suffix} flush>
      <div className="border-b border-border px-4 py-3">
        <Heading level={level} className="font-mono text-sm text-foreground">
          {c.heading}
        </Heading>
        <p className={`mt-1 max-w-prose ${TEXT}`}>{c.text}</p>
      </div>
      <ul>
        <li className="flex flex-col gap-1 px-4 py-3" data-testid="nearby-home">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-sm text-foreground">{nodeName(world, home.id)}</span>
            {device ? <Badge>{device}</Badge> : null}
            <span className={LABEL_CLASS}>{NEARBY_COPY.lastHeard(agoText(home.lastAt, now))}</span>
            <DemoNote kind="node" />
          </div>
          <p className={TEXT}>
            {home.cause === "custody-ack" ? c.took(formatClockSeconds(home.lastAt)) : causeLines(home).join(" · ")} · {NEARBY_COPY.count(home.count)}
          </p>
          {mode === "advanced" && label ? <p className="font-mono text-[11px] leading-snug text-muted-foreground">{NEARBY_COPY.label(label)}</p> : null}
        </li>
      </ul>
    </Panel>
  )
}
