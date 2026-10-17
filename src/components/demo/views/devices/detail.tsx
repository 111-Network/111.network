// Device detail (#/devices/<id>; real views/devices/detail.tsx, spec 6.3): the name, state and reason,
// the board's setup panel (consent, identify, the firmware offer and its typed confirmation, the
// region), inline rename, the hand-off to the agent and the facts. In plain words: the board is "a
// long-range radio board", with no product or chip names, no ids, no ports and no versions.
import { useId, useState, type FormEvent } from "react"
import { DEVICES_COPY } from "../../copy/devices"
import { agoText, formatClock } from "../../engine/clock"
import { RADIO_BOARD_ID } from "../../engine/core"
import { useDemo, useDispatch, useNavigate } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { selectDevices } from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import { useAnnounce, useHeadingLevel } from "../../shell/context"
import { RouteButtonLink, RouteLink } from "../../shell/links"
import { kbRouteOf } from "../../shell/service-page"
import { selectMode, selectNow } from "../../shell/select"
import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"
import { FIELD_CLASS, LABEL_CLASS } from "../../ui/classes"
import { DemoButton } from "../../ui/demo-button"
import { Empty } from "../../ui/empty"
import { SectionHeader } from "../../ui/section-header"
import { SpecTable, type SpecRow } from "../../ui/spec-table"
import { StatusDot } from "../../ui/status-dot"
import { AgentButton } from "./agent-button"
import { BoardSetup } from "./board-setup"
import { aliasFromDraft, confidenceText, deviceAgentAction, drivenByText, firmwareText, isLikely, presenceText, showsRegion } from "./model"

const d = DEVICES_COPY.detail
const NOTE = "max-w-prose font-mono text-[11px] leading-snug text-muted-foreground"

const selectRadio = (s: DemoState) => s.core.radio
const selectUi = (s: DemoState) => s.devices
const selectRadioService = (s: DemoState) => s.core.services.find((x) => x.id === "radio")

function Back() {
  return (
    <div>
      <RouteButtonLink to={PATHS.devices} size="sm">
        {d.back}
      </RouteButtonLink>
    </div>
  )
}

function RenameForm({ detected, alias }: { detected: string; alias: string | null }) {
  const dispatch = useDispatch()
  const shown = alias ?? detected
  const [draft, setDraft] = useState(shown)
  const [synced, setSynced] = useState(shown)
  const [done, setDone] = useState(false)
  const fieldId = useId()
  const helpId = useId()
  const r = DEVICES_COPY.rename

  // Follow a rename from elsewhere (the agent, another view) unless the person is typing: adjusted
  // during render (React's "state from props" pattern), never synced in an effect.
  if (synced !== shown) {
    setSynced(shown)
    if (draft === synced) setDraft(shown)
  }

  const dirty = draft.trim() !== shown.trim()

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!dirty) return
    const next = aliasFromDraft(draft, detected)
    dispatch({ type: "core/radioRenamed", alias: next })
    setDraft(next ?? detected)
    setDone(true)
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label htmlFor={fieldId} className={LABEL_CLASS}>
        {r.label}
      </label>
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          id={fieldId}
          value={draft}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={helpId}
          onChange={(e) => {
            setDraft(e.target.value)
            setDone(false)
          }}
          className={`${FIELD_CLASS} min-w-0 flex-1 basis-56`}
        />
        <Button type="submit" aria-disabled={!dirty || undefined}>
          {r.save}
        </Button>
      </div>
      <p id={helpId} className={NOTE}>
        {r.help(detected)}
      </p>
      {/* Stays in the page so a screen reader hears the text arrive (one polite line). */}
      <p role="status" className={done ? "font-mono text-xs text-muted-foreground" : "sr-only"}>
        {done ? r.done : ""}
      </p>
    </form>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col gap-6">
      <Back />
      <Empty
        kicker={d.notFound.kicker}
        title={d.notFound.title}
        action={
          <RouteButtonLink to={PATHS.devices} size="sm">
            {d.notFound.action}
          </RouteButtonLink>
        }
      >
        {d.notFound.body}
      </Empty>
    </div>
  )
}

