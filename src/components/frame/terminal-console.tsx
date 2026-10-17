"use client"

import Link from "next/link"
import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from "react"
import { LiveLine } from "@/components/common/live-line"
import { SimulationChip } from "@/components/common/simulation-chip"
import { TerminalChrome } from "@/components/common/terminal-chrome"
import type { OutputLine } from "@/components/frame/terminal-commands"
import {
  createSession,
  editInput,
  historyNext,
  historyPrev,
  submitInput,
  type TerminalEntry,
} from "@/components/frame/terminal-session"
import { useInViewPlayRef } from "@/hooks/use-in-view-play"
import { useTypedLines } from "@/hooks/use-typed-lines"
import { getCurrentDevice } from "@/lib/device-store"
import { scrollToAnchor, scrollToLayer } from "@/lib/scroll"
import { cn } from "@/lib/utils"

// The interactive part of the finale terminal (plan §4.4). Nothing moves until
// the visitor types: the welcome line is printed whole on the server, output
// types line by line only after a command (whole under reduced motion), and
// the input is never focused on page load.

const NO_LINES: readonly OutputLine[] = []
/** Milliseconds per typed output line. */
const TYPE_MS = 45
/** A blank output line keeps its height. */
const BLANK = " "
const NEW_TAB = " (opens in a new tab)"

const FOCUS = "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"

/**
 * The input is invisible (the prompt draws it), so its focus ring goes on the
 * visible window: offset ring + white border while the input has focus.
 */
const WINDOW_FOCUS =
  "has-[input:focus-visible]:border-foreground has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-foreground has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background"

/** One output link: in-page hashes scroll (reduced-motion aware), routes use Link, the rest open a new tab. */
function LineLink({ href, label, children }: { href: string; label?: string; children: string }) {
  const className = cn("text-foreground underline underline-offset-4 hover:bg-foreground hover:text-background", FOCUS)
  if (href.startsWith("#")) {
    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (scrollToAnchor(href)) event.preventDefault()
    }
    return (
      <a href={href} aria-label={label} onClick={onClick} className={className}>
        {children}
      </a>
    )
  }
  if (href.startsWith("/")) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label ? `${label}${NEW_TAB}` : undefined}
      className={className}
    >
      {children}
      {label ? null : <span className="sr-only">{NEW_TAB}</span>}
    </a>
  )
}

/** Hanging indent: the first line starts at column 0, wrapped lines under column `hang`. */
function hangStyle(hang: number | undefined): CSSProperties | undefined {
  return hang ? { paddingLeft: `${hang}ch`, textIndent: `-${hang}ch` } : undefined
}

function Line({ line }: { line: OutputLine }) {
  const tone = line.tone === "bright" ? "text-foreground" : "text-muted-foreground"
  const content = line.href ? (
    <LineLink href={line.href} label={line.label}>
      {line.text}
    </LineLink>
  ) : (
    line.text || BLANK
  )

  if (line.art) {
    // ASCII logo scale (DESIGN.md type table): tight leading so the strokes join.
    return (
      <div aria-hidden="true" className={cn("whitespace-pre text-[10px] leading-[12px]", tone)}>
        {content}
      </div>
    )
  }

  if (line.mark) {
    // The square sits in its own column, so wrapped text stays under the text.
    return (
      <div className={cn("flex", tone)}>
        <span aria-hidden="true" className="mr-2 flex h-[1lh] shrink-0 items-center">
          <span className={cn("h-2 w-2", line.mark === "filled" ? "bg-foreground" : "border border-foreground")} />
        </span>
        <span className="min-w-0 whitespace-pre-wrap break-words" style={hangStyle(line.hang)}>
          {content}
        </span>
      </div>
    )
  }

  return (
    <div className={cn("whitespace-pre-wrap break-words", tone)} style={hangStyle(line.hang)}>
      {content}
    </div>
  )
}

/** Exported for the server-render test only. */
export { Line as TerminalLine }

/**
 * One command block. Memoised: older entries keep their `entry` and `lines`
 * references, so a typing tick or a keystroke re-renders only the newest one.
 */
const Entry = memo(function Entry({ entry, lines }: { entry: TerminalEntry; lines: readonly OutputLine[] }) {
  return (
    <div className="pb-[1lh]">
      {entry.command !== null ? (
        <div className="whitespace-pre-wrap break-words text-foreground">
          <span aria-hidden="true">$ </span>
          {entry.command}
        </div>
      ) : null}
      {entry.srText ? <span className="sr-only">{entry.srText}</span> : null}
      {lines.map((line, index) => (
        <Line key={index} line={line} />
      ))}
    </div>
  )
})

