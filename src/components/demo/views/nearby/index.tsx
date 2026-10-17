// Nearby (#/nearby, Layers 5 and 7; plan §6.4). Real views/nearby/index.tsx: the sentence, the heard
// lists by way of hearing with their honest empty states, the radar panel and "Ask the agent who is
// nearby". The demo adds what Layer 7 brings: RADAR | LIST, the home hub apart, presence and the
// gateway overlay. Nothing here moves by itself: a blip has a named cause (the radio board starting
// to listen, a custody acknowledgement, the internet, "[DEMO] listen for a minute").
import { lazy, Suspense } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { DEMO_ACTIONS, ROUTE_TITLES } from "../../copy/core"
import { NEARBY_COPY } from "../../copy/nearby"
import { formatClock } from "../../engine/clock"
import type { HeardEntry } from "../../engine/core"
import { useDemo, useDemoWorld, useDispatch, useWorld } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { homeHubHeard, meshNeighbours, nearbySentence } from "../../engine/selectors"
import { heardNames, type NearbyMode } from "../../engine/slices/nearby"
import { networkById, nodeName } from "../../engine/world"
import { useAnnounce, useHeadingLevel } from "../../shell/context"
import { RouteButtonLink, RouteLink } from "../../shell/links"
import { selectMode, selectNow } from "../../shell/select"
import { Button } from "../../ui/button"
import { DemoButton } from "../../ui/demo-button"
import { DemoNote } from "../../ui/demo-note"
import { Empty } from "../../ui/empty"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { SectionHeader } from "../../ui/section-header"
import { Segmented } from "../../ui/segmented"
import { StatusDot } from "../../ui/status-dot"
import { InternetDemoButton } from "../services/gateway/internet-button"
import { HeardGroups, HomeLinkPanel } from "./heard-list"
import { nearbyPage, pathText, sortedHeard, type NearbyPage } from "./model"
import {
  selectGatewayService,
  selectMeshService,
  selectNearby,
  selectRadio,
  selectRadioService,
  selectTransport,
} from "./select"

// The radar is its own chunk (plan §6.5 "Bundle"): only RADAR loads it.
const Radar = lazy(() => import("./radar"))

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"

const MODE_OPTIONS = [
  { value: "radar", label: NEARBY_COPY.view.radar },
  { value: "list", label: NEARBY_COPY.view.list },
] as const

// ------------------------------------------------------------------------------------------ listen

