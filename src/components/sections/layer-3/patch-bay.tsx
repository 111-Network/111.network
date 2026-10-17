"use client"

import { useEffect, useReducer, useRef, type ReactNode, type RefObject } from "react"
import { flushSync } from "react-dom"
import { ChipGroup, type ChipOption } from "@/components/common/chip-group"
import { LiveLine } from "@/components/common/live-line"
import { Panel } from "@/components/common/panel"
import { SimulationChip } from "@/components/common/simulation-chip"
import { StatusDot } from "@/components/common/status-dot"
import { setDevice, useDevice } from "@/lib/device-store"
import { deviceById, type DeviceId } from "@/lib/devices"
import { prefersReducedMotion } from "@/lib/motion"
import { cn } from "@/lib/utils"
import {
  BORROWER_DEVICE,
  BRAIN_LINES,
  FOLLOW_BORROWER_LABEL,
  HUB_CHOICES,
  HUB_GROUP_LABEL,
  HUB_LABELS,
  HUB_TAPES,
  INITIAL_PATCH_STATE,
  JACK_LABELS,
  LEG_MS,
  QUESTIONS,
  SWITCH_LABEL,
  TRIP_LINES,
  agentStatus,
  answerText,
  blockedText,
  brainMode,
  cableLabel,
  cableState,
  canPullPlug,
  displayRack,
  followHint,
  hasAgent,
  hubLine,
  hubStatus,
  idleText,
  isTravelling,
  patchReducer,
  plugLabel,
  questionById,
  routeLine,
  switchState,
  visibleAsk,
  weightTag,
  type AskState,
  type HubChoice,
  type QuestionId,
  type RackState,
} from "./model"
import { JackRow, Screws, Tape } from "./rack"

const HUB_OPTIONS: readonly ChipOption<HubChoice>[] = HUB_CHOICES.map((hub) => ({ value: hub, label: HUB_LABELS[hub] }))

// Focus ring with an offset gap, so it stays visible on white (switch on, hover inversion).
const RING =
  "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"

const CAPTION = "font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

/** Props of PatchBay. */
export interface PatchBayProps {
  /** Server-rendered caption under the rack. */
  caption?: ReactNode
}

/**
 * L3 "Patch Bay: Borrow a Brain": a device panel and a hub panel joined by a
 * patch cable that exists only while consent is on and the hub next door is
 * chosen. Follows the page-level device. Nothing moves until the visitor
 * clicks; a question's trip along the cable is a CSS transition that is cut
 * under reduced motion (the answer then prints at once).
 *
 * Layout: at lg the questions and the printout sit in a panel beside the rack.
 * Below lg they move into the device panel itself (the device is the one
 * asking), right above its jacks, so the button, the cable and the answer are
 * on one phone screen. Only one copy is displayed at a time (display: none
 * hides the other from the accessibility tree); the LiveLine is single.
 */
export function PatchBay({ caption }: PatchBayProps) {
  const device = useDevice()
  const [state, dispatch] = useReducer(patchReducer, INITIAL_PATCH_STATE)
  const rack = displayRack(device, { consent: state.consent, hub: state.hub, plugged: state.plugged })
  const ask = visibleAsk(state.ask, device)

  // One timer per leg of a trip, started by the click that asked; cleared on
  // any change. It carries the followed device: if the visitor follows another
  // device mid-trip, the reducer drops the trip without a word.
  const tripRun = isTravelling(state.ask) ? state.ask.run : null
  const tripPhase = isTravelling(state.ask) ? state.ask.phase : null
  useEffect(() => {
    if (tripRun === null) return
    const id = window.setTimeout(() => dispatch({ type: "advance", run: tripRun, device }), LEG_MS)
    return () => window.clearTimeout(id)
  }, [tripRun, tripPhase, device])

  const cable = cableState(device, rack)
  const switchRef = useRef<HTMLButtonElement>(null)
  const onAsk = (question: QuestionId) =>
    dispatch({ type: "ask", device, question, reducedMotion: prefersReducedMotion() })
  const onFollow = () => {
    // Follow a borrower page-wide (the same store the L1 chips use). The
    // shortcut button unmounts with its hint, so commit now and land focus on
    // the next step: the consent switch, enabled for the borrower.
    flushSync(() => {
      setDevice(BORROWER_DEVICE)
      dispatch({ type: "follow", device: BORROWER_DEVICE })
    })
    switchRef.current?.focus()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Panel as="figure" className="min-w-0 lg:col-span-7">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className={CAPTION}>patch bay</span>
          <SimulationChip />
        </div>

        <div className="p-4 sm:p-6">
          <DevicePanel
            device={device}
            rack={rack}
            plugIn={cable !== "none"}
            onConsent={() => dispatch({ type: "toggle-consent", device })}
            switchRef={switchRef}
            screen={
              <Printout
                device={device}
                rack={rack}
                ask={ask}
                onFollow={onFollow}
                className="mt-4 min-h-40 border border-border p-3 lg:hidden"
              />
            }
            keys={
              <div className="mt-4 lg:hidden">
                <h3 className={CAPTION}>ask the agent</h3>
                <Questions device={device} ask={ask} onAsk={onAsk} className="mt-2" />
              </div>
            }
          />
          <Cable device={device} rack={rack} ask={ask} />
          <HubPanel
            device={device}
            rack={rack}
            patched={cable === "patched"}
            onHub={(hub) => dispatch({ type: "choose-hub", device, hub })}
            onPlug={() => dispatch({ type: "toggle-plug", device })}
          />
          <LiveLine visuallyHidden>{state.narration}</LiveLine>
        </div>

        {caption != null && (
          <figcaption className="border-t border-border px-4 py-3 font-mono text-[10px] leading-relaxed tracking-wider text-muted-foreground">
            {caption}
          </figcaption>
        )}
      </Panel>

      <Panel className="hidden min-w-0 flex-col lg:col-span-5 lg:flex">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <h3 className={CAPTION}>ask the agent</h3>
          <SimulationChip />
        </div>
        <Questions device={device} ask={ask} onAsk={onAsk} className="p-4" />
        <Printout
          device={device}
          rack={rack}
          ask={ask}
          onFollow={onFollow}
          className="min-h-36 flex-1 border-t border-border p-4"
        />
      </Panel>
    </div>
  )
}

