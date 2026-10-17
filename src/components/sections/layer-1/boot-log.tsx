"use client"

import type { MouseEvent } from "react"
import { LiveLine } from "@/components/common/live-line"
import { StatusDot } from "@/components/common/status-dot"
import { useBoot } from "@/components/sections/layer-1/boot-state"
import {
  PHONE_FINISH,
  PHONE_STATUS,
  PHONE_TAPS,
  bootView,
  dioramaArt,
  dioramaLabel,
  narrate,
  phoneStage,
  type BootLine,
  type PhoneStage,
} from "@/components/sections/layer-1/model"
import { PaneBar } from "@/components/sections/layer-1/pane-bar"
import { useInViewPlayRef } from "@/hooks/use-in-view-play"
import { useTypedLines } from "@/hooks/use-typed-lines"
import { useDevice } from "@/lib/device-store"
import { deviceById } from "@/lib/devices"
import { scrollToAnchor } from "@/lib/scroll"
import { ANCHORS } from "@/lib/site"
import { cn } from "@/lib/utils"

// Enough to fill the widest log line (the window is capped at max-w-7xl); the overflow is clipped.
const DOTS = ".".repeat(96)

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
const FOCUS_INVERTED = `${FOCUS} focus-visible:ring-offset-2 focus-visible:ring-offset-background`

/** Plain left click on the install link: scroll to the install box and move focus there (the href stays for no-JS and new tabs). */
function goToInstall(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (scrollToAnchor(ANCHORS.install)) event.preventDefault()
}

/**
 * The left pane of the L1 window: the typed install log for the followed
 * device, or (old phone) the laptop ══ USB-C ══ phone diorama with a TAP for
 * each step only a human can make. Nothing types unless a click asked for it:
 * a chip click or REPLAY types that device's log, the phone's last TAP types
 * the installer's lines, and any other device change prints whole. One typing
 * loop, gated by the in-view hook on whichever pane is mounted; reduced motion
 * prints every run whole.
 */
export function BootLog() {
  const device = useDevice()
  const { state, dispatch } = useBoot()
  const [paneRef, inView] = useInViewPlayRef<HTMLDivElement>()

  const view = bootView(state, device)
  const { key, lines, taps, tapsDone, animate } = view
  const typed = useTypedLines(lines, { play: inView && animate, runKey: `${key}:${animate ? "typed" : "still"}` })
  const count = animate ? typed.count : view.stillCount
  const finished = count >= lines.length
  const cursor = animate && !finished
  const stage = phoneStage(taps, finished)
  const label = deviceById(device).label
  const isPhone = device === "old-phone"

  return (
    <div className="flex h-full flex-col">
      <PaneBar
        right={
          <button
            type="button"
            onClick={() => dispatch({ type: "run", device })}
            className={cn(
              "inline-flex min-h-11 items-center border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:border-foreground hover:text-foreground sm:min-h-7",
              FOCUS,
            )}
          >
            REPLAY<span className="sr-only"> the install on the {label}</span>
          </button>
        }
      >
        {isPhone ? "phone setup over USB-C" : "install log"}
      </PaneBar>

      {isPhone ? (
        <PhoneSetup
          key="phone"
          paneRef={paneRef}
          stage={stage}
          taps={taps}
          tapsDone={tapsDone}
          count={count}
          cursor={cursor}
          onTap={() => dispatch({ type: "tap", key })}
        />
      ) : (
        <div key="log" ref={paneRef} className="flex-1 p-4 font-mono text-xs leading-relaxed sm:p-6">
          <LogLines lines={lines} count={count} cursor={cursor} />
        </div>
      )}

      <div className="border-t border-border px-4 py-3">
        <a
          href={`#${ANCHORS.install}`}
          onClick={goToInstall}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground sm:min-h-0",
            FOCUS,
          )}
        >
          get the one command <span aria-hidden="true">{"->"}</span>
        </a>
      </div>

      <LiveLine visuallyHidden>{narrate({ device, acted: view.acted, animated: animate, finished, taps })}</LiveLine>
    </div>
  )
}

/**
 * Every line is always laid out, so the pane never jumps while typing; lines
 * not typed yet are `invisible` (also hidden from screen readers). The cursor
 * waits at the start of the next line and only exists while a run types.
 */
function LogLines({ lines, count, cursor }: { lines: readonly BootLine[]; count: number; cursor: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => (
        <LogLine key={`${i}:${line.text}`} line={line} shown={i < count} cursor={cursor && i === count} />
      ))}
    </div>
  )
}

