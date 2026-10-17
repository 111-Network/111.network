// Devices list (#/devices; real views/devices/list.tsx, spec 6.3): this laptop first (the node itself),
// then everything attached to it, grouped by kind. Before "[DEMO] plug in a radio board" the honest
// empty state; after it the board appears with its state and reason, and the one-time identify
// consent ("Allow once?") shows right below, where the click was. Devices are read only through the
// engine selectors (selectDevices, devicesSummary); this view adds the consent prompt.
import type { ReactNode } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { DEMO_ACTIONS } from "../../copy/core"
import { DEVICES_COPY } from "../../copy/devices"
import { DemoLink, useDemo, useDispatch } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { devicesSummary, selectDevices, type DemoDevice } from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import { flashName } from "../../engine/slices/devices"
import { useHeadingLevel } from "../../shell/context"
import { RouteButtonLink } from "../../shell/links"
import { Badge } from "../../ui/badge"
import { FOCUS_RING_INSET, LABEL_CLASS } from "../../ui/classes"
import { DemoButton } from "../../ui/demo-button"
import { Empty } from "../../ui/empty"
import { Panel } from "../../ui/panel"
import { SectionHeader } from "../../ui/section-header"
import { StatusDot } from "../../ui/status-dot"
import { AgentButton } from "./agent-button"
import { ConsentStep, DeclinedStep, IdentifyingStep } from "./board-setup"
import { ADD_DEVICE_PATH, isLikely, listPrompt, needsFirmware, drivenByText } from "./model"
import { NeedsFirmwareTag } from "./needs-firmware"
import { OwnDevicePanel } from "./own-device"
import { STEP_FOCUS, useStepFocus } from "./use-step-focus"

const c = DEVICES_COPY.list
const TEXT = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

const selectRadio = (s: DemoState) => s.core.radio
const selectDeclined = (s: DemoState): boolean => s.devices.consentDeclined

/**
 * Every cell of a row links to the device page, so the whole row is a target. Only the first link is
 * in the tab order and the accessibility tree; the others are pointer conveniences (real RowLink).
 */
function RowLink({ d, first, children }: { d: DemoDevice; first?: boolean; children: ReactNode }) {
  return (
    <DemoLink
      to={d.href}
      tabIndex={first ? undefined : -1}
      aria-hidden={first ? undefined : true}
      className={`-mx-4 -my-2.5 flex min-h-11 flex-col justify-center px-4 py-2.5 hover:text-foreground ${FOCUS_RING_INSET}`}
    >
      {children}
    </DemoLink>
  )
}

/** Below a 640 px container the three side columns fold into a line of the name cell (real WIDE_QUERY, as a container query). */
const WIDE_ONLY = "@max-[640px]:hidden"
const NARROW_ONLY = "@min-[640px]:hidden"