/** "[DEMO] listen for a minute" and its line. One finite burst; it is the same button while it runs, so focus stays on it. */
function ListenControls() {
  const nearby = useDemo(selectNearby)
  const radioService = useDemo(selectRadioService)
  const dispatch = useDispatch()
  const announce = useAnnounce()
  const reduced = useReducedMotion()
  const world = useWorld()
  const c = NEARBY_COPY.listen
  const canListen = radioService?.state === "live"
  const run = nearby.listen

  const onClick = () => {
    if (run) {
      dispatch({ type: "nearby/stopListening" })
      return
    }
    // The start has no store event (the end does), so it is announced here; under reduced motion the whole minute lands at once.
    if (!reduced) announce(c.started)
    dispatch({ type: "nearby/listen", instant: reduced })
  }

  if (!canListen && !run && !nearby.last) return null
  return (
    <div className="flex flex-col gap-2" data-testid="nearby-listen">
      {canListen || run ? <DemoButton onClick={onClick}>{run ? c.stop : DEMO_ACTIONS.listen}</DemoButton> : null}
      {run ? (
        <p className={TEXT}>
          {c.since(formatClock(run.startedAt))} {c.soFar(heardNames(run.heard, world))}
        </p>
      ) : nearby.last ? (
        <p className={TEXT}>{c.last(formatClock(nearby.last.endedAt), nearby.last.text)}</p>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------------------------------- radar

/** The visible list beside the radar: the same facts as the drawing, for everyone. */
function RadarLegend({ neighbours, home }: { neighbours: readonly HeardEntry[]; home: HeardEntry | null }) {
  const world = useWorld()
  const r = NEARBY_COPY.radar
  const gateway = useDemo(selectGatewayService)
  const sorted = sortedHeard(neighbours, world)
  const online = gateway?.state === "live" || gateway?.state === "starting"
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.legend}</p>
      {sorted.length === 0 && !home && !online ? <p className={TEXT}>{r.legendEmpty}</p> : null}
      <ul className="flex flex-col gap-2">
        {sorted.map((h) => (
          <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-xs">
            <span className="text-foreground">{nodeName(world, h.id)}</span>
            <span className="text-muted-foreground">{pathText(h, world)}</span>
            <DemoNote kind="node" />
          </li>
        ))}
        {home ? (
          <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-xs">
            <span className="text-foreground">{nodeName(world, home.id)}</span>
            <span className="text-muted-foreground">{r.homeLink}</span>
            <DemoNote kind="node" />
          </li>
        ) : null}
        {online && gateway ? (
          <li className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
            <span className="text-foreground">{r.gateway}</span>
            <StatusDot state={gateway.state} name={gateway.name} />
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function RadarPanel({ neighbours, home }: { neighbours: readonly HeardEntry[]; home: HeardEntry | null }) {
  const reduced = useReducedMotion()
  const level = useHeadingLevel(1)
  const r = NEARBY_COPY.radar
  return (
    <Panel title={r.title} suffix={r.suffix} tint heading={level === 1 ? 2 : level} data-testid="nearby-radar">
      <div className="flex flex-col gap-4 @min-[768px]:flex-row @min-[768px]:items-start">
        {/* The box keeps the drawing's shape while its chunk loads, so nothing jumps. */}
        <div className="aspect-[6/5] w-full min-w-0 max-w-lg flex-1">
          <Suspense
            fallback={
              <p role="status" className="sr-only">
                {r.loading}
              </p>
            }
          >
            <Radar reduced={reduced} />
          </Suspense>
        </div>
        <div className="@min-[768px]:w-64 @min-[768px]:shrink-0">
          <RadarLegend neighbours={neighbours} home={home} />
        </div>
      </div>
      <p className={`mt-4 max-w-prose ${TEXT}`}>{r.caption}</p>
    </Panel>
  )
}

// ---------------------------------------------------------------------------------------- presence

/** Layer 7: this node's heartbeats, and the gateway role it earns while it reaches the internet. */
function PresencePanel() {
  const world = useWorld()
  const transport = useDemo(selectTransport)
  const gateway = useDemo(selectGatewayService)
  const p = NEARBY_COPY.presence
  const level = useHeadingLevel(1)
  const gwLine = gateway?.state === "live" ? p.gatewayLive : gateway?.state === "starting" ? p.gatewayStarting : p.gatewayOff
  return (
    <Panel title={p.title} suffix={p.suffix} bodyClassName="space-y-3">
      <Heading level={level} className="sr-only">
        {p.title}
      </Heading>
      <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">
        {transport.joined ? p.joined(networkById(world, transport.joined).name) : p.alone}
      </p>
      {gateway ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-xs text-foreground">{gateway.name}</span>
          <StatusDot state={gateway.state} />
        </div>
      ) : null}
      <p className={`max-w-prose ${TEXT}`}>{gwLine}</p>
      <div className="flex flex-wrap items-center gap-3">
        <InternetDemoButton />
        <RouteLink to={PATHS.service("gateway")} className="inline-flex min-h-11 items-center font-mono text-xs">
          {p.gatewayPage}
        </RouteLink>
      </div>
    </Panel>
  )
}

// -------------------------------------------------------------------------------------- the empties

function EmptyAction({ page }: { page: NearbyPage }) {
  const radio = useDemo(selectRadio)
  switch (page.kind) {
    case "no-board":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <RouteButtonLink to={PATHS.devices} size="sm">
            {NEARBY_COPY.openDevices}
          </RouteButtonLink>
          <RouteButtonLink to={PATHS.service("radio")} size="sm">
            {NEARBY_COPY.radioPage}
          </RouteButtonLink>
        </div>
      )
    case "unbound":
      return radio ? (
        <RouteButtonLink to={PATHS.device(radio.id)} size="sm">
          {NEARBY_COPY.openBoard}
        </RouteButtonLink>
      ) : null
    case "starting":
    case "error":
    case "empty":
      return (
        <RouteButtonLink to={PATHS.service("radio")} size="sm">
          {NEARBY_COPY.radioPage}
        </RouteButtonLink>
      )
    case "no-mesh":
    case "mesh-error":
      return (
        <RouteButtonLink to={PATHS.service("mesh")} size="sm">
          {NEARBY_COPY.meshPage}
        </RouteButtonLink>
      )
    default:
      return null
  }
}

// --------------------------------------------------------------------------------------------- view

export default function NearbyView() {
  const sentence = useDemo(nearbySentence)
  const nearby = useDemo(selectNearby)
  const radio = useDemo(selectRadio)
  const radioService = useDemo(selectRadioService)
  const meshService = useDemo(selectMeshService)
  const neighbours = useDemoWorld(meshNeighbours)
  const home = useDemoWorld(homeHubHeard)
  const now = useDemo(selectNow)
  const mode = useDemo(selectMode)
  const dispatch = useDispatch()
  const titleLevel = useHeadingLevel()
  const sectionLevel = useHeadingLevel(1)
  const groupLevel = useHeadingLevel(2)
  const page = nearbyPage({ neighbours: neighbours.length, radio, radioService, meshService })
  const view: NearbyMode = nearby.mode

  const ask = () => dispatch({ type: "core/agentPrefill", text: NEARBY_COPY.question, from: ROUTE_TITLES.nearby })

  return (
    <div className="flex flex-col gap-6" data-testid="nearby-view">
      <SectionHeader kicker={NEARBY_COPY.kicker} title={ROUTE_TITLES.nearby} level={titleLevel} />
      <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">{sentence}</p>

      <div className="flex flex-col gap-3 @min-[640px]:flex-row @min-[640px]:flex-wrap @min-[640px]:items-start @min-[640px]:gap-6">
        <Segmented<NearbyMode>
          label={NEARBY_COPY.view.label}
          value={view}
          onChange={(m) => dispatch({ type: "nearby/setMode", mode: m })}
          options={MODE_OPTIONS}
        />
        <ListenControls />
      </div>

      {page.kind === "list" ? (
        <section aria-labelledby="nearby-lists" className="flex flex-col gap-3" data-testid="nearby-lists">
          <Heading level={sectionLevel} id="nearby-lists" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {NEARBY_COPY.heardHeading}
          </Heading>
          <p className="font-mono text-sm leading-relaxed text-foreground">{NEARBY_COPY.summary(neighbours.length)}</p>
          {page.text ? (
            <p role="status" className="max-w-prose border border-dashed border-border p-3 font-mono text-xs leading-relaxed text-foreground" data-testid="nearby-stale">
              {page.text}
            </p>
          ) : null}
          {view === "radar" ? (
            <RadarPanel neighbours={neighbours} home={home} />
          ) : (
            <HeardGroups neighbours={neighbours} radio={radio} now={now} mode={mode} level={groupLevel} />
          )}
          <p className={`max-w-prose ${TEXT}`}>{NEARBY_COPY.footnote}</p>
        </section>
      ) : (
        <>
          <Empty kicker={page.kicker ?? undefined} title={page.title ?? ""} action={<EmptyAction page={page} />}>
            {page.text}
          </Empty>
          {view === "radar" ? <RadarPanel neighbours={neighbours} home={home} /> : null}
        </>
      )}

      {home && view === "list" ? <HomeLinkPanel home={home} now={now} mode={mode} level={sectionLevel} /> : null}

      <PresencePanel />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={ask}>{NEARBY_COPY.ask}</Button>
        <RouteLink to={PATHS.service("radio")} className="inline-flex min-h-11 items-center font-mono text-xs">
          {NEARBY_COPY.radioPage}
        </RouteLink>
      </div>
    </div>
  )
}
