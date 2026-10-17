// Internet gateway service page (#/services/gateway, Layer 7; plan §6.4 "Presence + Internet
// gateway"). Inside the shared ServicePageFrame: "[DEMO] connect to the internet" (core/internetConnected:
// the gateway goes STARTING -> LIVE and the messages slice flushes its queue), the overlay role with
// the node chip that never changes, the heard nodes the gateway serves, the outbox and the page's log.
// Dropping the connection makes this laptop a pure mesh node again (core/internetLost).
import { GATEWAY_COPY } from "../../../copy/gateway"
import { formatClock } from "../../../engine/clock"
import { useDemo, useDemoWorld } from "../../../engine/react"
import { PATHS } from "../../../engine/router"
import { meshNeighbours, ownDevice } from "../../../engine/selectors"
import { openSession, type GatewaySession } from "../../../engine/slices/gateway"
import { useHeadingLevel } from "../../../shell/context"
import { RouteButtonLink } from "../../../shell/links"
import { selectMode, selectNow } from "../../../shell/select"
import type { ServiceViewProps } from "../../../shell/view-types"
import { Heading } from "../../../ui/heading"
import { MiniTerminal } from "../../../ui/mini-terminal"
import { Panel } from "../../../ui/panel"
import { SpecTable, type SpecRow } from "../../../ui/spec-table"
import { HeardGroups } from "../../nearby/heard-list"
import { selectGateway, selectGatewayState, selectInternet, selectLastFlush, selectRadio } from "../../nearby/select"
import { ServicePageFrame } from "../frame"
import { InternetDemoButton } from "./internet-button"
import { gatewayLog, roleOf } from "./model"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"

/** The role: an overlay earned by reaching the internet; the node chip stays what the device is. */
function RolePanel() {
  const gateway = useDemo(selectGateway)
  const state = useDemo(selectGatewayState)
  const internet = useDemo(selectInternet)
  const own = useDemoWorld(ownDevice)
  const mode = useDemo(selectMode)
  const level = useHeadingLevel(1)
  const r = GATEWAY_COPY.role
  const open = openSession(gateway)
  const last = gateway.sessions[gateway.sessions.length - 1]
  const role = roleOf(state)
  const rows: SpecRow[] = [
    { label: r.node, value: own.name },
    { label: r.chip, value: r.chipSame(own.badge) },
    { label: r.internet, value: internet === "connected" ? r.connected : r.offline },
    { label: r.role, value: role === "gateway" ? r.gateway : role === "checking" ? r.checking : r.meshNode },
    {
      label: r.online,
      value: open ? r.onlineSince(formatClock(open.from)) : last && last.to !== null ? r.lastOnline(formatClock(last.from), formatClock(last.to)) : r.never,
    },
    { label: r.times, value: String(gateway.sessions.length), minMode: "advanced" },
  ]
  return (
    <Panel title={r.title} suffix={r.suffix} bodyClassName="space-y-4" data-testid="gateway-role">
      <Heading level={level} className="sr-only">
        {r.title}
      </Heading>
      <SpecTable bare mode={mode} rows={rows} />
      <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">{r.explain(own.badge)}</p>
      <p className={`max-w-prose ${TEXT}`}>{r.nowAndThen}</p>
      <p className={`max-w-prose ${TEXT}`}>{role === "mesh node" ? r.pureMesh : r.alwaysOn}</p>
    </Panel>
  )
}

/** Whom the gateway serves: whichever nodes can hear it (the same lists as Nearby). */
function PresencePanel() {
  const neighbours = useDemoWorld(meshNeighbours)
  const radio = useDemo(selectRadio)
  const internet = useDemo(selectInternet)
  const now = useDemo(selectNow)
  const mode = useDemo(selectMode)
  const level = useHeadingLevel(1)
  const groupLevel = useHeadingLevel(2)
  const p = GATEWAY_COPY.presence
  return (
    <section aria-labelledby="gateway-presence" className="flex flex-col gap-3" data-testid="gateway-presence">
      <Heading level={level} id="gateway-presence" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {p.title} · {p.suffix}
      </Heading>
      {neighbours.length === 0 ? (
        <p className={`max-w-prose ${TEXT}`}>{p.empty}</p>
      ) : (
        <>
          <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">{internet === "connected" ? p.online : p.offline}</p>
          <HeardGroups neighbours={neighbours} radio={radio} now={now} mode={mode} level={groupLevel} />
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <RouteButtonLink to={PATHS.nearby} size="sm">
          {p.openNearby}
        </RouteButtonLink>
      </div>
    </section>
  )
}

/** The outbox flushes while online (the messages slice reacts to the core event and says so). */
function OutboxPanel() {
  const gateway = useDemo(selectGateway)
  const internet = useDemo(selectInternet)
  const flush = useDemo(selectLastFlush)
  const level = useHeadingLevel(1)
  const o = GATEWAY_COPY.outbox
  const open = openSession(gateway)
  const flushedNow = open !== null && open.flushedAt !== null
  return (
    <Panel title={o.title} suffix={o.suffix} bodyClassName="space-y-3" data-testid="gateway-outbox">
      <Heading level={level} className="sr-only">
        {o.title}
      </Heading>
      {flushedNow && flush ? (
        <>
          <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">{o.flushed(formatClock(open.flushedAt ?? flush.at))}</p>
          {flush.text ? <p className={`max-w-prose ${TEXT}`}>{flush.text}</p> : null}
        </>
      ) : (
        <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">{internet === "connected" ? o.pending : o.offline}</p>
      )}
      <RouteButtonLink to={PATHS.messages} size="sm">
        {o.openMessages}
      </RouteButtonLink>
    </Panel>
  )
}

function LogPanel({ sessions }: { sessions: readonly GatewaySession[] }) {
  const l = GATEWAY_COPY.log
  return <MiniTerminal title={l.title} suffix={l.suffix} lines={gatewayLog(sessions)} emptyText={l.empty} follow />
}

export default function GatewayPage({ id }: ServiceViewProps) {
  const gateway = useDemo(selectGateway)
  return (
    <ServicePageFrame id={id} actions={<InternetDemoButton />}>
      <RolePanel />
      <OutboxPanel />
      <PresencePanel />
      <LogPanel sessions={gateway.sessions} />
    </ServicePageFrame>
  )
}
