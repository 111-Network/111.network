// Repairs service page (#/services/repairs, Layer 9; plan §5 L9, §6.4 Repairs, W13, §6.8). Not built
// in the real dashboard yet: the frame is the real service page (views/services/frame), the repair
// itself is shown as the real proposal card's pattern (views/agent/proposals.tsx) in plain words,
// and the log is the real mini-terminal. Its own lazily loaded chunk (views/services/index.tsx).
//
// The one demo action is "[DEMO] simulate a fault". Every later step runs in the repairs slice
// through the scheduler and is announced by the shell's live region; nothing here keeps a timer and
// nothing moves while idle. Under reduced motion each click lands on the next place a person decides.
import { useId } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { DEMO_ACTIONS } from "../../../copy/core"
import { REPAIRS_COPY } from "../../../copy/repairs"
import { useDemo, useDispatch, useWorld } from "../../../engine/react"
import { selectServices } from "../../../engine/selectors"
import type { DemoState } from "../../../engine/slices"
import { nextFaultId, simulateStatus, type RepairsState, type SimulateStatus } from "../../../engine/slices/repairs"
import { useHeadingLevel } from "../../../shell/context"
import type { ServiceViewProps } from "../../../shell/view-types"
import { DemoButton } from "../../../ui/demo-button"
import { DemoNote } from "../../../ui/demo-note"
import type { HeadingLevel } from "../../../ui/heading"
import { MiniTerminal } from "../../../ui/mini-terminal"
import { Panel } from "../../../ui/panel"
import { ServicePageFrame } from "../frame"
import { GateRail } from "./gate-rail"
import { logLines, matrixRows, matrixSummary, sharedEntry, simulateHint } from "./model"
import { HealthMatrix } from "./parts"
import { RunPanel } from "./run-panel"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"
const C = REPAIRS_COPY

const selectRepairs = (s: DemoState): RepairsState => s.repairs
const selectSimulate = (s: DemoState): SimulateStatus => simulateStatus(s.repairs, s.core)
const selectNextWord = (s: DemoState): string | null => {
  const id = nextFaultId(s.repairs, s.core)
  return id === null ? null : C.faults[id].layerWord
}

/** A panel's hidden heading is never an h1. */
const sectionLevel = (h: HeadingLevel): Exclude<HeadingLevel, 1> => (h === 1 ? 2 : h)

/** "[DEMO] simulate a fault": busy while the agent works (focus stays on it), waits while a person decides. */
function SimulateControl({ noteId }: { noteId: string }) {
  const status = useDemo(selectSimulate)
  const next = useDemo(selectNextWord)
  const dispatch = useDispatch()
  const instant = useReducedMotion()
  return (
    <>
      <DemoButton
        loading={status === "working"}
        aria-disabled={(status !== "ready" && status !== "working") || undefined}
        aria-describedby={noteId}
        onClick={() => dispatch({ type: "repairs/simulate", instant })}
      >
        {DEMO_ACTIONS.fault}
      </DemoButton>
      <p id={noteId} className={TEXT}>
        {simulateHint(status, next)}
      </p>
    </>
  )
}

function Matrix({ level }: { level: Exclude<HeadingLevel, 1> }) {
  const services = useDemo(selectServices)
  const repairs = useDemo(selectRepairs)
  const world = useWorld()
  const rows = matrixRows(services, world, repairs.repaired)
  return (
    <Panel title={C.matrix.title} suffix={C.matrix.suffix} heading={level} flush>
      <div className="space-y-1 px-4 py-3">
        <p className="font-mono text-sm leading-relaxed text-foreground">{matrixSummary(rows)}</p>
        <p className={TEXT}>{C.matrix.intro}</p>
      </div>
      <div className="border-t border-border">
        <HealthMatrix rows={rows} />
      </div>
    </Panel>
  )
}

function SharedLog({ level }: { level: Exclude<HeadingLevel, 1> }) {
  const repairs = useDemo(selectRepairs)
  const s = C.shared
  return (
    <Panel title={s.title} heading={level} flush>
      {repairs.shared.length === 0 ? (
        <div className="px-4 py-3">
          <p className="font-mono text-xs text-foreground">{s.emptyTitle}</p>
          <p className={`${TEXT} mt-1`}>{s.emptyBody}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {[...repairs.shared].reverse().map((fix) => {
            const e = sharedEntry(fix)
            return (
              <li key={fix.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-foreground">{e.title}</span>
                  <DemoNote />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {e.at} · {e.line}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function RepairLog() {
  const repairs = useDemo(selectRepairs)
  return <MiniTerminal title={C.log.title} lines={logLines(repairs.log)} emptyText={C.log.empty} follow maxHeightClass="max-h-64" />
}

function RepairsBody() {
  const h = sectionLevel(useHeadingLevel(1))
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 @min-[1024px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Matrix level={h} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <RunPanel level={h} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 @min-[1024px]:grid-cols-2">
        <div className="min-w-0">
          <GateRail level={h} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <SharedLog level={h} />
          <RepairLog />
        </div>
      </div>
    </div>
  )
}

export default function RepairsPage({ id }: ServiceViewProps) {
  const noteId = useId()
  return (
    <ServicePageFrame id={id} actions={<SimulateControl noteId={noteId} />}>
      <RepairsBody />
    </ServicePageFrame>
  )
}