const PREFIX: Readonly<Record<BootLine["kind"], string>> = { cmd: "$", out: ">", item: "·", done: ">" }

function LogLine({ line, shown, cursor }: { line: BootLine; shown: boolean; cursor: boolean }) {
  return (
    <div className={cn("relative flex items-start gap-2", line.kind === "item" && "pl-4", !shown && "invisible")}>
      {cursor && (
        <span aria-hidden="true" className="visible absolute left-0 animate-blink text-foreground">
          _
        </span>
      )}
      <span aria-hidden="true" className="shrink-0 text-muted-foreground">
        {PREFIX[line.kind]}
      </span>
      <span
        className={cn(
          "min-w-0",
          line.kind === "done" && "font-bold text-foreground",
          line.kind === "cmd" && "text-foreground",
          (line.kind === "out" || line.kind === "item") && "text-muted-foreground",
        )}
      >
        {line.text}
      </span>
      {line.ok && (
        <>
          <span aria-hidden="true" className="min-w-4 flex-1 overflow-hidden whitespace-nowrap text-muted-foreground/40">
            {DOTS}
          </span>
          <span className="shrink-0 text-foreground">[ok]</span>
        </>
      )}
    </div>
  )
}

/** A step pip (CSS square, never a status dot): filled = done, dashed = next, hollow = to do. */
function StepMark({ state }: { state: "done" | "next" | "todo" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-2 w-2 shrink-0",
        state === "done" && "bg-foreground",
        state === "next" && "border border-dashed border-foreground",
        state === "todo" && "border border-muted-foreground/50",
      )}
    />
  )
}

interface PhoneSetupProps {
  paneRef: (node: HTMLDivElement | null) => void
  stage: PhoneStage
  taps: number
  tapsDone: boolean
  count: number
  cursor: boolean
  onTap: () => void
}

/**
 * The old phone: AsciiCanvas-style diorama, the human-only taps, the status
 * dot, then the installer's lines. Those lines mount only after the last TAP,
 * so the pane grows once, as the answer to that click.
 */
function PhoneSetup({ paneRef, stage, taps, tapsDone, count, cursor, onTap }: PhoneSetupProps) {
  const next = PHONE_TAPS[taps]

  return (
    <div ref={paneRef} className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
      <figure className="border border-border bg-secondary/30 p-4">
        <figcaption className="mb-2 flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-foreground" />
          {/* Spoken "laptop joined by USB-C to the phone"; the ══ glyphs are drawn, not read. */}
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            laptop <span aria-hidden="true">══</span>
            <span className="sr-only">joined by</span> USB-C <span aria-hidden="true">══</span>
            <span className="sr-only">to the</span> phone
          </span>
        </figcaption>
        <div className="overflow-x-auto">
          <pre
            role="img"
            aria-label={dioramaLabel(stage)}
            className="w-max font-mono text-[9px] leading-[12px] text-foreground/80 md:text-[11px] md:leading-[14px]"
          >
            {dioramaArt(stage)}
          </pre>
        </div>
      </figure>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">taps only you can make</p>
        <ol className="mt-3 flex flex-col gap-2 font-mono text-xs">
          {PHONE_TAPS.map((step, i) => {
            const state = i < taps ? "done" : i === taps ? "next" : "todo"
            return (
              <li key={step} className="flex items-center gap-3">
                <StepMark state={state} />
                <span className={state === "todo" ? "text-muted-foreground" : "text-foreground"}>{step}</span>
                {state !== "todo" && (
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {state}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={tapsDone ? undefined : onTap}
          aria-disabled={tapsDone || undefined}
          aria-label={tapsDone ? undefined : `TAP: ${next}`}
          className={cn(
            "inline-flex min-h-11 min-w-24 items-center justify-center border px-5 font-mono text-xs uppercase tracking-widest transition-colors duration-200 sm:min-h-9",
            tapsDone
              ? "cursor-default border-border text-muted-foreground"
              : "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground",
            FOCUS_INVERTED,
          )}
        >
          {tapsDone ? "taps done" : "TAP"}
        </button>
        <span className="inline-flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">phone</span>
          <StatusDot state={PHONE_STATUS[stage]} />
        </span>
      </div>

      {tapsDone && (
        <div className="font-mono text-xs leading-relaxed">
          <LogLines lines={PHONE_FINISH} count={count} cursor={cursor} />
        </div>
      )}
    </div>
  )
}
