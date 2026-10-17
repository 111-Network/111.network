// Overview (#/overview, where /demo opens; real views/overview/index.tsx, spec 6.2): one verdict
// sentence, what needs the person, then the node at a glance (nearby, devices, services, node
// facts, activity). Everything is derived from the demo store, so "needs you", the verdict and the
// services grid change in the same dispatch as the state they describe. Nothing here moves by
// itself: a STARTING dot blinks only after a click elsewhere set it off.
import { useEffect, useId, useMemo } from "react"
import { SITE_VERSION } from "@/lib/site"
import { cn } from "@/lib/utils"
import { HANDOFF } from "../../copy/core"
import { OVERVIEW_COPY } from "../../copy/overview"
import { DemoLink, useDemo, useDemoWorld, useDispatch, useRoute, useWorld } from "../../engine/react"
import { PATHS } from "../../engine/router"
import {
  devicesSummary,
  homeHubHeard,
  meshNeighbours,
  nearbySentence,
  needsYou,
  nodeHealth,
  ownDevice,
  selectDevices,
  selectServices,
  servicesElsewhere,
  servicesHere,
  verdict,
} from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import type { ServiceId } from "../../engine/types"
import type { DemoService } from "../../engine/world"
import { useFragmentTarget, useHeadingLevel } from "../../shell/context"
import { RouteLink } from "../../shell/links"
import { selectMode, selectNavCount, selectNow } from "../../shell/select"
import { Button } from "../../ui/button"
import { FOCUS_RING, LABEL_CLASS } from "../../ui/classes"
import { CopyButton } from "../../ui/copy-button"
import { DemoNote } from "../../ui/demo-note"
import { Disclosure } from "../../ui/disclosure"
import { Heading } from "../../ui/heading"
import { MiniTerminal } from "../../ui/mini-terminal"
import { Panel } from "../../ui/panel"
import { SectionHeader } from "../../ui/section-header"
import { SpecTable, type SpecRow } from "../../ui/spec-table"
import { StatusDot } from "../../ui/status-dot"
import {
  activityLines,
  checklistPending,
  checklistSummary,
  homeHubLine,
  NEEDS_YOU_ID,
  nearbyRows,
  needRows,
  nodeFacts,
  overviewChecklist,
  type NeedRow,
  type OverviewChecklistRow,
} from "./model"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"
const SENTENCE = "font-mono text-sm leading-relaxed text-foreground"
/** In-text links: a 44 px target at every width (real `inline-flex min-h-11 items-center`). */
const LINK_TARGET = "inline-flex min-h-11 items-center font-mono text-xs"

const c = OVERVIEW_COPY

const selectEvents = (s: DemoState) => s.core.events

/** The real activity feed's length; advanced mode shows the whole log. */
const ACTIVITY_LINES = 20

// ---------------------------------------------------------------------------------- needs you