export function DeviceDetail({ id }: { id: string }) {
  const devices = useDemo(selectDevices)
  const radio = useDemo(selectRadio)
  const ui = useDemo(selectUi)
  const service = useDemo(selectRadioService)
  const now = useDemo(selectNow)
  const mode = useDemo(selectMode)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const level = useHeadingLevel()

  const device = devices.find((x) => x.id === id)
  if (!device || !radio || id !== RADIO_BOARD_ID) return <NotFound />

  const name = device.name
  const action = deviceAgentAction(device.state, name)
  const recipe = kbRouteOf(service?.kb ?? null)
  const stage = radio.stage
  const offer = stage === "identified"

  const rows: SpecRow[] = [
    { label: d.rows.detected, value: radio.name },
    { label: d.rows.confidence, value: confidenceText(stage) },
  ]
  if (!isLikely(stage)) rows.push({ label: d.rows.identifiedAs, value: d.identifiedAs })
  rows.push({ label: d.rows.firmware, value: firmwareText(stage) })
  rows.push({ label: d.rows.driven, value: drivenByText(stage) })
  if (service) {
    rows.push({
      label: d.rows.service,
      value: (
        <RouteLink to={PATHS.service(service.id)} className="inline-flex min-h-11 items-center">
          {service.name}
        </RouteLink>
      ),
    })
  }
  rows.push({ label: d.rows.transport, value: d.transport })
  if (showsRegion(stage)) rows.push({ label: d.rows.region, value: radio.region ?? d.regionUnset })
  rows.push({ label: d.rows.consent, value: ui.consentAt !== null ? d.consentGiven(formatClock(ui.consentAt)) : d.consentNone })
  if (recipe) {
    rows.push({
      label: d.rows.kb,
      value: (
        <RouteButtonLink to={recipe} size="sm">
          {d.kbOpen}
        </RouteButtonLink>
      ),
    })
  }
  const firstSeen = ui.pluggedAt ?? radio.since
  rows.push({ label: d.rows.firstSeen, value: d.firstSeen(formatClock(firstSeen), agoText(firstSeen, now)) })

  // Leave first: the page has nothing to show once the board is gone (real Forget).
  const unplug = () => {
    navigate(PATHS.devices)
    dispatch({ type: "core/radioRemoved" })
    announce(d.unplugged)
  }

  return (
    <div className="flex flex-col gap-6">
      <Back />

      <SectionHeader kicker={d.kicker} title={name} level={level} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusDot state={device.dot} />
        <Badge>{device.kind}</Badge>
        <Badge>{device.stateLabel}</Badge>
        {isLikely(stage) ? <Badge>{d.likely}</Badge> : null}
        <span className="font-mono text-xs text-muted-foreground">{presenceText(firstSeen, now)}</span>
      </div>

      <p className="max-w-prose font-mono text-sm leading-relaxed text-foreground">{device.reason}</p>

      <BoardSetup
        radio={radio}
        ui={ui}
        agent={<AgentButton variant="default" label={DEVICES_COPY.flash.askInstead} from={name} prompt={action.prompt} recipe={recipe} />}
      />

      <RenameForm key={ui.boardSeq} detected={radio.name} alias={radio.alias} />

      <div className="flex flex-col gap-2">
        <AgentButton variant={offer ? "default" : "primary"} label={action.label} from={name} prompt={action.prompt} recipe={recipe} />
        <p className={NOTE}>{d.agentNote}</p>
      </div>

      <SpecTable rows={rows} mode={mode} title={d.specTitle} />

      <div className="border-t border-border pt-4">
        <DemoButton variant="destructive" confirm={d.unplugConfirm(name)} onClick={unplug}>
          {d.unplug}
        </DemoButton>
      </div>
    </div>
  )
}
