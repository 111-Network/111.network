// The radio board's setup on the Bridge page (plan §6.4: the bridge needs a radio first). It runs the
// SAME core radio actions as the Devices view, so the board's life stays one story wherever it is
// advanced: core/radioAllowed (the one-time identify consent) -> core/radioFlash (only after the typed
// device-name confirm, ported from the real views/devices/flash.tsx ConfirmStep) -> core/radioRegionSet
// (the radio service STARTING -> LIVE). Every timed step is core's, through the scheduler; under
// reduced motion each action lands at its end state. The board's own page (device detail) is one link away.
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { BRIDGE_COPY } from "../../../copy/bridge"
import { RADIO_BOARD_ID, type RadioBoard } from "../../../engine/core"
import { useDispatch, useWorld } from "../../../engine/react"
import { PATHS } from "../../../engine/router"
import { RouteButtonLink } from "../../../shell/links"
import { Button } from "../../../ui/button"
import { FIELD_CLASS, FOCUS_RING, LABEL_CLASS } from "../../../ui/classes"
import type { HeadingLevel } from "../../../ui/heading"
import { Panel } from "../../../ui/panel"
import { SpecTable } from "../../../ui/spec-table"
import { FocusHeading } from "./focus-heading"
import { boardName, confirmMissing, EMPTY_CONFIRM, FLASH_CHECKS, missingText, stepBusy, stepStrip, type FlashConfirm, type RadioStep, type StripState } from "./model"

const C = BRIDGE_COPY.radio
const NOTE = "max-w-prose font-mono text-xs leading-relaxed text-muted-foreground"

/** Square, monochrome checkbox (real CHECKBOX): a filled inner square when ticked; 44 px row around it. */
const CHECKBOX = cn(
  "mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none border border-muted-foreground bg-background bg-clip-content p-[3px]",
  "checked:border-foreground checked:bg-foreground",
  FOCUS_RING,
)

const PIP: Readonly<Record<StripState, string>> = {
  done: "h-2 w-2 shrink-0 bg-foreground",
  now: "h-2 w-2 shrink-0 border border-foreground",
  next: "h-2 w-2 shrink-0 border border-dashed border-muted-foreground",
}

const STRIP_WORD: Readonly<Record<StripState, string>> = { done: C.stepDone, now: C.stepNow, next: C.stepNext }

/** "allow once · identify · write firmware · pick a region", each with its state as a CSS square and a word. */
function StepStrip({ step }: { step: RadioStep | null }) {
  return (
    <ol aria-label={C.stepsLabel} className="flex flex-wrap gap-x-4 gap-y-2">
      {stepStrip(step).map((s) => (
        <li
          key={s.label}
          aria-current={s.state === "now" ? "step" : undefined}
          className={cn("inline-flex items-center gap-2 font-mono text-[11px]", s.state === "next" ? "text-muted-foreground" : "text-foreground")}
        >
          <span aria-hidden="true" className={PIP[s.state]} />
          <span>{s.label}</span>
          <span className="sr-only">{`: ${STRIP_WORD[s.state]}`}</span>
        </li>
      ))}
    </ol>
  )
}

/** A step that waits on the node: a blinking block (a caused state, never idle) and what is happening. */
function Busy({ text }: { text: string }) {
  return (
    <p aria-busy="true" className={NOTE}>
      <span aria-hidden="true" className="me-2 animate-blink text-foreground">
        {"█"}
      </span>
      <span className="sr-only">{`${C.working}: `}</span>
      {text}
    </p>
  )
}

