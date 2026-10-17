"use client"

import { useReducer, useRef } from "react"
import { ChipGroup } from "@/components/common/chip-group"
import { LiveLine } from "@/components/common/live-line"
import { SimulationChip } from "@/components/common/simulation-chip"
import { TerminalChrome } from "@/components/common/terminal-chrome"
import { useCopy } from "@/hooks/use-copy"
import { useInViewPlay } from "@/hooks/use-in-view-play"
import { useTypedLines } from "@/hooks/use-typed-lines"
import {
  INSTALL_COMMANDS,
  INSTALL_LIVE,
  INSTALL_NOTES,
  INSTALL_READ_FIRST_URL,
  INSTALL_RUN,
  type InstallRunLine,
  type InstallTarget,
} from "@/lib/site"
import { cn } from "@/lib/utils"
import {
  COPY_STATES,
  INITIAL_INSTALL_STATE,
  INSTALL_TARGET_OPTIONS,
  copyAnnouncement,
  copyButtonLabel,
  installReducer,
} from "./install-state"

/** Props of InstallTerminal. */
export interface InstallTerminalProps {
  /** Id of the box. The hero passes ANCHORS.install (plus `scroll-mt-nav` in className); the popover passes none. */
  id?: string
  /** Accessible name of the box. Default "Install". */
  label?: string
  /** Draw the box's own border and shadow. Default true; the popover passes false (it has its own frame). */
  framed?: boolean
  className?: string
}

/** Dot leader before "[ok]"; clipped to the free width of the row (160 dots outrun the widest box). */
const LEADER = ".".repeat(160)

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"

/** Cells in the longest COPY label ("SELECTED"). */
const COPY_CELLS = Math.max(...COPY_STATES.map((s) => copyButtonLabel(s).length))

/**
 * COPY's min width fits its longest label: monospace cells of 1ch plus the 0.1em
 * tracking, then px-3 and the 1 px border. So COPY -> COPIED -> SELECTED never
 * resizes the button or reflows the command, and only the current label is in the DOM.
 */
const COPY_MIN_WIDTH = `calc(${COPY_CELLS} * (1ch + 0.1em) + 1.5rem + 2px)`

interface RunLineProps {
  line: InstallRunLine
  /** Typed so far (else the row keeps its space but is invisible). */
  shown: boolean
  /** The block cursor sits at the end of this row. */
  cursor: boolean
}

/** One row of the typed install run: "> text", plus a dot leader and "[ok]" when the step reports one. */
function RunLine({ line, shown, cursor }: RunLineProps) {
  const mark = cursor ? <span className="animate-blink">{"█"}</span> : null
  return (
    <div className={cn("flex min-w-0 gap-2", !shown && "invisible")}>
      <span className="shrink-0 text-muted-foreground">{">"}</span>
      {line.ok ? (
        <>
          <span className="min-w-0">{line.text}</span>
          <span className="min-w-3 flex-1 overflow-hidden whitespace-nowrap text-muted-foreground/50">{LEADER}</span>
          <span className="shrink-0">
            [ok]
            {mark}
          </span>
        </>
      ) : (
        <span className="min-w-0">
          {line.text}
          {mark}
        </span>
      )}
    </div>
  )
}

/**
 * The install terminal (plan §3.3): two tabs, the exact command as a click-to-copy
 * input row, a COPY button, and a typed install run that retypes on every tab
 * switch or COPY press. Typing runs only while the box is on screen and the
 * tab is visible; under reduced motion the run prints whole.
 */
