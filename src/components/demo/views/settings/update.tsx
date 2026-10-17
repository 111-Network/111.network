// The update check (real essentials.tsx UpdateRow, plus the trial of lib/api/mock/scenarios.ts
// `updating`): "[DEMO] check for updates" -> checking -> downloaded and verified -> on trial ->
// healthy, or the rollback branch with "[DEMO] fail the next trial". Every step is a scheduled
// slice action (engine/slices/settings.ts); under reduced motion the end state lands at once.
// Used in two places: the Essentials row (compact) and Install & updates · L1 (every step).
import { useMemo } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { DEMO_ACTIONS } from "../../copy/core"
import { SETTINGS_COPY } from "../../copy/settings"
import type { DemoState } from "../../engine/slices"
import type { UpdateState } from "../../engine/slices/settings"
import { updateBusy } from "../../engine/slices/settings"
import { useDemo, useDispatch } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { useAnnounce } from "../../shell/context"
import { RouteLink } from "../../shell/links"
import { DemoButton } from "../../ui/demo-button"
import { DemoNote } from "../../ui/demo-note"
import { DemoTag } from "../../ui/demo-tag"
import { MiniTerminal } from "../../ui/mini-terminal"
import { SpecTable } from "../../ui/spec-table"
import { Toggle } from "../../ui/toggle"
import { toSpecRows } from "./facts"
import { showsFailSwitch, updateArrived, updateLogLines, updateRows, updateSentence, updateSteps, type StepState } from "./model"
import { Feedback, FEEDBACK } from "./row"

const C = SETTINGS_COPY.update

const selectUpdate = (s: DemoState): UpdateState => s.settings.update
const selectRestarting = (s: DemoState): boolean => s.settings.restart.phase === "restarting"

/** The "[DEMO] check for updates" button and its one feedback line. */
export function UpdateButton() {
  const u = useDemo(selectUpdate)
  const restarting = useDemo(selectRestarting)
  const dispatch = useDispatch()
  const announce = useAnnounce()
  const reduced = useReducedMotion()
  const busy = updateBusy(u)

  const check = () => {
    dispatch({ type: "settings/updateCheck", instant: reduced })
    // Under reduced motion the result event lands in the same dispatch and says it all.
    if (!reduced) announce(C.started)
  }

  return (
    <div>
      <DemoButton loading={busy} aria-disabled={restarting || undefined} onClick={check}>
        {DEMO_ACTIONS.updates}
      </DemoButton>
      <Feedback text={restarting ? C.busyRestart : null} />
    </div>
  )
}

/** Essentials: the button, the update fields and a link to every step. */
export function UpdateSummary() {
  const u = useDemo(selectUpdate)
  return (
    <div className="flex flex-col gap-3">
      <UpdateButton />
      <SpecTable rows={toSpecRows(updateRows(u))} />
      <p className={cn("flex min-h-11 items-center @min-[1024px]:min-h-0", FEEDBACK)}>
        <RouteLink to={PATHS.settingsLayer(1)}>{C.more}</RouteLink>
      </p>
    </div>
  )
}

const MARK: Record<StepState, string> = {
  done: "bg-foreground",
  current: "border border-foreground animate-blink",
  pending: "border border-muted-foreground",
  skipped: "border border-dashed border-muted-foreground",
  failed: "bg-destructive",
}

/** The four steps of the last (or running) check, each with its state in words. */
function UpdateSteps({ u }: { u: UpdateState }) {
  const steps = updateSteps(u)
  return (
    <ol aria-label={C.stepsLabel} className="grid grid-cols-2 gap-px border border-border bg-border @min-[640px]:grid-cols-4">
      {steps.map((step, i) => (
        <li
          key={step.id}
          aria-current={step.state === "current" ? "step" : undefined}
          className={cn("flex flex-col gap-1 bg-background p-3 font-mono text-xs", step.state === "current" ? "text-foreground" : "text-muted-foreground")}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0", MARK[step.state])} />
            <span className="text-[10px] uppercase tracking-widest">
              {i + 1}. {step.label}
            </span>
          </span>
          <span className={cn(step.state === "failed" && "text-destructive", step.state === "done" && "text-foreground")}>{step.word}</span>
        </li>
      ))}
    </ol>
  )
}

/** The demo switch that makes the next trial fail. Always rendered (never pulled from under focus). */
function FailSwitch({ u }: { u: UpdateState }) {
  const dispatch = useDispatch()
  const applies = showsFailSwitch(u)
  return (
    <div>
      <Toggle
        pressed={u.failNext}
        busy={!applies || u.phase === "reverting"}
        onPressedChange={(fail) => dispatch({ type: "settings/failNext", fail })}
        className="inline-flex items-center gap-2 text-xs"
      >
        <DemoTag />
        <span>{C.fail}</span>
        <span aria-hidden="true">{u.failNext ? SETTINGS_COPY.sharing.lan.on : SETTINGS_COPY.sharing.lan.off}</span>
      </Toggle>
      <Feedback text={applies ? C.failHelp : C.failNone} />
    </div>
  )
}

/** Install & updates · L1: the button, the fail switch, the steps, the sentence and the log (the fields are in the status panel). */
export function UpdatePanelBody() {
  const u = useDemo(selectUpdate)
  const lines = useMemo(() => updateLogLines(u), [u])
  return (
    <div className="flex flex-col gap-4">
      <p className={cn("max-w-prose text-muted-foreground", FEEDBACK)}>{C.help}</p>
      <div className="flex flex-col gap-3 @min-[640px]:flex-row @min-[640px]:items-start">
        <UpdateButton />
        <FailSwitch u={u} />
      </div>
      <UpdateSteps u={u} />
      <p className={cn("flex flex-wrap items-center gap-2 text-foreground", FEEDBACK)}>
        <span>{updateSentence(u)}</span>
        {updateArrived(u) ? <DemoNote /> : null}
      </p>
      <MiniTerminal title={C.logTitle} lines={lines} follow emptyText={C.logEmpty} maxHeightClass="max-h-48" />
    </div>
  )
}
