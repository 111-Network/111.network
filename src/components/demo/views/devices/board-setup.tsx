// The radio board's setup panel on its own page (Layer 6; real views/devices/flash.tsx FlashPanelView,
// one `step` at a time, plus the consent and region steps the real node adds around it). Every step
// is a click away from the one before, and the two timed steps (identifying, writing firmware) run
// through core actions on the demo scheduler. The flash itself is human-confirmed only: two boxes and
// the board's name typed exactly as shown, checked again by the devices slice before core/radioFlash.
// Inline, never a modal; Escape cancels the confirmation.
import { useId, useState, type FormEvent, type ReactNode } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { DEVICES_COPY } from "../../copy/devices"
import type { RadioBoard } from "../../engine/core"
import { useDemo, useDispatch, useWorld } from "../../engine/react"
import { PATHS } from "../../engine/router"
import type { DemoState } from "../../engine/slices"
import { confirmMissing, EMPTY_CONFIRM, FLASH_CHECK_IDS, flashName, type DevicesState, type FlashConfirm } from "../../engine/slices/devices"
import { useHeadingLevel } from "../../shell/context"
import { RouteButtonLink, RouteLink } from "../../shell/links"
import { Button } from "../../ui/button"
import { FIELD_CLASS, FOCUS_RING, LABEL_CLASS } from "../../ui/classes"
import { Panel } from "../../ui/panel"
import { SpecTable } from "../../ui/spec-table"
import { StatusDot } from "../../ui/status-dot"
import { boardStep, missingText, type BoardStep } from "./model"
import { STEP_FOCUS, STEP_RETURN, useStepFocus } from "./use-step-focus"

const c = DEVICES_COPY
const TITLE = "font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none"
const NOTE = "max-w-prose font-mono text-[11px] leading-snug text-muted-foreground"
const TEXT = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

/** Square, monochrome box (real CHECKBOX): a filled inner square when ticked, a grey outline when not. */
const BOX = cn(
  "mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none border border-muted-foreground bg-background bg-clip-content p-[3px]",
  "checked:border-foreground checked:bg-foreground",
  FOCUS_RING,
)

/** One labelled choice row: 44 px tall at every width. */
const CHOICE = "flex min-h-11 cursor-pointer items-start gap-3 py-2 font-mono text-xs leading-relaxed text-foreground"

const selectRadioService = (s: DemoState) => s.core.services.find((x) => x.id === "radio")

// ---------------------------------------------------------------------------- consent (also on the list)

export interface ConsentProps {
  name: string
  onAllow: () => void
  onNotNow: () => void
}

