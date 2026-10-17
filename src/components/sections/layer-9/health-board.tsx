import { useId } from "react"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { StatusDot, type StatusState } from "@/components/common/status-dot"
import type { DeviceId } from "@/lib/devices"
import { cn } from "@/lib/utils"
import { BenchButton } from "./bench-button"
import {
  FAULTS,
  LEFT_BROKEN_NOTE,
  RELAY_LINES,
  agentLog,
  boardRows,
  canBreak,
  canDismiss,
  canTryBadFix,
  canTryGoodFix,
  faultById,
  healMode,
  logVerdict,
  type BoardHealth,
  type FaultId,
  type HealState,
} from "./model"

const DOT: Record<BoardHealth, { state: StatusState; label: string }> = {
  "not-run": { state: "unset", label: "NOT RUN" },
  live: { state: "live", label: "LIVE" },
  error: { state: "error", label: "ERROR" },
  fixed: { state: "live", label: "FIXED" },
}

/** Props of HealthBoard. */
export interface HealthBoardProps {
  state: HealState
  device: DeviceId
  onBreak: (fault: FaultId) => void
  onBadFix: () => void
  onGoodFix: () => void
  onDismiss: () => void
  onReset: () => void
}

/** Left column: the L5–L8 health board with BREAK A LAYER, over the agent log. */
export function HealthBoard({ state, device, onBreak, onBadFix, onGoodFix, onDismiss, onReset }: HealthBoardProps) {
  const boardId = useId()
  const breakId = useId()
  const logId = useId()
  const mode = healMode(device)
  // A device with no agent can never act: its controls leave the tab order.
  const off = mode === "none"
  const rows = boardRows(state, device)
  const fault = state.fault === null ? null : faultById(state.fault)
  const steps = agentLog(state, device)
  const verdict = logVerdict(state)
  const watcher = off
    ? "these layers run, but a radio relay has no agent watching them"
    : mode === "via-hub"
      ? "watched by this node's agent, with a nearby hub's help"
      : "watched by this node's agent"

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel role="group" aria-labelledby={boardId}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 id={boardId} className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">
              Layer health
            </h3>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{watcher}</p>
          </div>
          <SimulationChip className="shrink-0" />
        </div>

        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.n} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span aria-hidden="true" className="w-6 font-mono text-[10px] text-muted-foreground">
                {row.ghost}
              </span>
              <span className="min-w-0 flex-1 font-mono text-xs text-foreground">
                <span className="sr-only">Layer {row.n}: </span>
                {row.name}
              </span>
              <StatusDot
                state={DOT[row.health].state}
                label={DOT[row.health].label}
                className={row.health === "not-run" ? "text-muted-foreground" : "text-foreground"}
              />
              {row.note !== null && (
                <span className="basis-full pl-9 font-mono text-[10px] text-muted-foreground">{row.note}</span>
              )}
              {row.leftBroken && (
                <span className="basis-full pl-9 font-mono text-[10px] text-foreground">{LEFT_BROKEN_NOTE}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="border-t border-border p-4">
          <p id={breakId} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Break a layer
          </p>
          <div role="group" aria-labelledby={breakId} className="mt-3 flex flex-wrap gap-2">
            {FAULTS.map((f) => (
              <BenchButton
                key={f.id}
                tone={state.fault === f.id ? "active" : "outline"}
                aria-pressed={state.fault === f.id}
                available={canBreak(device, f.id)}
                disabled={off}
                onPress={() => onBreak(f.id)}
              >
                {f.button}
                <span className="sr-only"> (layer {f.layer})</span>
              </BenchButton>
            ))}
          </div>
        </div>
      </Panel>

      <Panel role="group" aria-labelledby={logId}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-foreground" />
          <h3 id={logId} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Agent log
          </h3>
        </div>

        <div className="p-4 font-mono text-xs leading-relaxed">
          {mode === "none" ? (
            <div className="flex flex-col gap-2">
              {RELAY_LINES.map((line) => (
                <p key={line} className="text-foreground">
                  {line}
                </p>
              ))}
            </div>
          ) : fault === null ? (
            <p className="text-muted-foreground">
              {"> watching every layer this device runs · all quiet"}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-foreground">
                <span aria-hidden="true">{"! "}</span>
                {fault.layerWord}: {fault.symptom}
              </p>
              <ol className="flex flex-col gap-2 border-l border-border pl-3">
                {steps.map((step) => (
                  <li key={step.label} className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-3">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className={step.text === null ? "text-muted-foreground" : "text-foreground"}>
                      {step.text ?? "not yet"}
                    </span>
                  </li>
                ))}
              </ol>
              {verdict !== null && (
                <p className={cn("text-foreground", state.fix === "bad" && !state.dismissed && "font-bold")}>
                  <span aria-hidden="true">{state.fix === "bad" || state.dismissed ? "× " : "→ "}</span>
                  {verdict}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {state.fix === "bad" ? (
            <BenchButton available={canTryGoodFix(state)} disabled={off} onPress={onGoodFix}>
              BUILD A GOOD FIX
            </BenchButton>
          ) : (
            <BenchButton available={canTryBadFix(state)} disabled={off} onPress={onBadFix}>
              TRY A BAD FIX
            </BenchButton>
          )}
          <BenchButton available={canDismiss(state)} disabled={off} onPress={onDismiss}>
            DISMISS
          </BenchButton>
          <BenchButton available={state.fault !== null} disabled={off} onPress={onReset}>
            RESET
          </BenchButton>
        </div>
      </Panel>
    </div>
  )
}
