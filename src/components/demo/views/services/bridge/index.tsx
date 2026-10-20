// Bridge service page (#/services/bridge, Layer 6; plan §6.4 Bridge, §6.8 bootstrap rule). Not built in
// reality: the intended Layer 6 surface from os/README.md "Transport & Bridge", framed by the real
// service page (os/4-interface/ui/src/views/services/index.tsx, via the shared ServicePageFrame).
//
//   needs-radio  NOT SET "Needs a radio.": [DEMO] plug in a radio board (core/radioPlugged, the same
//                action as Devices), the facts and the board's steps still to come
//   radio-setup  the board's steps right here (allow once, identify, flash with the typed name, region),
//                all core radio actions; the board's own device page is one link away
//   radio-down   a set-up board whose radio is not running: why the bridge waits, the radio's page
//   needs-link   the radio runs but there is no hotspot or ethernet beside it (the bootstrap rule)
//   ready        the role toggle (bridge/setRole: STARTING -> LIVE), the preferred networks tried in
//                order (core transport) and the bridge diagram
//
// Focus: when a step or phase swaps the controls, the new step's heading takes the focus (only if the
// old control is gone). Store events are announced by the shell. Nothing moves while idle.
import { useRef, type Ref } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { BRIDGE_COPY } from "../../../copy/bridge"
import { DEMO_ACTIONS } from "../../../copy/core"
import { useDemo, useDispatch, useWorld } from "../../../engine/react"
import { PATHS } from "../../../engine/router"
import { selectServices } from "../../../engine/selectors"
import { useHeadingLevel } from "../../../shell/context"
import { RouteButtonLink } from "../../../shell/links"
import type { ServiceViewProps } from "../../../shell/view-types"
import { DemoButton } from "../../../ui/demo-button"
import type { HeadingLevel } from "../../../ui/heading"
import { Panel } from "../../../ui/panel"
import { SpecTable } from "../../../ui/spec-table"
import { Toggle } from "../../../ui/toggle"
import { ServicePageFrame } from "../frame"
import { DiagramPanel } from "./diagram"
import { FocusHeading, useStepFocus } from "./focus-heading"
import { bridgePhase, factRows, radioStep } from "./model"
import { NetworksPanel } from "./networks"
import { RadioStepsPanel } from "./radio-steps"
import { selectBridgePaused, selectRadioBoard, selectTransport } from "./select"

const F = BRIDGE_COPY.facts
const NOTE = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

// ------------------------------------------------------------------------------------ actions

/** [DEMO] plug in a radio board: the same core action as the Devices view. */
function PlugRadioButton() {
  const dispatch = useDispatch()
  return <DemoButton onClick={() => dispatch({ type: "core/radioPlugged" })}>{DEMO_ACTIONS.plugRadio}</DemoButton>
}

/** The role toggle: on = STARTING -> LIVE (core refuses it while the bootstrap rule does not hold), off = NOT SET. */
function RoleToggle() {
  const services = useDemo(selectServices)
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const c = BRIDGE_COPY.role
  const state = services.find((s) => s.id === "bridge")?.state
  const pressed = state === "live" || state === "starting"
  const word = state === "starting" ? c.starting : pressed ? c.on : c.off
  return (
    <div className="flex flex-col gap-2">
      <Toggle pressed={pressed} busy={state === "starting"} onPressedChange={(on) => dispatch({ type: "bridge/setRole", on, instant: reduced })}>
        <span className="flex flex-wrap items-center gap-x-3 text-xs">
          <span>{c.label}</span>
          <span aria-hidden="true" className={cn(state === "starting" && "animate-blink")}>
            {word}
          </span>
        </span>
      </Toggle>
      {pressed ? null : <p className={NOTE}>{c.offNote}</p>}
    </div>
  )
}

// --------------------------------------------------------------------------------------- body

/** "Can this laptop bridge?": the bootstrap rule as plain rows (filled square = met, hollow = not). */
function FactsPanel({ level, headingRef }: { level: HeadingLevel; headingRef?: Ref<HTMLHeadingElement> }) {
  const services = useDemo(selectServices)
  const radio = useDemo(selectRadioBoard)
  const transport = useDemo(selectTransport)
  const world = useWorld()
  const rows = factRows({ radio, services, transport }, world).map((r) => ({
    label: r.label,
    value: (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={r.met ? "h-2 w-2 shrink-0 bg-foreground" : "h-2 w-2 shrink-0 border border-foreground"} />
        <span>{r.value}</span>
      </span>
    ),
  }))
  return (
    <Panel title={F.title} suffix={F.suffix} bodyClassName="space-y-4">
      <FocusHeading level={level} headingRef={headingRef}>
        {F.heading}
      </FocusHeading>
      <p className={NOTE}>{F.rule}</p>
      <SpecTable bare rows={rows} />
    </Panel>
  )
}

/** A set-up board whose radio is not running (an error, a restart): the bridge waits for it. */
function RadioDownPanel({ level, headingRef }: { level: HeadingLevel; headingRef?: Ref<HTMLHeadingElement> }) {
  const paused = useDemo(selectBridgePaused)
  const c = BRIDGE_COPY.down
  return (
    <Panel title={c.title} suffix={c.suffix} bodyClassName="space-y-4">
      <FocusHeading level={level} headingRef={headingRef}>
        {c.heading}
      </FocusHeading>
      <p className={NOTE}>{c.body}</p>
      {paused ? <p className="font-mono text-xs leading-relaxed text-foreground">{BRIDGE_COPY.role.pausedNote}</p> : null}
      <div>
        <RouteButtonLink to={PATHS.service("radio")} size="sm" arrow>
          {F.radioLink}
        </RouteButtonLink>
      </div>
    </Panel>
  )
}

// --------------------------------------------------------------------------------------- page

export default function BridgePage({ id }: ServiceViewProps) {
  const services = useDemo(selectServices)
  const radio = useDemo(selectRadioBoard)
  const transport = useDemo(selectTransport)
  const world = useWorld()
  const level = useHeadingLevel(1)
  const focusRef = useRef<HTMLHeadingElement>(null)

  const core = { radio, services, transport }
  const phase = bridgePhase(core, world)
  const step = radioStep(core)
  // The heading that takes the focus on a step change: the board's step, the radio-down note, the
  // preferred networks once ready, or (with no hotspot or ethernet) the facts.
  useStepFocus(`${phase}:${step ?? "-"}`, focusRef)

  const actions = phase === "needs-radio" ? <PlugRadioButton /> : phase === "ready" ? <RoleToggle /> : undefined

  return (
    <ServicePageFrame id={id} actions={actions}>
      {phase === "needs-radio" || phase === "radio-setup" ? <RadioStepsPanel board={radio} step={step} level={level} headingRef={focusRef} /> : null}
      {phase === "radio-down" ? <RadioDownPanel level={level} headingRef={focusRef} /> : null}
      {phase === "ready" ? (
        <>
          <NetworksPanel level={level} headingRef={focusRef} />
          <DiagramPanel />
        </>
      ) : null}
      <FactsPanel level={level} headingRef={phase === "needs-link" ? focusRef : undefined} />
    </ServicePageFrame>
  )
}