/** The checklist, the typed name, "Flash now" (real ConfirmStep). Mounted fresh each time it opens. */
function ConfirmForm({ name, onCancel }: { name: string; onCancel: () => void }) {
  const [c, setC] = useState<FlashConfirm>(EMPTY_CONFIRM)
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const firstBox = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const helpId = useId()
  const missingId = useId()

  useEffect(() => {
    firstBox.current?.focus()
  }, [])

  const missing = confirmMissing(c, name)
  const valid = missing.length === 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // The human gate: nothing is written unless both boxes are ticked and the name typed exactly.
    if (!valid) return
    dispatch({ type: "core/radioFlash", instant: reduced })
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
      aria-label={C.confirmLabel}
      className="flex flex-col gap-4 border-t border-border pt-4"
    >
      <fieldset className="flex flex-col">
        <legend className={cn(LABEL_CLASS, "mb-1")}>{C.before}</legend>
        {FLASH_CHECKS.map(({ id, label }, i) => (
          <label key={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 font-mono text-xs leading-relaxed text-foreground">
            <input
              ref={i === 0 ? firstBox : undefined}
              type="checkbox"
              checked={c.checks[id]}
              onChange={(e) => {
                const checked = e.target.checked
                setC((prev) => ({ ...prev, checks: { ...prev.checks, [id]: checked } }))
              }}
              className={CHECKBOX}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className={LABEL_CLASS}>
          {C.typeName}
        </label>
        <input
          id={nameId}
          value={c.typed}
          maxLength={200}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={helpId}
          onChange={(e) => {
            const typed = e.target.value
            setC((prev) => ({ ...prev, typed }))
          }}
          className={cn(FIELD_CLASS, "min-h-11")}
        />
        <p id={helpId} className={NOTE}>
          {C.typeHelp} <span className="break-words text-foreground">{name}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="destructive" aria-disabled={!valid || undefined} aria-describedby={missingId}>
            {C.flashNow}
          </Button>
          <Button onClick={onCancel}>{C.cancel}</Button>
        </div>
        <p id={missingId} className={NOTE}>
          {valid ? "" : missingText(missing)}
        </p>
      </div>
    </form>
  )
}

/** Identified, no usable firmware: what would be written, then the confirm (focus returns to the opener on Cancel). */
function OfferStep({ board }: { board: RadioBoard }) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLSpanElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (!open && wasOpen.current) opener.current?.querySelector("button")?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <div className="space-y-4">
      <SpecTable
        bare
        rows={[
          { label: C.detected, value: C.detectedValue },
          { label: C.source, value: C.sourceValue },
        ]}
      />
      <p className="font-mono text-xs leading-relaxed text-foreground">{C.erases}</p>
      {open ? (
        <ConfirmForm name={boardName(board)} onCancel={() => setOpen(false)} />
      ) : (
        <div className="space-y-2">
          <span ref={opener} className="inline-flex">
            <Button variant="destructive" onClick={() => setOpen(true)}>
              {C.flashOpen}
            </Button>
          </span>
          <p className={NOTE}>{C.flashOpenNote}</p>
        </div>
      )}
    </div>
  )
}

/** Flashed: the region, before the board may transmit. */
function RegionStep() {
  const world = useWorld()
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const [region, setRegion] = useState("")
  const selectId = useId()
  const noteId = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (region === "") return
    dispatch({ type: "core/radioRegionSet", region, instant: reduced })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={selectId} className={LABEL_CLASS}>
        {C.region}
      </label>
      <div className="relative max-w-sm">
        <select
          id={selectId}
          value={region}
          aria-describedby={noteId}
          onChange={(e) => setRegion(e.target.value)}
          className={cn(FIELD_CLASS, "min-h-11 appearance-none pe-8")}
        >
          <option value="">{C.regionPlaceholder}</option>
          {world.regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 flex items-center font-mono text-[10px] text-muted-foreground">
          {"▼"}
        </span>
      </div>
      <p id={noteId} className={NOTE}>
        {region === "" ? `${C.regionNote} ${C.regionMissing}` : C.regionNote}
      </p>
      <div>
        <Button type="submit" variant="primary" aria-disabled={region === "" || undefined}>
          {C.regionSet}
        </Button>
      </div>
    </form>
  )
}

export interface RadioStepsPanelProps {
  board: RadioBoard | null
  step: RadioStep | null
  level: HeadingLevel
  /** The step heading: the page moves the focus here when a step swaps the controls. */
  headingRef: Ref<HTMLHeadingElement>
}

/** The board's panel: the strip, the step's heading (focus target) and only that step's controls. */
export function RadioStepsPanel({ board, step, level, headingRef }: RadioStepsPanelProps) {
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const title = step === null ? C.heading : C.titles[step]

  return (
    <Panel title={C.title} suffix={C.suffix} bodyClassName="space-y-4">
      <StepStrip step={step} />
      <FocusHeading level={level} headingRef={headingRef}>
        {title}
      </FocusHeading>

      {step === null ? <p className={NOTE}>{C.none}</p> : null}

      {step === "plugged" ? (
        <div className="space-y-3">
          <SpecTable bare rows={[{ label: C.detected, value: C.detectedValue }]} />
          <p className={NOTE}>{C.allowNote}</p>
          <Button variant="primary" onClick={() => dispatch({ type: "core/radioAllowed", instant: reduced })}>
            {C.allow}
          </Button>
        </div>
      ) : null}

      {step !== null && stepBusy(step) ? <Busy text={C.busy[step]} /> : null}

      {step === "identified" && board ? <OfferStep board={board} /> : null}

      {step === "flashed" ? <RegionStep /> : null}

      {board && step !== null && step !== "starting" ? (
        <div className="border-t border-border pt-4">
          <RouteButtonLink to={PATHS.device(RADIO_BOARD_ID)} size="sm" arrow>
            {C.boardPage}
          </RouteButtonLink>
        </div>
      ) : null}
    </Panel>
  )
}