/** The canned questions as buttons. Marked aria-disabled (focus stays put) while one travels. */
function Questions({
  device,
  ask,
  onAsk,
  className,
}: {
  device: DeviceId
  ask: AskState
  onAsk: (question: QuestionId) => void
  className?: string
}) {
  const agent = hasAgent(device)
  const busy = isTravelling(ask)
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {QUESTIONS.map((q) => {
        const current = ask.phase !== "idle" && ask.question === q.id
        return (
          <button
            key={q.id}
            type="button"
            disabled={!agent}
            aria-disabled={busy || undefined}
            onClick={() => onAsk(q.id)}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left font-mono text-xs transition-colors duration-200 sm:min-h-9",
              RING,
              current
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground enabled:hover:border-foreground enabled:hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-wait",
            )}
          >
            <span>{q.text}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
              {weightTag(q.weight)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The followed device's rack panel: tape label, agent status, brain line,
 * consent switch, jacks (last row, facing the cable). `screen` and `keys` are
 * the below-lg printout and question buttons.
 */
function DevicePanel({
  device,
  rack,
  plugIn,
  onConsent,
  switchRef,
  screen,
  keys,
}: {
  device: DeviceId
  rack: RackState
  plugIn: boolean
  onConsent: () => void
  switchRef: RefObject<HTMLButtonElement | null>
  screen: ReactNode
  keys: ReactNode
}) {
  const agent = hasAgent(device)
  const status = agentStatus(device, rack)
  const mode = brainMode(device)
  return (
    <div className="relative border border-border bg-background px-8 pt-5 pb-4">
      <Screws />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Tape>{deviceById(device).label}</Tape>
          <span className={CAPTION}>this device</span>
        </div>
        <StatusDot state={status.state} label={status.label} className="text-foreground" />
      </div>
      <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
        brain: <span className="text-foreground">{BRAIN_LINES[mode]}</span>
      </p>
      {screen}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          ref={switchRef}
          type="button"
          role="switch"
          aria-checked={rack.consent}
          disabled={!agent}
          onClick={onConsent}
          className={cn(
            "inline-flex min-h-11 items-center gap-3 font-mono text-xs text-foreground sm:min-h-8",
            RING,
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-5 w-10 shrink-0 items-center border border-foreground",
              rack.consent && "bg-foreground",
            )}
          >
            <span
              className={cn(
                "h-3 w-3 motion-safe:transition-transform motion-safe:duration-200",
                rack.consent ? "translate-x-[23px] bg-background" : "translate-x-[3px] bg-foreground",
              )}
            />
          </span>
          {SWITCH_LABEL}
        </button>
        <span aria-hidden="true" className={CAPTION}>
          {switchState(device, rack.consent)}
        </span>
      </div>
      {keys}
      <JackRow className="mt-4" patched={plugIn} label={JACK_LABELS[mode].device} />
    </div>
  )
}

/**
 * The gap between the panels. The cable (2 px) runs from the device's patch
 * jack to the hub's; both panels share px-8 and a 1rem pad on the facing
 * side, so it reaches 1rem + 1px into each. A pulled plug leaves it dangling
 * short of the hub. The words say what the cable is for, or why there is none.
 */
function Cable({ device, rack, ask }: { device: DeviceId; rack: RackState; ask: AskState }) {
  const cable = cableState(device, rack)
  const travelling = cable === "patched" && isTravelling(ask)
  return (
    <div className="relative h-20">
      {cable !== "none" && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[calc(-1rem_-_1px)] left-[2.375rem] z-10 w-0.5 bg-foreground",
            cable === "patched" ? "bottom-[calc(-1rem_-_1px)]" : "bottom-7",
          )}
        >
          {cable === "unplugged" ? (
            <span className="absolute -bottom-3 left-1/2 h-3 w-2 -translate-x-1/2 bg-foreground" />
          ) : (
            <span
              style={{ transitionDuration: `${LEG_MS}ms` }}
              className={cn(
                "absolute left-1/2 h-4 w-2 -translate-x-1/2 border border-foreground bg-background",
                "transition-[top] ease-in-out motion-reduce:transition-none",
                travelling ? "visible" : "invisible",
                travelling && ask.phase === "out" ? "top-[calc(100%_-_1rem)]" : "top-0",
              )}
            />
          )}
        </span>
      )}
      <p
        className={cn(
          "absolute top-1/2 right-2 left-14 -translate-y-1/2 font-mono text-[10px] leading-relaxed tracking-wider",
          cable === "patched" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {cableLabel(device, rack)}
      </p>
    </div>
  )
}

/** The hub slot's rack panel: jacks (first row, facing the cable), tape label, status, line, slot chips, plug. */
function HubPanel({
  device,
  rack,
  patched,
  onHub,
  onPlug,
}: {
  device: DeviceId
  rack: RackState
  patched: boolean
  onHub: (hub: HubChoice) => void
  onPlug: () => void
}) {
  const status = hubStatus(device, rack)
  const plugEnabled = canPullPlug(device, rack)
  return (
    <div className="relative border border-border bg-background px-8 pt-4 pb-5">
      <Screws />
      <JackRow patched={patched} label={JACK_LABELS[brainMode(device)].hub} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Tape>{HUB_TAPES[rack.hub]}</Tape>
        <StatusDot state={status.state} label={status.label} className="text-foreground" />
      </div>
      <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">{hubLine(device, rack)}</p>
      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ChipGroup
          aria-label={HUB_GROUP_LABEL}
          value={rack.hub}
          onValueChange={onHub}
          options={HUB_OPTIONS}
          disabled={!hasAgent(device)}
        />
        <button
          type="button"
          disabled={!plugEnabled}
          onClick={onPlug}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center justify-center self-start border px-3 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 sm:min-h-8 xl:self-auto",
            RING,
            rack.plugged
              ? "border-foreground text-foreground enabled:hover:bg-foreground enabled:hover:text-background"
              : "border-foreground bg-foreground text-background enabled:hover:bg-transparent enabled:hover:text-foreground",
            "disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-40",
          )}
        >
          {plugLabel(rack.plugged)}
        </button>
      </div>
    </div>
  )
}

/** The pointer to the borrowing case, with a one-click "follow an old phone". */
function FollowHint({ hint, onFollow }: { hint: string; onFollow: () => void }) {
  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      <p className="text-[10px] tracking-wider text-muted-foreground">{hint}</p>
      <button
        type="button"
        onClick={onFollow}
        className={cn(
          "inline-flex min-h-11 items-center border border-foreground px-3 font-mono text-[10px] uppercase tracking-widest text-foreground transition-colors duration-200 hover:bg-foreground hover:text-background sm:min-h-8",
          RING,
        )}
      >
        {FOLLOW_BORROWER_LABEL}
      </button>
    </div>
  )
}

