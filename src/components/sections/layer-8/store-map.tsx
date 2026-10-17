"use client"

import { Fragment, useEffect, useId, useReducer, useRef } from "react"
import { LiveLine } from "@/components/common/live-line"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { StatusDot } from "@/components/common/status-dot"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { useDevice } from "@/lib/device-store"
import { SUPPORT_LABELS, deviceById, layerSupport, type DeviceId } from "@/lib/devices"
import { cn } from "@/lib/utils"
import {
  BATCH_LABEL,
  BATCH_ORDER,
  EXPORT_CHIP,
  FREE_ORDER,
  GAUGE_WORDS,
  GRID_COLUMNS,
  RELAY_CAPTION,
  RULE3_NOTE,
  SIZE_WORDS,
  STORE_FULL,
  STORE_SIZE,
  cellViews,
  describeStore,
  gaugeMarks,
  gaugeOf,
  ghostOf,
  initialStoreMap,
  isRefused,
  storeMapReducer,
  type CellClass,
  type CellView,
  type StoreMapState,
} from "./model"

/** FILL IT steps one pour per tick, only while the panel is on screen. */
const STEP_MS = 500
/** Bars on the V9 capacity strip. */
const METER_BARS = 32

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
const FOCUS_OFFSET =
  "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
const BUTTON =
  "inline-flex min-h-11 items-center justify-center border px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 sm:min-h-8"
const QUIET_BUTTON = "border-border text-muted-foreground hover:border-foreground hover:text-foreground"

/**
 * Face of a held cell, by its place in the free-space order. Each class
 * differs in form, not only in shade, and the faces get brighter and more
 * solid the longer the data stays: hollow grey (rule 1), solid grey
 * (rule 2), white with a dark centre (rule 3), solid white (never freed).
 * The update the node runs is a white outline.
 */
const FACE: Readonly<Record<`${CellClass}`, string>> = {
  "1": "border border-muted-foreground",
  "2": "bg-muted-foreground",
  "3": "bg-foreground",
  never: "bg-foreground",
  kept: "border-2 border-foreground",
}

/** Rule 3's dark centre, drawn inside its white face. */
function Hole() {
  return <span className="h-2/5 w-2/5 bg-card" />
}

/** A legend swatch with the same face as the grid's cells. */
function Swatch({ cls, className }: { cls: CellClass; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-3 w-3 shrink-0 items-center justify-center", FACE[`${cls}`], className)}>
      {cls === 3 ? <Hole /> : null}
    </span>
  )
}

/** The cell class each numbered rule's swatch shows (rule 4 = the never-freed cells). */
const RULE_CLASS: Readonly<Record<1 | 2 | 3 | 4, CellClass>> = { 1: 1, 2: 2, 3: 3, 4: "never" }

function cellClass(view: CellView): string {
  if (view.state === "empty") return "border border-border"
  if (view.state === "freed") return "border border-dashed border-muted-foreground text-muted-foreground"
  return FACE[`${view.cls}`]
}

/**
 * The L8 Store Map: one device's store as a grid of cells, the V9 capacity
 * strip, the pour controls and the numbered free-space order. Follows the
 * page-level device; switching device starts a fresh store.
 */
export function StoreMap() {
  const device = useDevice()
  const frame = useRef<HTMLDivElement>(null)
  const play = useInViewPlay(frame)
  return (
    <div ref={frame}>
      <StoreMapPanel key={device} device={device} play={play} />
    </div>
  )
}

