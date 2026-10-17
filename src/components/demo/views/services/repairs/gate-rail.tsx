// The W13 gate rail (plan §5 L9 V7 stepper, src/lib/heal.ts): APPROVED HERE → PR UPSTREAM →
// MAINTAINERS → MERGED → VIA GATEWAY → NODE B RE-CHECKS → NODE B'S OWNER. Machine stations fill
// solid when the fix reaches them (scheduled steps of the repairs slice); the two human stations and
// the maintainers stay hollow until their button is clicked. A real node waits at a person's gate
// for as long as it takes, so nothing here moves past one by itself (plan §6.8).
// Vertical in every width: the stations keep their notes and buttons readable inside the L4 window.
import { useId, useRef } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { REPAIRS_COPY } from "../../../copy/repairs"
import { useDemo, useDispatch } from "../../../engine/react"
import type { DemoState } from "../../../engine/slices"
import { canPassGate, type RepairRun } from "../../../engine/slices/repairs"
import { Button } from "../../../ui/button"
import { DemoNote } from "../../../ui/demo-note"
import { Heading, type HeadingLevel } from "../../../ui/heading"
import { Panel } from "../../../ui/panel"
import { STATIONS, railKey, stationLine, stationState } from "./model"
import { useStepFocus } from "./use-step-focus"

const C = REPAIRS_COPY.rail
const selectRun = (s: DemoState): RepairRun | null => s.repairs.run

export function GateRail({ level }: { level: Exclude<HeadingLevel, 1> }) {
  const run = useDemo(selectRun)
  const dispatch = useDispatch()
  const instant = useReducedMotion()
  const hintId = useId()
  const root = useRef<HTMLDivElement>(null)
  const arm = useStepFocus(root, railKey(run))
  const last = STATIONS.length - 1
  const rejected = run?.phase === "rejected"

  const pass = (index: number) => {
    arm()
    dispatch({ type: "repairs/passGate", index, instant })
  }

  return (
    // The stations other people and nodes pass are incoming demo events: the panel carries the note.
    <Panel title={C.title} suffix={C.suffix} chromeEnd={<DemoNote />}>
      <div ref={root} className="flex flex-col gap-4">
        <div className="space-y-1">
          <Heading level={level} tabIndex={-1} data-focus-heading="" className="font-mono text-sm font-bold text-foreground">
            {C.heading}
          </Heading>
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">{C.intro}</p>
        </div>

        <ol className="flex flex-col">
          {STATIONS.map((gate, i) => {
            const state = stationState(run, i)
            const passed = state === "passed"
            const person = gate.kind !== "machine"
            const available = canPassGate(run, i)
            // APPROVE ON THIS NODE is always shown (enabled once the checks pass); the later buttons only on their turn.
            const showButton = gate.action !== undefined && !passed && (i === 0 || available)
            const owner = gate.id === "node-b-owner"
            return (
              <li key={gate.id} className="flex gap-4">
                <div aria-hidden="true" className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center border font-mono text-[10px] font-bold transition-colors duration-200 motion-reduce:transition-none",
                      passed
                        ? "border-foreground bg-foreground text-background"
                        : person
                          ? "border-foreground text-foreground"
                          : state === "arriving"
                            ? "border-dashed border-foreground text-foreground"
                            : "border-border text-muted-foreground",
                    )}
                  >
                    {`0${i + 1}`}
                  </span>
                  {i < last ? (
                    <span className={cn("min-h-4 w-px flex-1 transition-colors duration-200 motion-reduce:transition-none", passed ? "bg-foreground" : "bg-border")} />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 pb-5">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">{gate.label}</p>
                  <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">{gate.note}</p>
                  <p
                    className={cn(
                      "mt-1 font-mono text-[10px]",
                      state === "waiting" ? "font-bold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {stationLine(gate, state)}
                  </p>
                  {showButton ? (
                    <div className="mt-3 flex flex-col items-start gap-2">
                      <Button
                        size="sm"
                        variant={gate.kind === "human" ? "primary" : "default"}
                        arrow={false}
                        data-focus-action=""
                        aria-disabled={!available || undefined}
                        aria-describedby={i === 0 && !available ? hintId : undefined}
                        confirm={gate.kind === "human" ? (owner ? C.ownerConfirm : C.approveConfirm) : undefined}
                        onClick={() => pass(i)}
                      >
                        {gate.action}
                        {gate.kind === "upstream" ? <span className="sr-only">: {gate.note}</span> : null}
                      </Button>
                      {i === 0 && !available ? (
                        <p id={hintId} className={cn("font-mono text-[10px]", rejected ? "font-bold text-foreground" : "text-muted-foreground")}>
                          {rejected ? C.rejectedHint : C.approveHint}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="space-y-1 border-t border-border pt-3">
          <p className="font-mono text-[10px] text-muted-foreground">{C.legend}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{C.forever}</p>
        </div>
      </div>
    </Panel>
  )
}
