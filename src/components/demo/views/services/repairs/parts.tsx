// The Repairs page's drawn parts: the health matrix, the agent's steps, the plain-English diff and
// the sandbox checks. Each reads only what it is given; index.tsx and run-panel.tsx wire them to
// the store. Server-safe (no hooks). Markers are CSS squares (P0 glyph rule), never glyphs.
import { cn } from "@/lib/utils"
import { REPAIRS_COPY } from "../../../copy/repairs"
import { RouteLink } from "../../../shell/links"
import { LABEL_CLASS } from "../../../ui/classes"
import { StatusDot } from "../../../ui/status-dot"
import {
  CHECK_IDS,
  checkText,
  type CheckState,
  type MatrixRow,
  type PlainDiffLine,
  type StepState,
} from "./model"
import type { CheckId, RepairRun } from "../../../engine/slices/repairs"

const C = REPAIRS_COPY

/** A square marker: filled = done / pass, hollow bright = working / fail, dashed dim = waiting. */
export function Marker({ tone, blink = false }: { tone: "filled" | "hollow" | "dashed"; blink?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-2 w-2 shrink-0",
        tone === "filled" && "bg-foreground",
        tone === "hollow" && "border border-foreground",
        tone === "dashed" && "border border-dashed border-muted-foreground",
        blink && "animate-blink",
      )}
    />
  )
}

/** The health matrix: one row per layer this device runs, its watched parts each with a labelled dot. */
export function HealthMatrix({ rows }: { rows: readonly MatrixRow[] }) {
  const m = C.matrix
  return (
    <table className="w-full border-collapse font-mono text-xs">
      <caption className="sr-only">{m.heading}</caption>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className={cn(LABEL_CLASS, "px-4 py-2 text-start font-normal")}>
            {m.layerColumn}
          </th>
          <th scope="col" className={cn(LABEL_CLASS, "px-4 py-2 text-start font-normal")}>
            {m.partsColumn}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.n} className="align-top">
            <th scope="row" className="w-2/5 px-4 py-2 text-start font-normal text-muted-foreground">
              {row.title}
            </th>
            <td className="px-4 py-2">
              <ul className="flex flex-col gap-1.5">
                {row.parts.map((part) => (
                  <li key={part.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {part.href ? (
                      <RouteLink to={part.href} className="inline-flex min-h-11 items-center @min-[1024px]:min-h-0">
                        {part.name}
                      </RouteLink>
                    ) : (
                      <span className="text-foreground">{part.name}</span>
                    )}
                    <StatusDot state={part.state} />
                    {part.repaired ? <span className="text-[10px] text-muted-foreground">{part.repaired}</span> : null}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const STEP_TONE: Readonly<Record<StepState, "filled" | "hollow" | "dashed">> = { done: "filled", working: "hollow", waiting: "dashed" }

/** diagnose · build a fix · test in a sandbox, each with its state word. */
export function Steps({ states, working }: { states: readonly StepState[]; working: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={LABEL_CLASS}>{C.run.stepsLabel}</p>
      <ol className="flex flex-col gap-1.5 font-mono text-xs">
        {C.run.steps.map((step, i) => {
          const state = states[i] ?? "waiting"
          return (
            <li key={step} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Marker tone={STEP_TONE[state]} blink={state === "working"} />
              <span className={state === "waiting" ? "text-muted-foreground" : "text-foreground"}>{step}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{C.run.stepState[state]}</span>
              {state === "working" && working ? <span className="text-[10px] text-muted-foreground">{working}</span> : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** The change in plain words: additions inverted, removals struck through and muted. No code, no numbers. */
export function PlainDiff({ lines, label }: { lines: readonly PlainDiffLine[]; label: string }) {
  const sr = C.run.diffSr
  return (
    <div className="flex flex-col gap-2">
      <p className={LABEL_CLASS}>{label}</p>
      <ul className="flex flex-col gap-1 border border-border bg-secondary/20 p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <li key={i}>
            <span className="sr-only">{sr[line.op]}</span>
            <span
              className={cn(
                line.op === "add" && "bg-foreground px-1 text-background",
                line.op === "remove" && "text-muted-foreground line-through",
                line.op === "keep" && "text-muted-foreground",
              )}
            >
              {line.text}
            </span>
          </li>
        ))}
      </ul>
      <p aria-hidden="true" className="font-mono text-[10px] text-muted-foreground">
        {C.run.diffLegend}
      </p>
    </div>
  )
}

const CHECK_TONE: Readonly<Record<CheckState, "filled" | "hollow" | "dashed">> = { pass: "filled", fail: "hollow", waiting: "dashed" }

/** The sandbox strip: applied in a sandbox · failure replayed: gone · other layers untouched. */
export function Checks({ run, states }: { run: RepairRun | null; states: Readonly<Record<CheckId, CheckState>> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={LABEL_CLASS}>{C.run.checksLabel}</p>
      <ul className="flex flex-col gap-1.5 font-mono text-xs @min-[768px]:flex-row @min-[768px]:flex-wrap @min-[768px]:gap-x-6">
        {CHECK_IDS.map((id) => {
          const state = states[id]
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Marker tone={CHECK_TONE[state]} />
              <span className={cn(state === "waiting" ? "text-muted-foreground" : "text-foreground", state === "fail" && "font-bold")}>
                {checkText(run, id, state)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{C.run.checkState[state]}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