function ChecklistList({ rows }: { rows: readonly OverviewChecklistRow[] }) {
  return (
    <ul className="divide-y divide-border border border-border">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-1 px-3 py-2.5 @min-[640px]:flex-row @min-[640px]:items-start @min-[640px]:gap-3">
          {/* The state word is printed by the dot itself; a fixed column keeps the titles aligned. */}
          <StatusDot state={r.state} className="shrink-0 @min-[640px]:mt-0.5 @min-[640px]:w-24" />
          <div className="min-w-0 flex-1 font-mono text-xs leading-relaxed">
            <span className="text-foreground">{r.title}</span>
            <span className="text-muted-foreground">: {r.text}</span>
            {r.href && !r.done ? (
              <>
                {" "}
                <RouteLink to={r.href} aria-label={`${c.needs.open}: ${r.title}`}>
                  {c.needs.open}
                </RouteLink>
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function NeedRowItem({ row, onSetup }: { row: NeedRow; onSetup: (id: ServiceId) => void }) {
  const setup = row.setup
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:justify-between @min-[640px]:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {/* Proposals and message requests get a hollow pip (not a status); dot rows keep the column empty. */}
        <span aria-hidden="true" className={cn("mt-1 inline-block h-2 w-2 shrink-0", row.marker.kind === "pip" && "border border-foreground")} />
        <div className="min-w-0 font-mono text-xs leading-relaxed">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={LABEL_CLASS}>{row.kindLabel}</span>
            {row.demoNote ? <DemoNote /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3">
            <RouteLink to={row.href} className="inline-flex min-h-11 items-center">
              {row.label}
            </RouteLink>
            {row.marker.kind === "dot" ? <StatusDot state={row.marker.state} /> : null}
          </div>
          <p className="text-muted-foreground">{row.detail}</p>
        </div>
      </div>
      {setup ? (
        <Button size="sm" className="shrink-0 self-start @min-[640px]:self-center" onClick={() => onSetup(setup)}>
          {HANDOFF.setup}
        </Button>
      ) : null}
    </li>
  )
}

function NeedsYouPanel() {
  const need = useDemo(needsYou)
  const services = useDemo(selectServices)
  const dispatch = useDispatch()
  const level = useHeadingLevel(1)
  const headingId = useId()

  // "/overview#needs-you" is the header badge's target: main scrolls here (useFragmentTarget) and,
  // as in the real dashboard, focus lands on the block. Keyed on navCount so every badge click counts.
  const ref = useFragmentTarget<HTMLElement>(NEEDS_YOU_ID)
  const route = useRoute()
  const navCount = useDemo(selectNavCount)
  const hit = route?.fragment === NEEDS_YOU_ID
  useEffect(() => {
    if (hit) ref.current?.focus({ preventScroll: true })
  }, [hit, navCount, ref])

  const rows = useMemo(() => needRows(need.items, services), [need.items, services])
  const checklist = useMemo(() => overviewChecklist(need.checklist), [need.checklist])
  const pending = checklistPending(checklist)
  const onSetup = (id: ServiceId) => dispatch({ type: "overview/askAgent", goal: "setup", id })

  return (
    <section ref={ref} id={NEEDS_YOU_ID} tabIndex={-1} aria-labelledby={headingId} className={cn("outline-none", FOCUS_RING)}>
      <Panel title={c.needs.chrome} bodyClassName="space-y-4">
        <Heading level={level} id={headingId} className="sr-only">
          {c.needs.heading}
        </Heading>
        {rows.length > 0 ? (
          <ul className="divide-y divide-border border border-border">
            {rows.map((row) => (
              <NeedRowItem key={row.key} row={row} onSetup={onSetup} />
            ))}
          </ul>
        ) : null}

        {pending ? (
          <div className="space-y-2">
            <p className={LABEL_CLASS}>{c.needs.checklist}</p>
            <ChecklistList rows={checklist} />
          </div>
        ) : (
          <div className="space-y-1">
            {rows.length === 0 ? <p className={SENTENCE}>{c.needs.nothing}</p> : null}
            <Disclosure summary={checklistSummary(checklist)}>
              <ChecklistList rows={checklist} />
            </Disclosure>
          </div>
        )}
      </Panel>
    </section>
  )
}

// ------------------------------------------------------------------------------ nearby, devices

function NearbyCard() {
  const world = useWorld()
  const sentence = useDemo(nearbySentence)
  const heard = useDemoWorld(meshNeighbours)
  const hub = useDemoWorld(homeHubHeard)
  const level = useHeadingLevel(1)
  const rows = useMemo(() => nearbyRows(heard, world), [heard, world])
  const hubLine = homeHubLine(hub, world)

  return (
    <Panel title={c.nearby.chrome} bodyClassName="space-y-3">
      <Heading level={level} className="sr-only">
        {c.nearby.heading}
      </Heading>
      <p className={SENTENCE}>{sentence}</p>
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs leading-relaxed">
              <span className="text-foreground">{r.name}</span>
              <span className="text-muted-foreground">
                · {r.device} · {r.via}
                {r.relay ? ` · ${c.nearby.relay}` : ""}
              </span>
              <DemoNote kind="node" />
            </li>
          ))}
        </ul>
      ) : null}
      {hubLine ? (
        <p className={cn(TEXT, "flex flex-wrap items-center gap-x-2 gap-y-1")}>
          <span>{hubLine}</span>
          <DemoNote kind="node" />
        </p>
      ) : null}
      <RouteLink to={PATHS.nearby} className={LINK_TARGET}>
        {c.nearby.link}
      </RouteLink>
    </Panel>
  )
}