/** "Allow once?": the one-time identify consent. Nothing talks to the board before it. */
export function ConsentStep({ name, onAllow, onNotNow }: ConsentProps) {
  return (
    <div className="flex flex-col gap-3">
      <p tabIndex={-1} {...STEP_FOCUS} className={TITLE}>
        {c.consent.question}
      </p>
      <p className={TEXT}>{c.consent.body(name)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" arrow={false} onClick={onAllow}>
          {c.consent.allow}
        </Button>
        <Button onClick={onNotNow}>{c.consent.notNow}</Button>
      </div>
    </div>
  )
}

export function DeclinedStep({ onAskAgain }: { onAskAgain: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p tabIndex={-1} {...STEP_FOCUS} className={TITLE}>
        {c.consent.declinedTitle}
      </p>
      <p className={TEXT}>{c.consent.declinedBody}</p>
      <div>
        <Button size="sm" onClick={onAskAgain}>
          {c.consent.askAgain}
        </Button>
      </div>
    </div>
  )
}

export function IdentifyingStep() {
  return (
    <div className="flex flex-col gap-2">
      <p tabIndex={-1} {...STEP_FOCUS} className={TITLE}>
        {c.consent.identifyingTitle}
        <span aria-hidden="true" className="ms-1 animate-blink">
          {"█"}
        </span>
      </p>
      <p className={TEXT}>{c.consent.identifyingBody}</p>
    </div>
  )
}

// ------------------------------------------------------------------------------- the firmware offer

/** What the board is, what would be written and what is erased. `lead`: its title leads the step (the offer; not the confirmation). */
function OfferFacts({ name, lead }: { name: string; lead: boolean }) {
  const f = c.flash
  return (
    <>
      <div className="flex flex-col gap-2">
        <p tabIndex={-1} {...(lead ? STEP_FOCUS : {})} className={TITLE}>
          {f.noFirmware}
        </p>
        <p className={TEXT}>
          <span className="text-foreground">{f.board(name)}</span> {f.why}
        </p>
      </div>
      <SpecTable
        title={f.tableTitle}
        rows={[
          { label: f.rows.firmware, value: f.firmware },
          { label: f.rows.builtFor, value: f.builtFor },
          { label: f.rows.source, value: f.source },
        ]}
      />
      <div className="border-2 border-foreground">
        <p className="bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-background">{f.erasesTag}</p>
        <p className="p-3 font-mono text-sm leading-relaxed text-foreground">{f.erases}</p>
      </div>
    </>
  )
}

// ------------------------------------------------------------------------------------ confirmation

interface ConfirmStepProps {
  /** The name to type: what the page shows as the board's name. */
  name: string
  onFlash: (confirm: FlashConfirm) => void
  onCancel: () => void
}

/** The checklist, the typed name, "Flash now" (real ConfirmStep). Its drafts reset whenever it opens. */
function ConfirmStep({ name, onFlash, onCancel }: ConfirmStepProps) {
  const [draft, setDraft] = useState<FlashConfirm>(EMPTY_CONFIRM)
  const nameId = useId()
  const helpId = useId()
  const missingId = useId()
  const f = c.flash
  const missing = confirmMissing(draft, name)
  const valid = missing.length === 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid) onFlash(draft)
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onCancel()
        }
      }}
      aria-label={f.confirmLabel}
      className="flex flex-col gap-4 border-t border-border pt-4"
    >
      <fieldset className="flex flex-col">
        <legend className={cn(LABEL_CLASS, "mb-1")}>{f.before}</legend>
        {FLASH_CHECK_IDS.map((id, i) => (
          <label key={id} className={CHOICE}>
            <input
              {...(i === 0 ? STEP_FOCUS : {})}
              type="checkbox"
              checked={draft.checks[id]}
              onChange={(e) => {
                const on = e.target.checked
                setDraft((prev) => ({ ...prev, checks: { ...prev.checks, [id]: on } }))
              }}
              className={BOX}
            />
            <span>{f.checks[id]}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className={LABEL_CLASS}>
          {f.typeLabel}
        </label>
        <input
          id={nameId}
          value={draft.typed}
          maxLength={200}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={helpId}
          onChange={(e) => {
            const typed = e.target.value
            setDraft((prev) => ({ ...prev, typed }))
          }}
          className={FIELD_CLASS}
        />
        <p id={helpId} className={NOTE}>
          {f.typeHelp} <span className="break-words text-foreground">{name}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="destructive" aria-disabled={!valid || undefined} aria-describedby={missingId}>
            {f.now}
          </Button>
          <Button onClick={onCancel}>{f.cancel}</Button>
        </div>
        <p id={missingId} className={NOTE}>
          {valid ? "" : missingText(missing)}
        </p>
      </div>
    </form>
  )
}

// -------------------------------------------------------------------------------------- the region

function RegionStep({ regions, onSet }: { regions: readonly string[]; onSet: (region: string) => void }) {
  const [region, setRegion] = useState<string | null>(null)
  const group = useId()
  const missingId = useId()
  const r = c.region

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (region !== null) onSet(region)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p tabIndex={-1} {...STEP_FOCUS} className={TITLE}>
          {c.flash.doneTitle}
        </p>
        <p className={TEXT}>{c.flash.doneBody}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 border-t border-border pt-4">
        <fieldset className="flex flex-col">
          <legend className={cn(LABEL_CLASS, "mb-1")}>{r.legend}</legend>
          <p className={cn(TEXT, "mb-1")}>{r.body}</p>
          <div className="grid grid-cols-1 gap-x-6 @min-[640px]:grid-cols-2">
            {regions.map((name) => (
              <label key={name} className={CHOICE}>
                <input type="radio" name={group} value={name} checked={region === name} onChange={() => setRegion(name)} className={BOX} />
                <span>{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <div>
            <Button type="submit" variant="primary" aria-disabled={region === null || undefined} aria-describedby={missingId}>
              {r.set}
            </Button>
          </div>
          <p id={missingId} className={NOTE}>
            {region === null ? r.missing : ""}
          </p>
        </div>
      </form>
    </div>
  )
}

function ReadyStep({ region }: { region: string | null }) {
  const service = useDemo(selectRadioService)
  const rd = c.ready
  return (
    <div className="flex flex-col gap-3">
      <p tabIndex={-1} {...STEP_FOCUS} className={TITLE}>
        {rd.title}
      </p>
      {service ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
            <RouteLink to={PATHS.service(service.id)} className="inline-flex min-h-11 items-center">
              {service.name}
            </RouteLink>
            <StatusDot state={service.state} />
          </div>
          <p className={TEXT}>{service.reason}</p>
        </div>
      ) : null}
      {region ? <p className={TEXT}>{rd.region(region)}</p> : null}
      <div className="flex flex-col gap-2">
        <div>
          <RouteButtonLink to={PATHS.nearby} size="sm">
            {rd.nearby}
          </RouteButtonLink>
        </div>
        <p className={NOTE}>{rd.nearbyNote}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------- the panel

export interface BoardSetupProps {
  radio: RadioBoard
  ui: Pick<DevicesState, "consentDeclined" | "flashOpen">
  /** The hand-off beside "Flash firmware…": the agent, instead of flashing. */
  agent?: ReactNode
}

const STEP_SUFFIX: Readonly<Record<BoardStep, string>> = {
  consent: c.consent.suffix,
  declined: c.consent.suffix,
  identifying: c.consent.panel,
  offer: c.flash.suffix,
  confirm: c.flash.suffix,
  flashing: c.flash.suffix,
  region: c.region.panel,
  ready: c.ready.suffix,
}

/** One step at a time; each swap moves focus to the new step's lead (Cancel returns it to "Flash firmware…"). */
export function BoardSetup({ radio, ui, agent }: BoardSetupProps) {
  const dispatch = useDispatch()
  const world = useWorld()
  const reduced = useReducedMotion()
  const level = useHeadingLevel(1)
  const step = boardStep(radio.stage, ui)
  const ref = useStepFocus<HTMLDivElement>(step, { returnFrom: ["confirm"] })
  const name = flashName(radio)

  let body: ReactNode
  switch (step) {
    case "consent":
      body = (
        <ConsentStep
          name={name}
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
    case "offer":
    case "confirm":
      body = (
        <>
          <OfferFacts name={name} lead={step === "offer"} />
          {step === "offer" ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-3">
                <Button {...STEP_RETURN} variant="primary" onClick={() => dispatch({ type: "devices/openFlash" })}>
                  {c.flash.open}
                </Button>
                {agent}
              </div>
              <p className={NOTE}>{c.flash.openNote}</p>
            </div>
          ) : (
            <ConfirmStep
              name={name}
              onFlash={(confirm) => dispatch({ type: "devices/flash", confirm, instant: reduced })}
              onCancel={() => dispatch({ type: "devices/closeFlash" })}
            />
          )}
        </>
      )
      break
    case "flashing":
      body = (
        <div className="flex flex-col gap-2">
          <p tabIndex={-1} {...STEP_FOCUS} className={TITLE}>
            {c.flash.startedTitle}
            <span aria-hidden="true" className="ms-1 animate-blink">
              {"█"}
            </span>
          </p>
          <p className={NOTE}>{c.flash.startedBody}</p>
        </div>
      )
      break
    case "region":
      body = <RegionStep regions={world.regions} onSet={(region) => dispatch({ type: "core/radioRegionSet", region, instant: reduced })} />
      break
    case "ready":
      body = <ReadyStep region={radio.region} />
      break
  }

  return (
    <Panel
      as="section"
      title={c.flash.panel}
      suffix={STEP_SUFFIX[step]}
      heading={level === 1 ? 2 : level}
      tint
      bodyClassName="flex flex-col gap-4"
    >
      <div ref={ref} className="flex flex-col gap-4">
        {body}
      </div>
    </Panel>
  )
}