export function InstallTerminal({ id, label = "Install", framed = true, className }: InstallTerminalProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const commandRef = useRef<HTMLElement>(null)
  const [state, dispatch] = useReducer(installReducer, INITIAL_INSTALL_STATE)
  const play = useInViewPlay(rootRef)
  const { copy, state: copyState } = useCopy()

  const command = INSTALL_COMMANDS[state.target]
  const lines = INSTALL_RUN[state.target]
  const { count } = useTypedLines(lines, { play, runKey: state.run })
  const cursorRow = count - 1

  const onCopy = () => {
    dispatch({ type: "copy" })
    void copy(command, commandRef.current)
  }

  const onTarget = (target: InstallTarget) => dispatch({ type: "select", target })

  return (
    <div
      ref={rootRef}
      id={id}
      role="group"
      aria-label={label}
      className={cn("w-full bg-card", framed && "border border-border shadow-panel", className)}
    >
      <TerminalChrome title="install" subtitle="111-network" right={<SimulationChip />} />

      <div className="flex flex-col gap-3 p-4">
        {/*
          Tabs, COPY and the command share one grid. From sm up, COPY sits at the
          right of the tab row (plan §3). Below sm the tab row has no room for it
          (360 px phones), so it moves beside the command instead of dropping onto
          a row of its own. DOM order (tabs, COPY, command) is the same at every width.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 sm:items-center">
          <ChipGroup<InstallTarget>
            aria-label="install target"
            value={state.target}
            onValueChange={onTarget}
            options={INSTALL_TARGET_OPTIONS}
            className="col-span-2 sm:col-span-1"
          />
          <button
            type="button"
            onClick={onCopy}
            style={{ minWidth: COPY_MIN_WIDTH }}
            className={cn(
              "col-start-2 row-start-2 inline-flex min-h-11 items-center justify-center border px-3 font-mono text-[10px] tracking-widest transition-colors duration-200 sm:row-start-1 sm:min-h-8",
              copyState === "idle"
                ? "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                : "border-foreground bg-foreground text-background focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              FOCUS,
            )}
          >
            {copyButtonLabel(copyState)}
            <span className="sr-only"> the install command</span>
          </button>

          <button
            type="button"
            onClick={onCopy}
            className={cn(
              "col-start-1 row-start-2 flex min-h-11 w-full items-start gap-2 border border-border bg-background px-3 py-2 text-left font-mono text-xs leading-relaxed text-foreground transition-colors duration-200 hover:border-foreground sm:col-span-2",
              FOCUS,
            )}
          >
            <span aria-hidden="true" className="shrink-0 text-muted-foreground">
              $
            </span>
            <span className="sr-only">Copy: </span>
            <code ref={commandRef} className="min-w-0 select-text whitespace-pre-wrap break-all font-mono">
              {command}
            </code>
          </button>
        </div>

        {INSTALL_LIVE ? null : (
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            <span aria-hidden="true"># </span>
            {INSTALL_NOTES.prerelease}
          </p>
        )}

        {/* What a screen reader gets: the whole run at once. The typed copy below is visual only. */}
        <div className="sr-only">
          <p>Simulated output:</p>
          <ul>
            {lines.map((line) => (
              <li key={line.text}>
                {line.text}
                {line.ok ? ": ok" : ""}
              </li>
            ))}
          </ul>
        </div>

        {/*
          Both runs sit in the same grid cell and the other tab's run is invisible,
          so the box always takes the taller run's height, at any width (lines wrap
          differently at 375 px), and a tab switch never moves the lines below.
          minmax(0, 1fr) and min-w-0 keep the dot leaders from widening the cell.
        */}
        <div aria-hidden="true" className="grid grid-cols-1 font-mono text-[11px] leading-relaxed text-foreground/80 md:text-xs">
          {INSTALL_TARGET_OPTIONS.map(({ value }) => {
            const selected = value === state.target
            return (
              <div key={value} className={cn("col-start-1 row-start-1 min-w-0", !selected && "invisible")}>
                {INSTALL_RUN[value].map((line, i) => (
                  <RunLine key={line.text} line={line} shown={selected && i < count} cursor={selected && i === cursorRow} />
                ))}
              </div>
            )
          })}
        </div>

        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{INSTALL_NOTES.user}</p>

        {/*
          Each separator is glued to the item after it, never before a line break.
          Below sm READ IT FIRST always takes its own line (a zero-height full-width
          break) and its separator is hidden, so no line ever ends in "·".
        */}
        <p className="flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {INSTALL_NOTES.tags.map((tag, i) => (
            <span key={tag} className="inline-flex items-center gap-2">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {tag}
            </span>
          ))}
          <span aria-hidden="true" className="h-0 basis-full sm:hidden" />
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <a
            href={INSTALL_READ_FIRST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex min-h-11 items-center text-foreground underline-offset-4 hover:underline sm:min-h-0",
              FOCUS,
            )}
          >
            {INSTALL_NOTES.readFirst}
          </a>
        </p>

        <LiveLine visuallyHidden>{copyAnnouncement(copyState)}</LiveLine>
      </div>
    </div>
  )
}