/** Where the question went and what came back, printed whole. */
function Printout({
  device,
  rack,
  ask,
  onFollow,
  className,
}: {
  device: DeviceId
  rack: RackState
  ask: AskState
  onFollow: () => void
  className?: string
}) {
  const hint = followHint(device)
  if (ask.phase === "idle") {
    return (
      <div className={cn("font-mono text-xs leading-relaxed", className)}>
        <p className="text-muted-foreground">{idleText(device)}</p>
        {hint != null && <FollowHint hint={hint} onFollow={onFollow} />}
      </div>
    )
  }
  const question = questionById(ask.question)
  return (
    <div className={cn("font-mono text-xs leading-relaxed", className)}>
      <p className="text-foreground">
        <span aria-hidden="true">{"> "}</span>
        {question.text}
      </p>
      {ask.phase === "done" ? (
        <>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            {routeLine(device, ask.route, question.weight)}
          </p>
          <p className="mt-2 text-foreground">
            {ask.route.kind === "blocked"
              ? blockedText(device, ask.route.reason)
              : answerText(device, rack, question.id)}
          </p>
          {ask.route.kind === "here" && hint != null && <FollowHint hint={hint} onFollow={onFollow} />}
        </>
      ) : (
        <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">{TRIP_LINES[ask.phase]}</p>
      )}
    </div>
  )
}