function DevicesCard() {
  const summary = useDemo(devicesSummary)
  const devices = useDemo(selectDevices)
  const level = useHeadingLevel(1)

  return (
    <Panel title={c.devices.chrome} bodyClassName="space-y-3">
      <Heading level={level} className="sr-only">
        {c.devices.heading}
      </Heading>
      <p className={SENTENCE}>{summary.text}</p>
      {devices.length > 0 ? (
        <ul className="flex flex-col">
          {devices.map((d) => (
            <li key={d.id} className="font-mono text-xs leading-relaxed">
              <div className="flex flex-wrap items-center gap-x-3">
                {/* The dot's own word is hidden only because the device's state word sits right beside it. */}
                <span className="inline-flex items-center gap-2">
                  <StatusDot state={d.dot} label={false} name={d.name} />
                  <span className={LABEL_CLASS}>{d.stateLabel}</span>
                </span>
                <RouteLink to={d.href} className="inline-flex min-h-11 items-center break-all">
                  {d.name}
                </RouteLink>
              </div>
              <p className="text-muted-foreground">{d.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <RouteLink to={PATHS.devices} className={LINK_TARGET}>
        {c.devices.link}
      </RouteLink>
    </Panel>
  )
}

// ---------------------------------------------------------------------------------- services

const GRID = "grid grid-cols-1 gap-3 @min-[768px]:grid-cols-2 @min-[1024px]:grid-cols-3"

function ServiceCard({ service }: { service: DemoService }) {
  return (
    <DemoLink to={PATHS.service(service.id)} className={cn("group block", FOCUS_RING)}>
      <Panel className="h-full transition-colors duration-200 group-hover:border-foreground" bodyClassName="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 font-mono text-sm text-foreground">{service.name}</span>
          <StatusDot state={service.state} className="shrink-0" />
        </div>
        <p className={cn(TEXT, "line-clamp-2")}>{service.reason}</p>
      </Panel>
    </DemoLink>
  )
}

function ServicesGrid() {
  const here = useDemo(servicesHere)
  const elsewhere = useDemo(servicesElsewhere)
  const level = useHeadingLevel(1)
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <Heading level={level} id={headingId} className={LABEL_CLASS}>
        {c.services.heading}
      </Heading>
      <div className={GRID}>
        {here.map((s) => (
          <ServiceCard key={s.id} service={s} />
        ))}
      </div>
      {elsewhere.length > 0 ? (
        <Disclosure summary={c.services.elsewhere(elsewhere.length)} className="mt-3">
          <div className={cn(GRID, "pt-1")}>
            {elsewhere.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </Disclosure>
      ) : null}
    </section>
  )
}

// -------------------------------------------------------------------------------- node facts

function NodePanel() {
  const world = useWorld()
  const own = useDemoWorld(ownDevice)
  const services = useDemo(selectServices)
  const events = useDemo(selectEvents)
  const now = useDemo(selectNow)
  const mode = useDemo(selectMode)
  const level = useHeadingLevel(1)
  const f = nodeFacts({ own, services, events, now, world, version: SITE_VERSION })
  const r = c.node.rows

  const rows: SpecRow[] = [
    {
      label: r.label,
      value: (
        <span className="inline-flex flex-wrap items-center justify-end gap-2">
          <span className="break-all">{f.label}</span>
          <CopyButton text={f.label} ariaLabel={c.node.copyLabel} />
        </span>
      ),
    },
    { label: r.name, value: f.name },
    { label: r.device, value: f.device },
    { label: r.hardware, value: f.hardware },
    { label: r.version, value: f.version },
    { label: r.uptime, value: f.uptime },
    { label: r.updates, value: f.updates },
    { label: r.lastCheck, value: f.lastCheck },
    { label: r.gateway, value: f.gateway },
    { label: r.dashboard, value: f.dashboard },
  ]

  return (
    <Panel title={c.node.chrome} flush>
      <Heading level={level} className="sr-only">
        {c.node.heading}
      </Heading>
      <SpecTable bare mode={mode} rows={rows} />
    </Panel>
  )
}

// ---------------------------------------------------------------------------------- activity

function Activity() {
  const events = useDemo(selectEvents)
  const mode = useDemo(selectMode)
  const dispatch = useDispatch()
  const level = useHeadingLevel(1)
  const activityId = useId()
  const advancedId = useId()
  const recent = useMemo(() => activityLines(events, ACTIVITY_LINES), [events])
  const all = useMemo(() => (mode === "advanced" ? activityLines(events, events.length) : []), [events, mode])

  return (
    <>
      <section aria-labelledby={activityId} className="space-y-3">
        <Heading level={level} id={activityId} className={LABEL_CLASS}>
          {c.activity.heading}
        </Heading>
        <MiniTerminal title={c.activity.title} lines={recent} follow emptyText={c.activity.empty} />
        <div className="space-y-2">
          <Button size="sm" onClick={() => dispatch({ type: "overview/askAgent", goal: "check" })}>
            {c.ask.check}
          </Button>
          <p className={TEXT}>{c.ask.note}</p>
        </div>
      </section>

      {mode === "advanced" ? (
        <section aria-labelledby={advancedId} className="space-y-3">
          <Heading level={level} id={advancedId} className={LABEL_CLASS}>
            {c.activity.advanced}
          </Heading>
          <MiniTerminal title={c.activity.all} lines={all} follow maxHeightClass="max-h-96" emptyText={c.activity.allEmpty} />
        </section>
      ) : null}
    </>
  )
}

// -------------------------------------------------------------------------------------- view

export default function OverviewView() {
  const own = useDemoWorld(ownDevice)
  const health = useDemo(nodeHealth)
  const v = useDemo(verdict)
  const titleLevel = useHeadingLevel()

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader level={titleLevel} kicker={c.kicker} title={own.name} end={<StatusDot state={health} />} />

      {/* The verdict: one plain sentence (real lib/verdict.ts rules, engine/selectors verdict). */}
      <p className={SENTENCE}>{v.sentence}</p>

      <NeedsYouPanel />

      <div className="grid grid-cols-1 gap-3 @min-[768px]:grid-cols-2">
        <NearbyCard />
        <DevicesCard />
      </div>

      <ServicesGrid />

      <NodePanel />

      <Activity />
    </div>
  )
}
