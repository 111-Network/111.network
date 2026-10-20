// Service page template (#/services/<id> for the Local AI agent, Local model, Mesh link, Long-range radio,
// Knowledge base and Messaging; the Internet gateway, Bridge, Storage and Repairs have their own pages).
// Port of the real os/4-interface/ui/src/views/services/index.tsx ServicePage, minus every API call and the
// hosted-panel, partner-client and messaging-detail parts:
//   the shared ServicePageFrame   header, dot + since, reason, description, NOT SET setup panel with
//                                 "Set up with the agent", STARTING note, ERROR "Fix with the agent", recipe
//   actions                       Restart (two-step confirm, supervised services only, real RestartControl);
//                                 on the radio page: [DEMO] plug in a radio board, then the way to its page
//   body                          Details | Log: the control panel (plain facts, real ControlPanel) and the
//                                 short sample log (real LogTail), both from the demo store
// Restart dispatches "services/restart": core/serviceTransition STARTING -> LIVE through the scheduler
// (instant under reduced motion). The radio stays NOT SET until its board is flashed and a region picked
// (core radio stages); those steps live on the board's device page.
import { Fragment, useEffect, useRef, useState } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { DEMO_ACTIONS } from "../../../copy/core"
import { SERVICES_COPY } from "../../../copy/services"
import { RADIO_BOARD_ID } from "../../../engine/core"
import { useDemo, useDemoWorld, useDispatch, useWorld } from "../../../engine/react"
import { PATHS } from "../../../engine/router"
import { meshNeighbours, selectServices } from "../../../engine/selectors"
import { isTemplateService, type TemplateServiceId } from "../../../engine/slices/services"
import type { DemoService } from "../../../engine/world"
import { useHeadingLevel } from "../../../shell/context"
import { RouteButtonLink, RouteLink } from "../../../shell/links"
import { selectMode } from "../../../shell/select"
import { servicePageState } from "../../../shell/service-page"
import type { ServiceViewProps } from "../../../shell/view-types"
import { Button } from "../../../ui/button"
import { DemoButton } from "../../../ui/demo-button"
import { Heading } from "../../../ui/heading"
import { Panel } from "../../../ui/panel"
import { SpecTable, type SpecRow } from "../../../ui/spec-table"
import { ServicePageFrame } from "../frame"
import { ServiceLog } from "./log"
import {
  factRows,
  hasActions,
  radioStep,
  restartView,
  selectOpenProposalCount,
  selectRadio,
  selectRestarting,
  selectServiceLogs,
  selectTransport,
  TAB_DEFS,
  type FactRow,
  type RestartView,
  type TabId,
} from "./model"
import { Tabs } from "./tabs"

// ------------------------------------------------------------------------------------ actions

/**
 * Restart one supervised service (real RestartControl). The button reads "Restarting…" from Yes until
 * the service is LIVE again; it stays mounted (busy, aria-disabled), so focus never drops to the page.
 */
function RestartControl({ service, view }: { service: DemoService; view: RestartView }) {
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  return (
    <Button
      confirm={SERVICES_COPY.restart.confirm(service.name)}
      loading={view.loading}
      onClick={() => dispatch({ type: "services/restart", id: service.id, instant: reduced })}
    >
      {view.label}
    </Button>
  )
}

/**
 * The radio page's step: [DEMO] plug in a radio board (the same core action as Devices and Bridge), then
 * a link to the board's device page, where the consent, identify, flash and region steps are. After the
 * plug click the link takes focus, so the swapped control never drops it.
 */
function RadioStepControl() {
  const radio = useDemo(selectRadio)
  const dispatch = useDispatch()
  const step = radioStep(radio)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const plugged = useRef(false)

  useEffect(() => {
    if (step !== "continue" || !plugged.current) return
    plugged.current = false
    wrapRef.current?.querySelector("a")?.focus()
  }, [step])

  if (step === null) return null
  return (
    <span ref={wrapRef} className="inline-flex">
      {step === "plug" ? (
        <DemoButton
          onClick={() => {
            plugged.current = true
            dispatch({ type: "core/radioPlugged" })
          }}
        >
          {DEMO_ACTIONS.plugRadio}
        </DemoButton>
      ) : (
        <RouteButtonLink to={PATHS.device(RADIO_BOARD_ID)} arrow>
          {SERVICES_COPY.radio.continue}
        </RouteButtonLink>
      )}
    </span>
  )
}

// --------------------------------------------------------------------------------------- body

/** One fact's value: its parts joined by " · ", links as in-demo links. */
function FactValue({ row }: { row: FactRow }) {
  return (
    <>
      {row.parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? " · " : null}
          {p.to ? <RouteLink to={p.to}>{p.text}</RouteLink> : p.text}
        </Fragment>
      ))}
    </>
  )
}

/** Details | Log (real WithPanelTab: Details | Panel). Keyed by service, so another service opens on Details. */
function TemplateBody({ id, service }: { id: TemplateServiceId; service: DemoService }) {
  const [tab, setTab] = useState<TabId>("details")
  const mode = useDemo(selectMode)
  const services = useDemo(selectServices)
  const radio = useDemo(selectRadio)
  const transport = useDemo(selectTransport)
  const logs = useDemo(selectServiceLogs)
  const proposals = useDemo(selectOpenProposalCount)
  const heard = useDemoWorld(meshNeighbours)
  const world = useWorld()
  const level = useHeadingLevel(1)
  if (servicePageState(service).body === "unavailable") return null

  const rows: SpecRow[] = factRows(id, service, { world, services, radio, transport, heard, openProposals: proposals }).map((r) => ({
    label: r.label,
    minMode: r.minMode,
    value: <FactValue row={r} />,
  }))

  return (
    <Tabs<TabId> label={SERVICES_COPY.tabs.label(service.name)} tabs={TAB_DEFS} value={tab} onChange={setTab}>
      {(t) =>
        t === "details" ? (
          <Panel title={service.name} suffix={SERVICES_COPY.panel.suffix} flush>
            <Heading level={level} className="sr-only">
              {SERVICES_COPY.panel.heading}
            </Heading>
            <SpecTable bare mode={mode} rows={rows} />
          </Panel>
        ) : t === tab ? (
          <ServiceLog name={service.name} lines={logs[id]} mode={mode} live={service.state === "starting"} />
        ) : null
      }
    </Tabs>
  )
}

// --------------------------------------------------------------------------------------- page

export default function ServiceTemplatePage({ id }: ServiceViewProps) {
  const services = useDemo(selectServices)
  const radio = useDemo(selectRadio)
  const restarting = useDemo(selectRestarting)
  const service = services.find((s) => s.id === id)
  if (!service || !isTemplateService(id)) return <ServicePageFrame id={id} />

  const restart = restartView(service, restarting)
  const actions = hasActions(service, restarting, radio) ? (
    <>
      {restart.show ? <RestartControl service={service} view={restart} /> : null}
      {id === "radio" ? <RadioStepControl /> : null}
    </>
  ) : undefined

  return (
    <ServicePageFrame id={id} actions={actions}>
      <TemplateBody key={id} id={id} service={service} />
    </ServicePageFrame>
  )
}
