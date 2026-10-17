"use client"

import { useEffect, useId, useReducer, useRef, useState } from "react"
import { LiveLine } from "@/components/common/live-line"
import { SimulationChip } from "@/components/common/simulation-chip"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { prefersReducedMotion, useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import {
  DELIVERY_STATES,
  INITIAL_STATE,
  LINK_KINDS,
  LINK_LABELS,
  RECIPIENT,
  SENDER,
  STATE_SENTENCE,
  STATE_STEP,
  STATIONS,
  canAdvance,
  carriedLabel,
  courierReducer,
  hopView,
  narrate,
  sendProblem,
  senderCopyKept,
  stationTag,
  tickDelay,
  waitLine,
  waitNote,
  waitProblem,
  waitingAt,
  type CourierState,
  type HopView,
  type LinkKind,
  type StationId,
} from "./model"

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
/** Offset gap so the white ring stays visible on a white (pressed / inverted) control. */
const FOCUS_OFFSET = "focus-visible:ring-offset-2 focus-visible:ring-offset-background"
const LABEL = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
const BLOCK = "border-b border-dashed border-border px-4 py-4 sm:px-6"

/**
 * The Layer 5 courier receipt: one message travels YOU → HUB → RELAY → THEIR
 * BRIDGE → THEM as far as the visitor's links allow, and the receipt prints
 * each piece of evidence. Nothing moves until SEND or a link toggle; the timer
 * runs only while the receipt is on screen, and reduced motion cuts every trip
 * to where it ends.
 */
export function CourierReceipt() {
  const rootRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLButtonElement>(null)
  const play = useInViewPlay(rootRef)
  const reduced = useReducedMotion()
  const [state, dispatch] = useReducer(courierReducer, INITIAL_STATE)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState<ReadonlySet<StationId>>(() => new Set())
  const uid = useId()

  const { parcel, links } = state
  const advancing = canAdvance(links, parcel)

  // The one JS loop of this section: a single timeout per hop, only while
  // something can move and the receipt is in view. Under reduced motion the
  // handlers already settle; this catches a preference flipped mid-trip.
  useEffect(() => {
    if (!advancing) return
    if (reduced) {
      const id = setTimeout(() => dispatch({ type: "settle" }), 0)
      return () => clearTimeout(id)
    }
    if (!play) return
    const id = setTimeout(() => dispatch({ type: "tick" }), tickDelay(parcel))
    return () => clearTimeout(id)
  }, [advancing, play, reduced, parcel])

  // SEND and WAIT A YEAR stay focusable when they cannot act (aria-disabled,
  // not disabled): SEND makes itself unavailable on its own click, and a
  // disabled button would drop keyboard focus to the page.
  const problem = sendProblem(state)
  const waitReason = waitProblem(state)
  const wait = waitLine(links, parcel)
  const step = parcel ? STATE_STEP[parcel.state] : -1
  const ids = {
    message: `${uid}-message`,
    input: `${uid}-input`,
    problem: `${uid}-problem`,
    waitProblem: `${uid}-wait-problem`,
    links: `${uid}-links`,
    route: `${uid}-route`,
  }

  function send() {
    if (problem !== null) return
    setEditing(false)
    dispatch({ type: "send", instant: prefersReducedMotion() })
  }

  function waitAYear() {
    if (waitReason !== null) return
    dispatch({ type: "wait" })
  }

  function toggleLink(link: LinkKind) {
    dispatch({ type: "toggle", link, instant: prefersReducedMotion() })
  }

  function finishEditing() {
    setEditing(false)
    editRef.current?.focus()
  }

  function toggleSees(id: StationId) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    // relative: the containing block for every sr-only span inside, so none can widen the page.
    <div ref={rootRef} className="relative border border-border bg-card shadow-panel">
      {/* Receipt head */}
      <div className={cn(BLOCK, "flex flex-wrap items-start justify-between gap-3")}>
        <div className="min-w-0">
          <p className={LABEL}>Courier receipt</p>
          <p className="mt-1 font-mono text-xs text-foreground">from YOU to THEM · sealed and signed, end to end</p>
        </div>
        <SimulationChip />
      </div>

      {/* The message line + SEND */}
      <div className={BLOCK}>
        <div className="flex items-center justify-between gap-3">
          <p id={ids.message} className={LABEL}>
            Message
          </p>
          <button
            ref={editRef}
            type="button"
            onClick={() => (editing ? finishEditing() : setEditing(true))}
            aria-label={editing ? "done editing the message" : "edit the message"}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground sm:min-h-8",
              FOCUS,
            )}
          >
            {editing ? "done" : "edit"}
          </button>
        </div>
        {editing ? (
          <input
            id={ids.input}
            type="text"
            value={state.draft}
            onChange={(e) => dispatch({ type: "draft", text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault()
                finishEditing()
              }
            }}
            aria-labelledby={ids.message}
            autoComplete="off"
            enterKeyHint="done"
            autoFocus
            className={cn(
              "mt-2 block w-full min-w-0 rounded-none border-0 border-b border-foreground bg-transparent px-0 py-1 font-mono text-sm text-foreground",
              FOCUS,
            )}
          />
        ) : (
          <p className="mt-2 line-clamp-3 font-mono text-sm leading-relaxed text-foreground wrap-anywhere">
            &ldquo;{state.draft}&rdquo;
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={send}
            aria-disabled={problem !== null ? true : undefined}
            aria-describedby={problem ? ids.problem : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 border border-foreground bg-foreground px-6 font-mono text-sm text-background transition-colors duration-200 sm:min-h-10",
              problem !== null ? "cursor-not-allowed opacity-40" : "hover:bg-transparent hover:text-foreground",
              FOCUS,
              FOCUS_OFFSET,
            )}
          >
            SEND
          </button>
          {problem ? (
            <p id={ids.problem} className="min-w-0 font-mono text-[10px] text-muted-foreground">
              {problem}
            </p>
          ) : null}
        </div>
      </div>

      {/* Link toggles */}
      <div className={BLOCK}>
        <p id={ids.links} className={LABEL}>
          Links
        </p>
        <div role="group" aria-labelledby={ids.links} className="mt-2 flex flex-wrap gap-2">
          {LINK_KINDS.map((kind) => {
            const on = links[kind]
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLink(kind)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 border px-3 font-mono text-xs transition-colors duration-200 sm:min-h-8",
                  FOCUS,
                  FOCUS_OFFSET,
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {LINK_LABELS[kind]}
                <span aria-hidden="true" className="text-[10px] uppercase tracking-widest opacity-70">
                  {on ? "on" : "off"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Status: the four states, the sentence, time waited */}
      <div className={BLOCK}>
        <ol aria-label="Delivery states" className="grid grid-cols-4 gap-1">
          {DELIVERY_STATES.map((s) => {
            const done = STATE_STEP[s] <= step
            const current = parcel?.state === s
            return (
              <li key={s} aria-current={current ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-full transition-colors duration-200", done ? "bg-foreground" : "bg-border")}
                />
                <span
                  className={cn(
                    "truncate font-mono text-[10px] uppercase tracking-widest",
                    current ? "font-bold text-foreground" : done ? "text-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {s}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-4 font-mono text-sm leading-relaxed text-foreground">
          {parcel ? STATE_SENTENCE[parcel.state] : "Press SEND. Turn links on or off at any time."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="font-mono text-xs text-muted-foreground">
            {wait.label}: <span className="text-foreground">{wait.value}</span>
          </p>
          <span className="bg-foreground px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-background">
            expiry: none
          </span>
          <button
            type="button"
            onClick={waitAYear}
            aria-disabled={waitReason !== null ? true : undefined}
            aria-describedby={waitReason ? ids.waitProblem : undefined}
            className={cn(
              "inline-flex min-h-11 items-center border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 sm:min-h-8",
              waitReason !== null ? "cursor-not-allowed opacity-40" : "hover:border-foreground hover:text-foreground",
              FOCUS,
            )}
          >
            WAIT A YEAR
          </button>
          {waitReason ? (
            <p id={ids.waitProblem} className="min-w-0 font-mono text-[10px] text-muted-foreground">
              {waitReason}
            </p>
          ) : null}
        </div>
      </div>

      {/* The route, top to bottom */}
      <div className="px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p id={ids.route} className={LABEL}>
            Route
          </p>
          <p aria-hidden="true" className="font-mono text-[10px] text-muted-foreground">
            ▼ sealed message · ▲ acknowledgement · dashed = link off
          </p>
        </div>
        <ol aria-labelledby={ids.route} className="mt-4">
          {STATIONS.map((station, i) => (
            <StationRow
              key={station.id}
              state={state}
              index={i}
              open={open.has(station.id)}
              seesId={`${uid}-sees-${station.id}`}
              onToggleSees={() => toggleSees(station.id)}
            />
          ))}
        </ol>
      </div>

      <LiveLine visuallyHidden>{narrate(state)}</LiveLine>
    </div>
  )
}

interface StationRowProps {
  state: CourierState
  index: number
  open: boolean
  seesId: string
  onToggleSees: () => void
}

/** One stop: rail square, name + tag, what it holds, its disclosure, and the hop below it. */
function StationRow({ state, index, open, seesId, onToggleSees }: StationRowProps) {
  const station = STATIONS[index]
  const parcel = state.parcel
  const tag = stationTag(state, index)
  const reached = parcel !== null && index <= parcel.reached
  const waiting = waitingAt(state.links, parcel)
  const hop = index < RECIPIENT ? hopView(state, index) : null
  const kept = senderCopyKept(parcel)

  return (
    <li className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
      {/* Rail: the station square, then the hop line down to the next one */}
      <div aria-hidden="true" className="flex flex-col items-center">
        <span
          className={cn(
            "mt-0.5 h-3 w-3 shrink-0 border transition-colors duration-200",
            reached || index === SENDER ? "border-foreground bg-foreground" : "border-muted-foreground",
            tag.tone === "here" && "outline-1 outline-offset-2 outline-foreground",
          )}
        />
        {hop ? (
          <span
            className={cn(
              "mt-1 w-0 flex-1 transition-colors duration-200",
              hop.carrying
                ? "border-l-2 border-foreground"
                : hop.open
                  ? "border-l border-foreground/50"
                  : "border-l border-dashed border-muted-foreground/50",
            )}
          />
        ) : null}
      </div>

      <div className={cn("min-w-0", hop ? "pb-1" : "")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 font-mono text-xs font-bold uppercase tracking-widest text-foreground">
            {station.name}{" "}
            <span className="font-normal normal-case tracking-normal text-muted-foreground">({station.note})</span>
          </p>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] uppercase tracking-widest",
              tag.tone === "here"
                ? "bg-foreground px-1.5 py-0.5 text-background"
                : tag.tone === "done"
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {tag.text}
          </span>
        </div>

        {/* What this station holds */}
        {parcel && station.id === "you" ? (
          <div className="mt-1.5 font-mono text-[11px] leading-relaxed">
            <p className="text-muted-foreground">your copy · {kept ? "kept until they confirm" : "released"}</p>
            <p
              aria-hidden={kept ? undefined : true}
              className={cn(
                "line-clamp-2 text-foreground wrap-anywhere motion-safe:transition-opacity motion-safe:duration-700",
                !kept && "line-through opacity-25",
              )}
            >
              &ldquo;{parcel.text}&rdquo;
            </p>
          </div>
        ) : null}
        {parcel && reached && station.sees ? (
          // relative: keeps the sr-only span inside this clipped line (it is
          // absolutely positioned and would otherwise widen the page).
          <p className="relative mt-1.5 truncate font-mono text-[11px] text-muted-foreground">
            {carriedLabel(station)}: <span className="sr-only">unreadable noise</span>
            <span aria-hidden="true">{parcel.sealed}</span>
          </p>
        ) : null}
        {parcel && reached && station.id === "them" ? (
          <div className="mt-1.5 font-mono text-[11px] leading-relaxed">
            <p className="text-muted-foreground">reads</p>
            <p className="line-clamp-2 text-foreground wrap-anywhere">&ldquo;{parcel.text}&rdquo;</p>
          </div>
        ) : null}
        {waiting && waiting.station === index ? (
          <p className="mt-1.5 font-mono text-[11px] text-foreground">{waitNote(waiting)}</p>
        ) : null}

        {/* What it can see of a sealed message */}
        {station.sees ? (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={seesId}
              onClick={onToggleSees}
              className={cn(
                "relative mt-1 inline-flex min-h-11 items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground sm:min-h-7",
                FOCUS,
              )}
            >
              <span aria-hidden="true">{open ? "▼" : "▶"}</span>
              {/* The station in the name, so the three buttons differ in a list of buttons. */}
              <span className="sr-only">{station.name}: </span>
              what it sees
            </button>
            <p id={seesId} hidden={!open} className="font-mono text-[11px] leading-relaxed text-foreground">
              {station.sees}
            </p>
          </>
        ) : null}

        {hop ? <HopLine hop={hop} /> : null}
      </div>
    </li>
  )
}

/** The link between this station and the next: what it needs, on or off, and what is crossing it. */
function HopLine({ hop }: { hop: HopView }) {
  return (
    <div className="mt-3 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground">
      <span>{hop.label}</span>
      <span aria-hidden="true">·</span>
      <span className={hop.open ? "text-foreground" : undefined}>{hop.open ? "link on" : "link off"}</span>
      {hop.carrying ? (
        <span
          className={cn(
            "bg-foreground px-1.5 py-0.5 uppercase tracking-widest text-background",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
            hop.carrying === "message" ? "motion-safe:slide-in-from-top-1" : "motion-safe:slide-in-from-bottom-1",
          )}
        >
          {hop.carrying === "message" ? "▼ sealed message" : "▲ acknowledgement"}
        </span>
      ) : null}
    </div>
  )
}
