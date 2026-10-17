// The repair in progress, shown as a pull request (plan §5 L9 bench, §6.4): the agent's steps, the
// change in plain words, the sandbox checks and the person's choices (real views/agent/proposals.tsx
// card: Accept / Dismiss with the two-step confirm; Accept lives on the gate rail as APPROVE ON THIS
// NODE). The run is agent output, so it carries the "demo reply" note. Every step comes from the
// repairs slice through the scheduler; nothing here keeps a timer.
import { useRef } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { REPAIRS_COPY } from "../../../copy/repairs"
import { useDemo, useDispatch } from "../../../engine/react"
import { PATHS } from "../../../engine/router"
import type { DemoState } from "../../../engine/slices"
import { canDismiss, canTryBadFix, type RepairRun } from "../../../engine/slices/repairs"
import { RouteLink } from "../../../shell/links"
import { Button } from "../../../ui/button"
import { DemoButton } from "../../../ui/demo-button"
import { DemoNote } from "../../../ui/demo-note"
import { Empty } from "../../../ui/empty"
import { Heading, type HeadingLevel } from "../../../ui/heading"
import { Panel } from "../../../ui/panel"
import { checkStates, runBadge, runDiff, runKey, runTitle, stepStates, workingLine } from "./model"
import { Checks, PlainDiff, Steps } from "./parts"
import { useStepFocus } from "./use-step-focus"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"
const C = REPAIRS_COPY.run

const selectRun = (s: DemoState): RepairRun | null => s.repairs.run
/** The broken part's state word matters to the dismissed/rejected lines: read it as a primitive. */
const selectRunTargetState = (s: DemoState) => {
  const run = s.repairs.run
  return run === null ? null : (s.core.services.find((x) => x.id === run.target)?.state ?? null)
}

function BadgeLine({ run }: { run: RepairRun }) {
  const badge = runBadge(run)
  const strong = badge === "ready" || badge === "approved" || badge === "merged"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-widest",
        strong ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
      )}
    >
      {C.badge[badge]}
    </span>
  )
}

/** What a person can do now, under the change. */
function RunActions({ run, onAct }: { run: RepairRun; onAct: () => void }) {
  const dispatch = useDispatch()
  const instant = useReducedMotion()
  const targetState = useDemo(selectRunTargetState)
  const word = REPAIRS_COPY.faults[run.fault].layerWord

  const act = (fn: () => void) => () => {
    onAct()
    fn()
  }

  return (
    <div className="flex flex-col gap-3">
      {run.phase === "ready" ? (
        <div className="space-y-1">
          <p className="font-mono text-xs leading-relaxed text-foreground">{C.readyLine}</p>
          <p className={TEXT}>
            {C.agentLine} <RouteLink to={PATHS.agent}>{C.agentLink}</RouteLink>
          </p>
        </div>
      ) : null}

      {run.phase === "rejected" ? (
        <div className="space-y-1 border-s-2 border-foreground ps-3">
          <p className="font-mono text-xs font-bold text-foreground">{REPAIRS_COPY.rejected}</p>
          <p className={TEXT}>{C.rejectedDetail(REPAIRS_COPY.faults[run.fault].layerWord)}</p>
        </div>
      ) : null}

      {run.phase === "dismissed" ? <p className="font-mono text-xs text-foreground">{C.dismissedLine(word)}</p> : null}

      {run.phase === "approved" ? <p className="font-mono text-xs text-foreground">{C.appliedLine(word)}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        {run.phase === "rejected" ? (
          <Button size="sm" variant="primary" data-focus-action="" onClick={act(() => dispatch({ type: "repairs/properFix", instant }))}>
            {C.proper}
          </Button>
        ) : null}
        {run.phase === "dismissed" && targetState === "error" ? (
          <Button size="sm" data-focus-action="" onClick={act(() => dispatch({ type: "repairs/retry", instant }))}>
            {C.retry}
          </Button>
        ) : null}
        {canDismiss(run) && run.proposalId !== null ? (
          <Button
            size="sm"
            data-focus-action=""
            confirm={C.dismissConfirm}
            onClick={act(() => {
              if (run.proposalId !== null) dispatch({ type: "core/proposalDismissed", id: run.proposalId })
            })}
          >
            {C.dismiss}
          </Button>
        ) : null}
        {canTryBadFix(run) ? (
          <DemoButton data-focus-action="" onClick={act(() => dispatch({ type: "repairs/badFix", instant }))}>
            {C.badFix}
          </DemoButton>
        ) : null}
      </div>
      {canTryBadFix(run) ? <p className={TEXT}>{C.badFixNote}</p> : null}
    </div>
  )
}

/** The repair panel: empty until a fault is simulated, then the pull request of the current run. */
export function RunPanel({ level }: { level: Exclude<HeadingLevel, 1> }) {
  const run = useDemo(selectRun)
  const root = useRef<HTMLDivElement>(null)
  const arm = useStepFocus(root, runKey(run))

  if (run === null) {
    return (
      <Panel title={C.title} suffix={C.by} heading={level} flush>
        <Empty title={C.noneTitle} className="border-0">
          {C.noneBody}
        </Empty>
      </Panel>
    )
  }

  const diff = runDiff(run)
  return (
    <Panel title={C.title} suffix={C.by} chromeEnd={<BadgeLine run={run} />}>
      <div ref={root} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Heading level={level} tabIndex={-1} data-focus-heading="" className="font-mono text-sm font-bold leading-relaxed text-foreground">
            {C.heading(runTitle(run))}
          </Heading>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={TEXT}>{C.by}</span>
            <DemoNote kind="reply" />
          </div>
        </div>

        <Steps states={stepStates(run)} working={workingLine(run)} />

        {diff ? (
          <PlainDiff lines={diff} label={run.fix === "good" ? C.changeLabel : C.changeBad} />
        ) : (
          <p className={TEXT}>{C.changePending}</p>
        )}

        <Checks run={run} states={checkStates(run)} />

        <RunActions run={run} onAct={arm} />
      </div>
    </Panel>
  )
}
