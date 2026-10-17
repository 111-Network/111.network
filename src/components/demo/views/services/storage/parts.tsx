// The Storage page's drawn parts: the word gauge, the classes list, the free-space order and the
// hubs. Each reads only what it is given; index.tsx wires them to the store. Server-safe (no hooks).
import { Fragment } from "react"
import { cn } from "@/lib/utils"
import { STORAGE_COPY, STORAGE_EXPORT_CHIP, STORAGE_FREE_ORDER, STORAGE_RULE3_NOTE } from "../../../copy/storage"
import type { StorageState } from "../../../engine/slices/storage"
import { DemoNote } from "../../../ui/demo-note"
import { LABEL_CLASS } from "../../../ui/classes"
import {
  CLASS_PARTS,
  FACE_CLASS,
  PRESSURE_BAR,
  RULE_FACE,
  activeRules,
  describeGauge,
  gaugeCells,
  gaugeWord,
  partState,
  ruleChip,
  type Face,
} from "./model"
import { KIND_RULE } from "../../../engine/slices/storage"

const TEXT = "font-mono text-xs leading-relaxed text-muted-foreground"

type StoreView = Pick<StorageState, "items" | "fetch" | "last">

/** Rule 3's dark centre, drawn inside its white face. */
function Hole() {
  return <span className="h-1/3 w-1/2 bg-background" />
}

/** A legend swatch with the same face as the gauge bars. */
export function Swatch({ face, className }: { face: Face; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-3 w-3 shrink-0 items-center justify-center", FACE_CLASS[face], className)}>
      {face === "rule3" ? <Hole /> : null}
    </span>
  )
}

/**
 * The store gauge (real store-gauge.tsx): one bar per internal unit, faced by place in the
 * free-space order, a tick at the line past which space runs short, and the gauge word beside it.
 * Bars change colour only when the store changes (a click, a scheduled fetch step).
 */
export function StoreGauge({ storage }: { storage: StoreView }) {
  const g = STORAGE_COPY.gauge
  const cells = gaugeCells(storage)
  const word = g.words[gaugeWord(storage)]
  const arriving = cells.includes("arriving")
  const freed = cells.includes("freed")
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div role="img" aria-label={describeGauge(storage)} className="flex h-12 min-w-0 flex-1 items-stretch gap-px py-1">
          {cells.map((face, i) => (
            <Fragment key={i}>
              {i === PRESSURE_BAR ? <span aria-hidden="true" className="-my-1 w-0.5 shrink-0 bg-foreground" /> : null}
              <span
                aria-hidden="true"
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center transition-colors duration-200 motion-reduce:transition-none",
                  FACE_CLASS[face],
                )}
              >
                {face === "rule3" ? <Hole /> : null}
              </span>
            </Fragment>
          ))}
        </div>
        <div className="flex w-24 shrink-0 flex-col gap-1 font-mono text-xs">
          <span className="font-bold text-foreground">{word}</span>
          <span className="text-[10px] text-muted-foreground">{g.caption}</span>
        </div>
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-0.5 shrink-0 bg-foreground" />
          {g.legend.line}
        </li>
        {arriving ? (
          <li className="flex items-center gap-2">
            <Swatch face="arriving" />
            {g.legend.arriving}
          </li>
        ) : null}
        {freed ? (
          <li className="flex items-center gap-2">
            <Swatch face="freed" />
            {g.legend.freed}
          </li>
        ) : null}
        <li className="flex items-center gap-2">
          <Swatch face="empty" />
          {g.legend.empty}
        </li>
      </ul>
    </div>
  )
}

/** The four classes, each with its parts: swatch, words, rule chip and state. */
export function StoreClasses({ storage }: { storage: StoreView }) {
  const c = STORAGE_COPY.classes
  return (
    <ul className="divide-y divide-border">
      {c.list.map((cls) => (
        <li key={cls.id} className="flex flex-col gap-2 px-4 py-3">
          <p className="font-mono text-sm text-foreground">{cls.name}</p>
          <p className={TEXT}>{cls.body}</p>
          <ul className="flex flex-col gap-1.5">
            {CLASS_PARTS[cls.id].map((kind) => {
              const state = partState(storage, kind)
              const incoming = kind === "map" && (state === "held" || state === "arriving")
              return (
                <li key={kind} className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                  <Swatch face={state === "arriving" ? "arriving" : state === "freed" ? "freed" : RULE_FACE[KIND_RULE[kind]]} />
                  <span className={state === "held" || state === "arriving" ? "text-foreground" : "text-muted-foreground"}>{c.kinds[kind]}</span>
                  <span className="border border-border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">{ruleChip(kind)}</span>
                  <span className="text-[10px] text-muted-foreground">{c.state[state]}</span>
                  {incoming ? <DemoNote /> : null}
                </li>
              )
            })}
          </ul>
          {cls.note ? <p className="font-mono text-[10px] leading-relaxed text-foreground">{cls.note}</p> : null}
        </li>
      ))}
    </ul>
  )
}

/** The numbered free-space order (W3, home L8 wording), with the rules the last prune used lit. */
export function FreeOrder({ storage }: { storage: Pick<StorageState, "last"> }) {
  const active = activeRules(storage)
  const o = STORAGE_COPY.order
  const face: Readonly<Record<1 | 2 | 3 | 4, Face>> = { 1: "rule1", 2: "rule2", 3: "rule3", 4: "never" }
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {STORAGE_FREE_ORDER.map(({ rule, text }) => {
          const lit = rule !== 4 && active.has(rule)
          return (
            <li key={rule} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px] transition-colors duration-200 motion-reduce:transition-none",
                  lit ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
                )}
              >
                {rule}
              </span>
              <Swatch face={face[rule]} className="mt-1" />
              <span className={TEXT}>
                <span className="sr-only">{`${rule}. `}</span>
                <span className={cn(rule === 4 && "text-foreground")}>{text}</span>
                {rule === 3 ? (
                  <>
                    {" "}
                    <span className="inline-flex border border-dashed border-border px-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {STORAGE_EXPORT_CHIP}
                    </span>
                    <span className="sr-only">{o.notYet}</span>
                    <span className="mt-1 block text-[10px]">{STORAGE_RULE3_NOTE}</span>
                  </>
                ) : null}
                {lit ? <span className="sr-only">{o.used}</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
      <ul className="flex flex-col gap-2 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
        <li className="flex items-center gap-3">
          <Swatch face="kept" />
          {`${STORAGE_COPY.classes.kept}: ${STORAGE_COPY.classes.kinds.update}`}
        </li>
      </ul>
      <p className="font-mono text-xs leading-relaxed text-foreground">{o.history}</p>
    </div>
  )
}

/** One hub row. */
export function HubRow({ name, where, body, note, detail }: { name: string; where: string; body: string; note?: boolean; detail?: string }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-sm text-foreground">{name}</span>
        <span className={LABEL_CLASS}>{where}</span>
        {note ? <DemoNote kind="node" /> : null}
      </div>
      <p className={TEXT}>{body}</p>
      {detail ? <p className="font-mono text-xs text-foreground">{detail}</p> : null}
    </li>
  )
}