/** The block cursor over the character at the caret: blinks while the input has focus, hollow otherwise. */
function Caret({ char, focused }: { char: string; focused: boolean }) {
  return (
    <span className="relative inline-block whitespace-pre">
      {char}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0",
          focused ? "animate-blink bg-foreground mix-blend-difference" : "border border-muted-foreground",
        )}
      />
    </span>
  )
}

/** The finale terminal window: chrome, scrolling output, the prompt and one polite live region. */
export function TerminalConsole() {
  const [session, setSession] = useState(createSession)
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [regionRef, inView] = useInViewPlayRef<HTMLDivElement>()
  const inputId = useId()
  const hintId = useId()

  const last = session.entries.at(-1)
  const typing = last !== undefined && last.typed
  const typed = useTypedLines(typing ? last.lines : NO_LINES, {
    play: inView,
    intervalMs: TYPE_MS,
    runKey: last?.id ?? -1,
  })

  // Keep the newest output in view inside the terminal body (never scrolls the page).
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [session.entries, typed.count])

  const input = session.input
  const at = Math.min(caret, input.length)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { session: next, scrollTo } = submitInput(session, { device: getCurrentDevice() })
    setSession(next)
    setCaret(0)
    if (scrollTo !== null) scrollToLayer(scrollTo)
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const { value, selectionStart } = event.currentTarget
    setSession((current) => editInput(current, value))
    setCaret(selectionStart ?? value.length)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    // As in a terminal, the arrows only walk the history: the caret never jumps to the line's start or end.
    event.preventDefault()
    const next = event.key === "ArrowUp" ? historyPrev(session) : historyNext(session)
    // Nothing to recall (empty history, oldest entry, no recall in progress): the caret stays where it is.
    if (next === session) return
    setSession(next)
    setCaret(next.input.length)
  }

  function onSelect(event: SyntheticEvent<HTMLInputElement>) {
    const { selectionStart, value } = event.currentTarget
    setCaret(selectionStart ?? value.length)
  }

  // The visible cursor always sits where the text ends after a click, as in a real terminal.
  function onInputClick(event: MouseEvent<HTMLInputElement>) {
    const el = event.currentTarget
    if (el.selectionStart !== el.selectionEnd) return
    el.setSelectionRange(el.value.length, el.value.length)
    setCaret(el.value.length)
  }

  // A click anywhere in the body focuses the prompt, unless it hit a link or ended a text selection.
  function onBodyClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("a, button, input")) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label="111 Network demo terminal"
      className={cn("border border-border shadow-panel transition-colors", WINDOW_FOCUS)}
    >
      <TerminalChrome title="111-network" subtitle="interactive" right={<SimulationChip />} />

      {/* Clicks only forward focus to the labelled input below; keyboard users tab straight to it. */}
      <div
        ref={scrollRef}
        onClick={onBodyClick}
        className="h-80 cursor-text overflow-y-auto bg-secondary/20 p-4 font-mono text-xs leading-relaxed md:h-96"
      >
        {session.entries.map((entry) => (
          <Entry key={entry.id} entry={entry} lines={entry === last && typing ? typed.visible : entry.lines} />
        ))}

        <form onSubmit={onSubmit} className="relative flex text-foreground">
          <span aria-hidden="true" className="mr-1 shrink-0">
            $
          </span>
          <span aria-hidden="true" className="min-w-0 whitespace-pre-wrap break-all">
            {input.slice(0, at)}
            <Caret char={input[at] ?? " "} focused={focused} />
            {input.slice(at + 1)}
          </span>
          <label htmlFor={inputId} className="sr-only">
            Command
          </label>
          {/* 16px text so phones do not zoom in; the ring is drawn on the window (WINDOW_FOCUS). */}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onSelect={onSelect}
            onClick={onInputClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-describedby={hintId}
            maxLength={200}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            className="absolute inset-0 h-full w-full cursor-text border-none bg-transparent text-base text-transparent caret-transparent opacity-0 outline-none"
          />
          <span id={hintId} className="sr-only">
            Type help and press Enter. Arrow up and arrow down recall earlier commands.
          </span>
        </form>
      </div>

      {/* Re-keyed per submit: a fresh node in the polite region is announced even when its words repeat. */}
      <LiveLine visuallyHidden>
        <span key={session.nextId}>{session.announcement}</span>
      </LiveLine>
    </div>
  )
}
