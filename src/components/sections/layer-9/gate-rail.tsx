import { useId } from "react"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { HEAL_GATES } from "@/lib/heal"
import { cn } from "@/lib/utils"
import { BenchButton } from "./bench-button"
import {
  RELAY_GATE_HINT,
  canPassGate,
  checksPassed,
  stationState,
  type HealState,
  type StationState,
} from "./model"

const STATE_WORD: Record<StationState, string> = {
  passed: "passed",
  waiting: "the fix waits here",
  idle: "not reached",
}

/** Props of GateRail. */
export interface GateRailProps {
  state: HealState
  /** False on a device that runs no agent: every button is disabled and the hints say why. */
  enabled: boolean
  onPass: (index: number) => void
}

/**
 * The W13 gate rail (V7 StepPipeline): machine stations fill solid when the
 * fix reaches them; the two human stations and the maintainers stay hollow
 * until their button is clicked. Nothing auto-continues past them.
 * Vertical below xl; one row of seven from xl, where each station has room.
 */
export function GateRail({ state, enabled, onPass }: GateRailProps) {
  const titleId = useId()
  const hintId = useId()
  const last = HEAL_GATES.length - 1

  return (
    <Panel role="group" aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 id={titleId} className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">
            Gate rail
          </h3>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {enabled
              ? "people have the final say, here and on every node the fix reaches"
              : "no fix starts on a radio relay · on every node that runs an agent, people have the final say"}
          </p>
        </div>
        <SimulationChip className="shrink-0" />
      </div>

      <ol className="grid p-4 xl:grid-cols-7 xl:p-6">
        {HEAL_GATES.map((gate, i) => {
          const station = stationState(state, i)
          const passed = station === "passed"
          const waitsForPerson = gate.kind !== "machine"
          const available = enabled && canPassGate(state, i)
          const showHint = i === 0 && (!enabled || !checksPassed(state))
          const stateLine =
            station !== "waiting"
              ? STATE_WORD[station]
              : gate.kind === "human"
                ? "waiting for you"
                : gate.kind === "upstream"
                  ? "waiting for the maintainers"
                  : "the fix is arriving"
          return (
            <li key={gate.id} className="flex gap-4 xl:flex-col xl:gap-3">
              <div aria-hidden="true" className="flex flex-col items-center xl:flex-row">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center border font-mono text-[10px] font-bold transition-colors duration-300 motion-reduce:transition-none",
                    passed
                      ? "border-foreground bg-foreground text-background"
                      : waitsForPerson
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {`0${i + 1}`}
                </span>
                {i < last && (
                  <span
                    className={cn(
                      "min-h-4 w-px flex-1 transition-colors duration-300 motion-reduce:transition-none xl:h-px xl:min-h-0 xl:w-auto",
                      passed ? "bg-foreground" : "bg-border",
                    )}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-6 xl:pr-3 xl:pb-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">{gate.label}</p>
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">{gate.note}</p>
                <p
                  className={cn(
                    "mt-1 font-mono text-[10px]",
                    station === "waiting" && waitsForPerson ? "font-bold text-foreground" : "sr-only",
                  )}
                >
                  {stateLine}
                </p>
                {gate.action !== undefined && (
                  <>
                    <BenchButton
                      tone="primary"
                      available={available}
                      disabled={!enabled}
                      onPress={() => onPass(i)}
                      aria-describedby={showHint ? hintId : undefined}
                      className={cn(
                        "mt-3 w-full max-w-64 xl:max-w-none xl:px-2 xl:tracking-normal",
                        gate.kind === "upstream" && "normal-case",
                      )}
                    >
                      {gate.action}
                      {gate.kind === "upstream" && <span className="sr-only">: {gate.note}</span>}
                    </BenchButton>
                    {showHint && (
                      <p id={hintId} className="mt-2 font-mono text-[10px] text-muted-foreground">
                        {enabled ? "enabled after the checks pass" : RELAY_GATE_HINT}
                      </p>
                    )}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <p className="border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground xl:px-6">
        filled: passed · bright outline: waits for a person · dim: the machine passes it when the fix arrives
      </p>
    </Panel>
  )
}
