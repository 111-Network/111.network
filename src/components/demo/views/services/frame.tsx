// The shared frame of every service page (real views/services/index.tsx ServicePage: the header,
// status line, reason and description, and the NOT SET / STARTING / ERROR bodies with the hand-off
// to the agent). The template and the custom pages (bridge, storage, repairs, gateway) all render it
// and put their own content in `actions` and `children`:
//
//   <ServicePageFrame id="bridge" actions={<DemoButton onClick={plug}>{DEMO_ACTIONS.plugRadio}</DemoButton>}>
//     …the page's own panels…
//   </ServicePageFrame>
//
// It reads the service from the store, so a state change (STARTING blink -> LIVE) shows at once.
// Its title takes the shell's heading level (h1 on /demo, h3 in the L4 window); sections a page
// adds in `children` use useHeadingLevel(1).
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { sinceText } from "../../engine/clock"
import { DemoLink, useDemo, useDispatch } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { layerPageTitle, selectServices } from "../../engine/selectors"
import type { LayerNumber, ServiceId } from "../../engine/types"
import { useHeadingLevel } from "../../shell/context"
import { SHELL_COPY } from "../../shell/copy"
import { RouteButtonLink } from "../../shell/links"
import { selectMode, selectNow } from "../../shell/select"
import { handoffPrompt, servicePageState, type ServiceHandoff } from "../../shell/service-page"
import { Button } from "../../ui/button"
import { FOCUS_RING } from "../../ui/classes"
import { Empty } from "../../ui/empty"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { SectionHeader } from "../../ui/section-header"
import { SpecTable, type SpecRow } from "../../ui/spec-table"
import { StatusDot } from "../../ui/status-dot"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"

export interface ServicePageFrameProps {
  /** The service this page is about. */
  id: ServiceId
  /**
   * Contextual controls shown right under the reason, e.g. `[DEMO] connect to the internet`
   * (a DemoButton), a Toggle, a Restart Button with `confirm`.
   */
  actions?: ReactNode
  /** The page's own body (control panel, diagrams, logs), below the status and the hand-off. */
  children?: ReactNode
  /** Replace the prepared prompt of "Set up with the agent" / "Fix with the agent". */
  prompt?: string
  /** Show the hand-off button when the service is NOT SET or in ERROR (default true). */
  handoff?: boolean
}

/** The layer tag in the header: a small bordered link to the layer's settings page. */
function LayerTag({ n }: { n: LayerNumber }) {
  const title = layerPageTitle(n)
  return (
    <DemoLink
      to={PATHS.settingsLayer(n)}
      title={SHELL_COPY.service.layerTag(title)}
      className={cn(
        "inline-flex min-h-11 items-center border border-border px-2 font-mono text-[10px] text-muted-foreground transition-colors duration-200 hover:border-foreground hover:bg-foreground hover:text-background",
        FOCUS_RING,
      )}
    >
      {title}
    </DemoLink>
  )
}

function Handoff({ handoff, onAsk }: { handoff: ServiceHandoff; onAsk: () => void }) {
  return (
    <div className="space-y-3">
      <Button variant="primary" onClick={onAsk}>
        {handoff.label}
      </Button>
      <p className={TEXT}>{SHELL_COPY.service.handoffNote}</p>
    </div>
  )
}

export function ServicePageFrame({ id, actions, children, prompt, handoff = true }: ServicePageFrameProps) {
  const services = useDemo(selectServices)
  const now = useDemo(selectNow)
  const mode = useDemo(selectMode)
  const dispatch = useDispatch()
  const titleLevel = useHeadingLevel()
  const sectionLevel = useHeadingLevel(1)
  const service = services.find((s) => s.id === id)
  if (!service) return null
  const page = servicePageState(service)
  const copy = SHELL_COPY.service

  // Opens the Agent with the prompt in its composer (core/agentPrefill navigates to "/"). Nothing is sent.
  const ask = (goal: ServiceHandoff["goal"]) =>
    dispatch({ type: "core/agentPrefill", text: prompt ?? handoffPrompt(goal, service.id), from: service.name })

  const needs: SpecRow[] = service.requires ? [{ label: copy.needs, value: service.requires }] : []
  const showHandoff = handoff && page.handoff !== null

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader level={titleLevel} kicker={copy.kicker} title={service.name} end={<LayerTag n={service.layer} />} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusDot state={service.state} />
          <span className={TEXT}>{sinceText(service.since, now)}</span>
        </div>
        <p className="font-mono text-sm leading-relaxed text-foreground">{service.reason}</p>
        <p className={TEXT}>{service.description}</p>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}

      {page.body === "starting" ? <p className="font-mono text-xs leading-relaxed text-foreground">{copy.starting}</p> : null}

      {page.body === "unset" ? (
        <Panel title={service.name} suffix={copy.setup} bodyClassName="space-y-4">
          <Heading level={sectionLevel} className="sr-only">
            {copy.setupHeading}
          </Heading>
          {needs.length > 0 ? <SpecTable bare mode={mode} rows={needs} /> : null}
          {page.handoff === null ? <p className={TEXT}>{copy.noSetup}</p> : null}
          {showHandoff && page.handoff ? <Handoff handoff={page.handoff} onAsk={() => ask("setup")} /> : null}
        </Panel>
      ) : null}

      {page.body === "unavailable" ? (
        <Empty kicker={copy.unavailable.kicker} title={copy.unavailable.title}>
          {service.requires ? copy.unavailable.needs(service.requires) : copy.unavailable.fallback}
        </Empty>
      ) : null}

      {page.body === "error" && showHandoff && page.handoff ? <Handoff handoff={page.handoff} onAsk={() => ask("fix")} /> : null}

      {children}

      {page.recipePath ? (
        <div className="flex flex-wrap items-center gap-3">
          <RouteButtonLink to={page.recipePath}>{copy.recipe}</RouteButtonLink>
        </div>
      ) : null}
    </div>
  )
}
