// Add device (#/devices/add; real views/devices/add.tsx, spec 6.3): one card per kind of thing that can
// be attached, in plain words. The radio card carries the contextual "[DEMO] plug in a radio board";
// the rest hand off to the agent. No pair codes, no addresses, no lockouts (plan §6.8).
import type { ReactNode } from "react"
import { DEMO_ACTIONS } from "../../copy/core"
import { DEVICES_COPY } from "../../copy/devices"
import { useDemo, useDispatch } from "../../engine/react"
import { PATHS } from "../../engine/router"
import type { DemoState } from "../../engine/slices"
import { useHeadingLevel } from "../../shell/context"
import { RouteButtonLink } from "../../shell/links"
import { DemoButton } from "../../ui/demo-button"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { SectionHeader } from "../../ui/section-header"
import { AgentButton } from "./agent-button"
import { STEP_FOCUS, useStepFocus } from "./use-step-focus"

const a = DEVICES_COPY.add
const P = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

const selectHasRadio = (s: DemoState): boolean => s.core.radio !== null

function Role({ title, level, children }: { title: string; level: ReturnType<typeof useHeadingLevel>; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <Heading level={level} className="font-mono text-sm text-foreground">
        {title}
      </Heading>
      {children}
    </section>
  )
}

function RadioCard() {
  const plugged = useDemo(selectHasRadio)
  const dispatch = useDispatch()
  const level = useHeadingLevel(1)
  // The [DEMO] button goes away with the click: focus moves to the line that replaces it.
  const ref = useStepFocus<HTMLDivElement>(plugged ? "plugged" : "empty")
  const r = a.radio
  return (
    <Panel as="section" title={r.title} heading={level === 1 ? 2 : level} className="flex flex-col" bodyClassName="flex flex-1 flex-col gap-4">
      <p className={P}>{r.body}</p>
      <div ref={ref} className="flex flex-col gap-3">
        {plugged ? (
          <>
            <p tabIndex={-1} {...STEP_FOCUS} className="font-mono text-xs text-foreground focus-visible:outline-none">
              {r.plugged}
            </p>
            <div>
              <RouteButtonLink to={PATHS.devices} size="sm">
                {r.open}
              </RouteButtonLink>
            </div>
          </>
        ) : (
          <div>
            <DemoButton onClick={() => dispatch({ type: "core/radioPlugged" })}>{DEMO_ACTIONS.plugRadio}</DemoButton>
          </div>
        )}
      </div>
      <AgentButton label={a.guide} from={r.from} variant="default" prompt={r.prompt} />
    </Panel>
  )
}

export function AddDevice() {
  const level = useHeadingLevel()
  const section = useHeadingLevel(1)
  const sub = useHeadingLevel(2)
  const panelHeading = section === 1 ? 2 : section

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        kicker={a.kicker}
        title={a.title}
        level={level}
        end={
          <RouteButtonLink to={PATHS.devices} size="sm">
            {DEVICES_COPY.detail.back}
          </RouteButtonLink>
        }
      />
      <p className={P}>{a.intro}</p>

      <div className="grid grid-cols-1 gap-4 @min-[768px]:grid-cols-2">
        <RadioCard />

        <Panel as="section" title={a.bluetooth.title} heading={panelHeading} className="flex flex-col" bodyClassName="flex flex-1 flex-col gap-4">
          <p className={P}>{a.bluetooth.body}</p>
          <AgentButton label={a.guide} from={a.bluetooth.from} variant="default" prompt={a.bluetooth.prompt} />
        </Panel>

        <Panel as="section" title={a.phone.title} heading={panelHeading} className="@min-[768px]:col-span-2" bodyClassName="divide-y divide-border">
          <Role title={a.phone.control.title} level={sub}>
            <p className={P}>{a.phone.control.body}</p>
          </Role>
          <Role title={a.phone.node.title} level={sub}>
            <p className={P}>{a.phone.node.body}</p>
            <AgentButton label={a.phone.node.ask} from={a.phone.node.from} variant="default" prompt={a.phone.node.prompt} />
          </Role>
          <Role title={a.phone.through.title} level={sub}>
            <p className={P}>{a.phone.through.body}</p>
          </Role>
        </Panel>

        <Panel as="section" title={a.handheld.title} heading={panelHeading} className="@min-[768px]:col-span-2">
          <p className={P}>{a.handheld.body}</p>
        </Panel>
      </div>
    </div>
  )
}
