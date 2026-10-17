"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { FOCUS_RING_INSET } from "./classes"
import { TerminalChrome } from "./terminal-chrome"
import { isPinnedToBottom, lineTone } from "./terminal-lines"

/** Props of MiniTerminal. */
export interface MiniTerminalProps {
  lines: readonly string[]
  title: string
  /** Chrome suffix, default "terminal". */
  suffix?: string
  /** Keep the view pinned to the newest line. Pauses while the reader has scrolled up, resumes at the bottom. */
  follow?: boolean
  /** Show the trailing blinking block cursor (the tail is being fed). */
  live?: boolean
  /** Max-height class for the scroll area (rem based, never a viewport unit). Default "max-h-64". */
  maxHeightClass?: string
  /** Shown when `lines` is empty. */
  emptyText?: string
  className?: string
}

/**
 * Log tail. Renders every line at once: there is deliberately no typewriter, because data must never
 * be delayed or animated in. New lines come from the demo store, never from a timer in here.
 */
export function MiniTerminal({
  lines,
  title,
  suffix,
  follow = false,
  live = false,
  maxHeightClass = "max-h-64",
  emptyText,
  className,
}: MiniTerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  const onScroll = () => {
    const el = bodyRef.current
    if (el) pinned.current = isPinnedToBottom(el.scrollHeight, el.scrollTop, el.clientHeight)
  }

  useEffect(() => {
    if (follow) pinned.current = true
  }, [follow])

  useEffect(() => {
    const el = bodyRef.current
    if (follow && el && pinned.current) el.scrollTop = el.scrollHeight
  }, [lines, follow, live])

  return (
    <div className={cn("flex min-h-0 flex-col border border-border", className)}>
      <TerminalChrome title={title} suffix={suffix} />
      {/* role=log with aria-live=off: a labelled, keyboard-scrollable region that does not chatter at screen readers. */}
      <div
        ref={bodyRef}
        role="log"
        aria-live="off"
        aria-label={`${title} output`}
        tabIndex={0}
        onScroll={onScroll}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto bg-secondary/20 p-4 font-mono text-xs leading-relaxed",
          maxHeightClass,
          FOCUS_RING_INSET,
        )}
      >
        <div className="flex flex-col gap-0.5">
          {lines.length === 0 && emptyText ? <div className="text-muted-foreground">{emptyText}</div> : null}
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-words",
                lineTone(line) === "command" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {line === "" ? " " : line}
            </div>
          ))}
          {live ? (
            <div aria-hidden="true" className="text-foreground">
              <span className="animate-blink">{"█"}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
