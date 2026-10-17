"use client"

import { useEffect, useReducer, useRef, type MouseEvent } from "react"
import { LiveLine } from "@/components/common/live-line"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { prefersReducedMotion } from "@/lib/motion"
import { scrollToAnchor } from "@/lib/scroll"
import { cn } from "@/lib/utils"
import {
  ENCODER_RULE,
  HEARTBEATS,
  INITIAL_SEEK,
  NETWORKS,
  RUNG_LABEL,
  SCOPE_CAPTION,
  encoderOutput,
  heartbeatStatus,
  networkName,
  priorityEncode,
  rungStates,
  scopeAnimates,
  scopeLabel,
  scopeMode,
  seekDelay,
  seekNarration,
  seekReducer,
  type RungState,
} from "./model"
import { Scope } from "./scope"

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
const FOCUS_OFFSET = `${FOCUS} focus-visible:ring-offset-2 focus-visible:ring-offset-background`
const LABEL = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

const RUNG_CLASS: Record<RungState, string> = {
  "not-tried": "border-dashed border-border text-muted-foreground",
  listening: "border-foreground text-foreground",
  "no-signal": "border-border text-muted-foreground",
  found: "border-foreground bg-foreground text-background",
}

const HEARTBEAT_PIPS = Array.from({ length: HEARTBEATS }, (_, i) => i)

function onLayer7Click(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (scrollToAnchor("layer-7")) event.preventDefault()
}

/**
 * Component A, the Priority Seek Board (V8 BlueprintSelector, remixed): the
 * visitor sets which networks are in range; the encoder answers "first hit
 * wins"; SEEK walks the ladder from the top while the readout shows noise,
 * then a clean carrier and a few heartbeats, then one static frame.
 */
export function SeekBoard() {
  const rootRef = useRef<HTMLDivElement>(null)
  const play = useInViewPlay(rootRef)
  const reduced = useReducedMotion()
  const [state, dispatch] = useReducer(seekReducer, INITIAL_SEEK)

  // One timer per step, armed only while a seek is under way and the board is in view.
  // (The readout's frame loop has its own gate: the canvas itself must be on screen.)
  useEffect(() => {
    const delay = seekDelay(state)
    if (delay === null || !play) return
    const id = window.setTimeout(() => dispatch({ type: "step" }), delay)
    return () => window.clearTimeout(id)
  }, [state, play])

  const hit = priorityEncode(state.inRange)
  const rungs = rungStates(state)
  const mode = scopeMode(state)
  const resolved = state.phase === "settled" || state.phase === "none"
  const beats = state.phase === "settled" ? HEARTBEATS : state.phase === "joined" ? state.beats : 0

  return (
    <div ref={rootRef} className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      {/* Inputs → priority encoder → SEEK */}
      <div className="min-w-0">
        <p className={LABEL}>In range? Press a network to toggle it</p>
        {/* Four across only where each toggle has room (the board is two columns from lg). */}
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {NETWORKS.map((net, i) => {
            const on = state.inRange[i]
            return (
              <li key={net.letter} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${networkName(i)}, ${net.medium}: in range`}
                  onClick={() => dispatch({ type: "toggle", index: i })}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start gap-1 border p-3 text-left font-mono transition-colors duration-200",
                    FOCUS_OFFSET,
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-[10px] tracking-widest">#{i + 1}</span>
                  <span className="text-sm font-bold">NETWORK {net.letter}</span>
                  <span className="text-[10px]">{net.medium}</span>
                  <span className="mt-1 text-[10px] uppercase tracking-widest">{on ? "in range" : "out of range"}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* Wires into the encoder, one per toggle while they sit four across: lit while in range. */}
        <div aria-hidden="true" className="hidden h-6 grid-cols-4 gap-2 sm:grid lg:hidden xl:grid">
          {NETWORKS.map((net, i) => (
            <span key={net.letter} className={cn("mx-auto h-full w-px", state.inRange[i] ? "bg-foreground" : "bg-border")} />
          ))}
        </div>
        <div aria-hidden="true" className="flex h-6 justify-center sm:hidden lg:flex xl:hidden">
          <span className="h-full w-px bg-border" />
        </div>

        <div className="border-2 border-foreground bg-background p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className={LABEL}>Priority encoder</span>
            <span className="font-mono text-[10px] text-muted-foreground">list curated in the Knowledge Layer</span>
          </div>
          <p className="mt-2 font-mono text-sm text-foreground">{ENCODER_RULE}</p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border pt-3 font-mono">
            <span className={LABEL}>output</span>
            <span className={cn("text-base font-bold", hit === null ? "text-muted-foreground" : "text-foreground")}>
              {encoderOutput(state.inRange)}
            </span>
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "seek", instant: prefersReducedMotion() })}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 border border-foreground bg-foreground px-6 font-mono text-sm text-background transition-colors duration-200 hover:bg-transparent hover:text-foreground sm:min-h-10",
              FOCUS_OFFSET,
            )}
          >
            SEEK
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">walks the list from #1 down</span>
        </div>

        {/* Right under SEEK, so every press visibly answers even when the ladder is below the fold. */}
        <LiveLine className="mt-3 min-h-8 text-xs leading-relaxed text-foreground">{seekNarration(state)}</LiveLine>
      </div>

      {/* Seek ladder + readout */}
      <div className="min-w-0">
        <p className={LABEL}>Seek ladder · preferred list, in order</p>
        <ol className="mt-3 border-l-2 border-foreground">
          {NETWORKS.map((net, i) => {
            const rung = rungs[i]
            return (
              <li
                key={net.letter}
                className="flex items-center justify-between gap-3 border-b border-border py-2 pl-3 font-mono last:border-b-0"
              >
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                  <span className="text-xs font-bold text-foreground">{networkName(i)}</span>
                  <span className="text-[10px] text-muted-foreground">{net.medium}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 border px-2 py-0.5 text-[10px] uppercase tracking-widest transition-colors duration-200",
                    RUNG_CLASS[rung],
                  )}
                >
                  {RUNG_LABEL[rung]}
                  {rung === "listening" ? <span className="animate-blink">…</span> : null}
                </span>
              </li>
            )
          })}
        </ol>

        <figure className="mt-6 border border-border">
          <figcaption className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <span className={LABEL}>Readout</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">{SCOPE_CAPTION[mode]}</span>
          </figcaption>
          <Scope mode={mode} beats={beats} animate={!reduced && scopeAnimates(mode)} label={scopeLabel(state)} />
        </figure>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={LABEL}>
            Heartbeats<span className="sr-only">: {heartbeatStatus(state)}</span>
          </span>
          <span aria-hidden="true" className="flex gap-1.5">
            {HEARTBEAT_PIPS.map((i) => (
              <span
                key={i}
                className={cn("h-2 w-2", i < beats ? "bg-foreground" : "border border-foreground", resolved && hit === null && "opacity-40")}
              />
            ))}
          </span>
          <a
            href="#layer-7"
            onClick={onLayer7Click}
            className={cn(
              "inline-flex min-h-11 items-center font-mono text-[10px] text-muted-foreground transition-colors duration-200 hover:text-foreground sm:min-h-0",
              FOCUS,
            )}
          >
            {"carry on in Layer 7 ->"}
          </a>
        </div>
      </div>
    </div>
  )
}