function DeviceTable({ devices }: { devices: readonly DemoDevice[] }) {
  const th = `px-4 py-2 text-start font-normal ${LABEL_CLASS}`
  const td = "px-4 py-2.5 align-top"
  return (
    <table className="w-full border-collapse font-mono text-xs">
      <caption className="sr-only">{c.group}</caption>
      <thead className="border-b border-border">
        <tr>
          <th scope="col" className={th}>
            {c.columns.device}
          </th>
          <th scope="col" className={`${th} ${WIDE_ONLY}`}>
            {c.columns.kind}
          </th>
          <th scope="col" className={`${th} ${WIDE_ONLY}`}>
            {c.columns.driver}
          </th>
          <th scope="col" className={`${th} ${WIDE_ONLY}`}>
            {c.columns.seen}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {devices.map((d) => (
          <tr key={d.id} className="transition-colors duration-200 hover:bg-secondary/50">
            <td className={td}>
              <RowLink d={d} first>
                <span className="flex flex-wrap items-center gap-2 text-foreground">
                  <StatusDot state={d.dot} label={false} name={d.name} />
                  <span className="min-w-0 break-words">{d.name}</span>
                  {isLikely(d.stage) ? <Badge className="shrink-0">{DEVICES_COPY.detail.likely}</Badge> : null}
                  {needsFirmware(d.stage) ? <NeedsFirmwareTag /> : null}
                </span>
                <span className="ps-4 text-[11px] leading-snug text-muted-foreground">
                  {d.stateLabel}
                  {d.state === "needs setup" || d.state === "error" ? ` · ${d.reason}` : ""}
                </span>
                <span className={`ps-4 text-[11px] leading-snug text-muted-foreground ${NARROW_ONLY}`}>
                  {c.folded(d.kind, drivenByText(d.stage), c.seenNow)}
                </span>
              </RowLink>
            </td>
            <td className={`${td} text-muted-foreground ${WIDE_ONLY}`}>
              <RowLink d={d}>
                <span className="whitespace-nowrap">{d.kind}</span>
              </RowLink>
            </td>
            <td className={`${td} text-muted-foreground ${WIDE_ONLY}`}>
              <RowLink d={d}>
                <span className="whitespace-nowrap">{drivenByText(d.stage)}</span>
              </RowLink>
            </td>
            <td className={`${td} text-muted-foreground ${WIDE_ONLY}`}>
              <RowLink d={d}>
                <span className="whitespace-nowrap">{c.seenNow}</span>
              </RowLink>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The board's prompt below the table: the consent where the click was, then a pointer to its page. */
function BoardPrompt() {
  const radio = useDemo(selectRadio)
  const declined = useDemo(selectDeclined)
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const prompt = listPrompt(radio?.stage ?? null, declined)
  // It appears because of the [DEMO] click (that button is gone), so it takes focus on mount too.
  const ref = useStepFocus<HTMLDivElement>(prompt, { onMount: true })
  if (radio === null || prompt === "none") return null
  const s = DEVICES_COPY.consent
  const page = PATHS.device(radio.id)

  let body: ReactNode
  switch (prompt) {
    case "consent":
      body = (
        <ConsentStep
          name={flashName(radio)}
          onAllow={() => dispatch({ type: "core/radioAllowed", instant: reduced })}
          onNotNow={() => dispatch({ type: "devices/notNow" })}
        />
      )
      break
    case "declined":
      body = <DeclinedStep onAskAgain={() => dispatch({ type: "devices/askAgain" })} />
      break
    case "identifying":
      body = <IdentifyingStep />
      break
    case "identified":
      body = (
        <div className="flex flex-col gap-3">
          <p tabIndex={-1} {...STEP_FOCUS} className="font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none">
            {s.identifiedTitle}
          </p>
          <p className={TEXT}>{s.identifiedBody}</p>
          <div>
            <RouteButtonLink to={page} variant="primary">
              {s.offerLink}
            </RouteButtonLink>
          </div>
        </div>
      )
      break
  }

  return (
    <Panel as="section" title={c.promptPanel} suffix={prompt === "identified" ? DEVICES_COPY.flash.suffix : s.suffix} tint>
      <div ref={ref} className="flex flex-col gap-4">
        {body}
        {prompt !== "identified" ? (
          <div>
            <RouteButtonLink to={page} size="sm">
              {s.openPage}
            </RouteButtonLink>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

export function DeviceList() {
  const devices = useDemo(selectDevices)
  const sum = useDemo(devicesSummary)
  const dispatch = useDispatch()
  const level = useHeadingLevel()
  const addLink = (
    <RouteButtonLink to={ADD_DEVICE_PATH} size="sm">
      {c.add}
    </RouteButtonLink>
  )

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader kicker={c.kicker} title={c.title} level={level} end={addLink} />

      <OwnDevicePanel />

      <div className="flex flex-col gap-3">
        {sum.total > 0 ? <p className="font-mono text-sm text-foreground">{sum.text}</p> : null}
        <p className={TEXT}>{c.intro}</p>
        <AgentButton label={c.connect} from={c.connectFrom} prompt={c.connectPrompt} />
      </div>

      {devices.length === 0 ? (
        <Empty
          title={c.emptyTitle}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <DemoButton onClick={() => dispatch({ type: "core/radioPlugged" })}>{DEMO_ACTIONS.plugRadio}</DemoButton>
              <RouteButtonLink to={ADD_DEVICE_PATH} size="sm">
                {c.add}
              </RouteButtonLink>
            </div>
          }
        >
          {c.emptyBody}
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <Panel title={c.group} flush>
            <DeviceTable devices={devices} />
          </Panel>
          <BoardPrompt />
        </div>
      )}
    </div>
  )
}