function StoreMapPanel({ device, play }: { device: DeviceId; play: boolean }) {
  const [state, dispatch] = useReducer(storeMapReducer, device, initialStoreMap)
  const reduced = useReducedMotion()
  const running = state.filling && play && !reduced
  const pourLabel = useId()

  // The one JS loop of L8: FILL IT's steps, started by that click, only in view.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => dispatch({ type: "tick" }), STEP_MS)
    return () => window.clearInterval(id)
  }, [running])

  const label = deviceById(device).label
  const size = STORE_SIZE[device]
  const refused = isRefused(state)

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Store map <span aria-hidden="true">·</span> <span className="text-foreground">{label}</span>{" "}
          <span aria-hidden="true">·</span> {SIZE_WORDS[size]}
        </p>
        <SimulationChip />
      </div>

      {/* Below lg the controls sit right under the grid, so every click's result stays on screen; the order list follows. */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 p-4 md:p-6 lg:col-start-1 lg:row-start-1">
          <div className="max-w-xl">
            <CapacityMeter state={state} />
            <StoreGrid state={state} label={label} />
          </div>
        </div>

        <div className="min-w-0 border-t border-border p-4 md:p-6 lg:col-start-1 lg:row-start-2">
          <p id={pourLabel} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Pour a batch
          </p>
          <div role="group" aria-labelledby={pourLabel} className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {BATCH_ORDER.map((batch) => (
              <button
                key={batch}
                type="button"
                onClick={() => dispatch({ type: "pour", batch })}
                className={cn(BUTTON, FOCUS, QUIET_BUTTON)}
              >
                {BATCH_LABEL[batch]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch(state.filling ? { type: "stop" } : { type: "fill", whole: reduced })}
              className={cn(
                BUTTON,
                FOCUS_OFFSET,
                "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground",
              )}
            >
              {state.filling ? "Stop" : "Fill it"}
            </button>
            <button type="button" onClick={() => dispatch({ type: "reset" })} className={cn(BUTTON, FOCUS, QUIET_BUTTON)}>
              Reset
            </button>
            <span className="ml-auto">
              {refused ? (
                <StatusDot state="error" label={STORE_FULL} className="text-foreground" />
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {size === "none" ? RELAY_CAPTION : "accepting new data"}
                </span>
              )}
            </span>
          </div>

          <LiveLine className="mt-4 min-h-10 text-xs leading-relaxed text-foreground">{state.message}</LiveLine>

          {state.log.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Free log</p>
              <ol className="mt-2 space-y-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {state.log.map((line, i) => (
                  <li key={`${state.pours}-${i}`}>{line}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="min-w-0 border-t border-border p-4 md:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-t-0 lg:border-l">
          <FreeOrder state={state} />
          <p className="mt-6 font-mono text-[10px] tracking-wider text-muted-foreground">
            storage on this device: <span className="text-foreground">{SUPPORT_LABELS[layerSupport(device, 8)]}</span>
          </p>
        </div>
      </div>
    </Panel>
  )
}

/**
 * The V9 capacity strip (ported from the old identity section), with
 * "/Unlimited" removed and a pressure tick. Solid bars are in use; for the
 * last pour, dashed bars run on to its peak (the room it freed after crossing
 * the line, or the batch that did not fit), and a dashed cap past the end
 * marks a peak beyond capacity.
 */
function CapacityMeter({ state }: { state: StoreMapState }) {
  const { store, last } = state
  const word = GAUGE_WORDS[gaugeOf(store, last)]
  const ghost = ghostOf(last)
  const { lit, ghostEnd, overflow, tick } = gaugeMarks(store, last, METER_BARS)
  const cause =
    ghost === "freed"
      ? " The last pour went past the line, then room was freed."
      : ghost === "unfit"
        ? " The last batch did not fit."
        : ""

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Capacity</p>
      <div className="flex items-center gap-4">
        <div
          role="img"
          aria-label={`Capacity gauge: ${word}.${cause}`}
          className="flex h-12 min-w-0 flex-1 items-stretch gap-px py-1 sm:h-16"
        >
          {Array.from({ length: METER_BARS }, (_, i) => (
            <Fragment key={i}>
              {i === tick && <span className="-my-1 w-0.5 shrink-0 bg-foreground" />}
              <span
                className={cn(
                  "min-w-0 flex-1 transition-opacity duration-200 motion-reduce:transition-none",
                  i < lit
                    ? "bg-foreground"
                    : i < ghostEnd
                      ? "border border-dashed border-foreground"
                      : "bg-foreground opacity-5",
                )}
              />
            </Fragment>
          ))}
          {overflow && <span className="-my-1 ml-1 w-2 shrink-0 border border-dashed border-foreground sm:w-3" />}
        </div>
        <div className="flex w-24 shrink-0 flex-col gap-1 font-mono text-xs">
          <span className="font-bold text-foreground">{word}</span>
          <span className="text-[10px] text-muted-foreground">capacity</span>
        </div>
      </div>
      {store.capacity > 0 && (
        <ul className="mt-2 flex min-h-8 flex-wrap content-start items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground sm:min-h-4">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-0.5 shrink-0 bg-foreground" />
            past this line, space runs short
          </li>
          {ghost && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-1.5 shrink-0 border border-dashed border-foreground" />
              {ghost === "freed" ? "freed by the last pour" : "the last batch, which did not fit"}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** One device's store: a grid of CSS square cells, faced by place in the free-space order. */
function StoreGrid({ state, label }: { state: StoreMapState; label: string }) {
  const { store, last } = state
  const aria = describeStore(store, label, last)

  if (store.capacity === 0) {
    return (
      <div className="mt-6">
        <div role="img" aria-label={aria} className="grid grid-cols-16 gap-0.5 opacity-40 sm:gap-1">
          {Array.from({ length: GRID_COLUMNS }, (_, i) => (
            <span key={i} className="aspect-square border border-border" />
          ))}
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">radio relay: {RELAY_CAPTION}</p>
      </div>
    )
  }

  return (
    <div
      role="img"
      aria-label={aria}
      className={cn(
        // GRID_COLUMNS columns at every width, so a large store stays short on a phone.
        "mt-6 grid grid-cols-16 gap-0.5 font-mono text-[8px] leading-none sm:gap-1 sm:text-[9px]",
        // Shared cell box, set once on the grid (up to a large store's worth of cells).
        "*:flex *:aspect-square *:items-center *:justify-center *:transition-colors *:duration-300 motion-reduce:*:transition-none",
      )}
    >
      {cellViews(store, last).map((view, i) => (
        <span key={i} className={cellClass(view)}>
          {view.state === "freed" ? view.rule : view.state === "held" && view.cls === 3 ? <Hole /> : null}
        </span>
      ))}
    </div>
  )
}

/** The numbered free-space order (W3), doubling as the grid's legend. */
function FreeOrder({ state }: { state: StoreMapState }) {
  const active = new Set<number>(state.last?.freed.map((item) => item.rule) ?? [])
  if (isRefused(state)) active.add(4)
  const offered = state.store.exportOffered

  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Free-space order</h3>
      <ol className="mt-4 space-y-3">
        {FREE_ORDER.map(({ rule, text }) => (
          <li key={rule} className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px] transition-colors duration-200 motion-reduce:transition-none",
                active.has(rule) ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
              )}
            >
              {rule}
            </span>
            <Swatch cls={RULE_CLASS[rule]} className="mt-1" />
            <span className="font-mono text-xs leading-relaxed text-muted-foreground">
              <span className={cn(rule === 4 && "text-foreground")}>{text}</span>
              {rule === 3 && (
                <>
                  {" "}
                  <span
                    className={cn(
                      "inline-flex border px-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 motion-reduce:transition-none",
                      offered ? "border-foreground bg-foreground text-background" : "border-dashed border-border text-muted-foreground",
                    )}
                  >
                    {EXPORT_CHIP}
                  </span>
                  {offered ? null : <span className="sr-only"> (not yet)</span>}
                  <span className="mt-1 block text-[10px]">{RULE3_NOTE}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
      <ul className="mt-5 space-y-2 border-t border-border pt-4 font-mono text-[10px] text-muted-foreground">
        <li className="flex items-center gap-3">
          <Swatch cls="kept" />
          kept: the update this node runs
        </li>
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 border border-dashed border-muted-foreground" />
          freed by the last pour (its rule inside)
        </li>
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 border border-border" />
          free space
        </li>
      </ul>
    </div>
  )
}
