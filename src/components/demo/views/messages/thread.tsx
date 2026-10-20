// One conversation (real views/messages/thread.tsx; os/5-messaging/README.md §16): messages in the
// order they arrived here, each with its own delivery evidence in the exact words of §9, the reason
// when it waits, the custody line while your home hub holds it, the time it was received here, and
// the sender's own claim behind a disclosure, marked unverified. Peer text is rendered as text only.
//
// Sending dispatches messages/send; the slice steps the glyph queued -> sent -> relayed -> delivered
// through the scheduler as the path allows (instant under reduced motion), and Ada answers a few
// seconds after your message reached her node. Every incoming message carries the "demo message"
// note. A thread with messages waiting in the outbox offers the contextual "[DEMO] connect to the
// internet", which flushes them. There is no length limit, no expiry and no rate limit.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import { DEMO_ACTIONS } from "../../copy/core"
import { MESSAGES_COPY } from "../../copy/messages"
import { useDemo, useDispatch, useWorld } from "../../engine/react"
import { PATHS } from "../../engine/router"
import type { DemoMessage, DemoThread } from "../../engine/slices/messages"
import { useAnnounce } from "../../shell/context"
import { RouteButtonLink } from "../../shell/links"
import { selectMode, selectNow } from "../../shell/select"
import { Button } from "../../ui/button"
import { FIELD_CLASS, FOCUS_RING_INSET } from "../../ui/classes"
import { CopyButton } from "../../ui/copy-button"
import { DemoButton } from "../../ui/demo-button"
import { DemoNote } from "../../ui/demo-note"
import { Disclosure } from "../../ui/disclosure"
import { Empty } from "../../ui/empty"
import { Panel } from "../../ui/panel"
import { MessagingBanner } from "./banner"
import { StateGlyph } from "./glyph"
import {
  claimText,
  composeGate,
  custodyLine,
  draftProblem,
  evidenceText,
  isCancellable,
  messageStateCopy,
  oneLine,
  reasonText,
  requestItems,
  threadMessages,
  threadName,
  timeLabel,
  waitingInOutbox,
  whenText,
} from "./model"
import { RequestRow } from "./requests"
import { selectInternet, selectMessages } from "./select"
import { ViewHeader } from "./view-header"

const C = MESSAGES_COPY
const FOLLOW_SLACK_PX = 24
const SMALL = "max-w-[85%] text-xs leading-snug text-muted-foreground"

function MessageRow({ m, thread, now, advanced, onCancel }: { m: DemoMessage; thread: DemoThread; now: number; advanced: boolean; onCancel: (m: DemoMessage) => void }) {
  const world = useWorld()
  const own = m.dir === "own"
  const reason = reasonText(m, thread.route)
  const custody = custodyLine(m, thread, world)
  const claim = claimText(m, now)
  return (
    <li className={cn("flex flex-col gap-1", own ? "items-end" : "items-start")} data-testid={`msg-${m.id}`}>
      <div
        dir="auto"
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words border border-border px-3 py-2 text-sm leading-relaxed text-foreground",
          own && "bg-secondary",
          m.cancelled && "text-muted-foreground",
        )}
      >
        {m.text}
      </div>
      {reason ? <p className={cn(SMALL, own && "text-end")}>{reason}</p> : null}
      {custody ? <p className={cn(SMALL, "text-end")}>{custody}</p> : null}
      <Disclosure
        className="max-w-[85%] text-[11px] text-muted-foreground"
        summary={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {own ? <StateGlyph state={m.state} cancelled={m.cancelled} /> : <DemoNote />}
            <span>
              {timeLabel(m)} {whenText(m.at, now)}
            </span>
            <span className="sr-only">{C.showDetails}</span>
          </span>
        }
      >
        <div className="flex flex-col gap-1 border border-border p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          <p>{own ? messageStateCopy(m) : C.arrived}</p>
          {claim ? (
            <p>
              <span className="uppercase tracking-widest">{C.unverifiedTime}</span> {claim}
            </p>
          ) : null}
        </div>
      </Disclosure>
      {advanced ? <p className="max-w-[85%] break-all text-[11px] leading-snug text-muted-foreground">{C.advancedLine(m.id, m.seq, evidenceText(m))}</p> : null}
      {isCancellable(m) ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" confirm={C.cancelConfirm} onClick={() => onCancel(m)} aria-label={C.cancelAria(oneLine(m.text, 40))}>
            {C.cancelSending}
          </Button>
        </div>
      ) : null}
    </li>
  )
}

function Composer({ peer, focusOnMount, onSent }: { peer: string; focusOnMount: boolean; onSent: () => void }) {
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const noteId = useId()
  const errorId = useId()

  // A request accepted in this conversation: the composer replaces the request row, so it takes the focus.
  useEffect(() => {
    if (focusOnMount) ref.current?.focus()
  }, [focusOnMount])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const problem = draftProblem(value)
    if (problem) {
      setError(problem)
      ref.current?.focus()
      return
    }
    // The store event ("Message queued on this node.") is announced by the shell.
    dispatch({ type: "messages/send", peer, text: value, instant: reduced })
    setValue("")
    setError(null)
    onSent()
    ref.current?.focus()
  }

  return (
    <form className="flex flex-col gap-2 border-t border-border p-3" onSubmit={submit}>
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={2}
          value={value}
          aria-label={C.messageLabel}
          aria-describedby={error ? `${noteId} ${errorId}` : noteId}
          aria-invalid={error ? true : undefined}
          placeholder={C.placeholder}
          autoComplete="off"
          className={cn(FIELD_CLASS, "min-h-11 min-w-0 flex-1 resize-none overflow-y-auto")}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
            e.preventDefault()
            submit()
          }}
        />
        <Button type="submit" size="sm" variant="primary" aria-disabled={value.trim() === "" || undefined}>
          {C.send}
        </Button>
      </div>
      <p id={noteId} className="text-[11px] leading-snug text-muted-foreground">
        {C.composerNote}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}

/**
 * "[DEMO] connect to the internet" beside messages that wait in the outbox for a path (none planned):
 * the gateway flushes them. A message in its short outbox window on the way to a reachable hub is not
 * waiting, so the block never flickers in after a send.
 */
function OutboxWaiting({ count, onConnect }: { count: number; onConnect: () => void }) {
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const internet = useDemo(selectInternet)
  if (count === 0 || internet === "connected") return null
  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
      <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{C.outboxWaiting}</p>
      <div className="flex flex-wrap items-center gap-2">
        <DemoButton
          onClick={() => {
            onConnect()
            dispatch({ type: "core/internetConnected", instant: reduced })
          }}
        >
          {DEMO_ACTIONS.internet}
        </DemoButton>
        <RouteButtonLink to={PATHS.service("gateway")} size="sm">
          {C.gatewayLink}
        </RouteButtonLink>
      </div>
    </div>
  )
}

export default function ThreadView({ peer, autoFocus }: { peer: string; autoFocus: boolean }) {
  const state = useDemo(selectMessages)
  const now = useDemo(selectNow)
  const advanced = useDemo(selectMode) === "advanced"
  const dispatch = useDispatch()
  const announce = useAnnounce()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const [accepted, setAccepted] = useState(false)

  const thread = state.threads.find((t) => t.peer === peer) ?? null
  const messages = useMemo(() => threadMessages(state, peer), [state, peer])
  const request = useMemo(() => (thread?.kind === "request" ? (requestItems(state).find((r) => r.peer === peer) ?? null) : null), [state, thread, peer])
  const name = thread ? threadName(thread) : C.conversationFallback

  // Arriving here from the list (a move inside this view): focus lands on the title.
  useEffect(() => {
    if (autoFocus) titleRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  // Follow the newest message unless the reader scrolled up.
  const count = messages.length
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [count])
  const onScroll = () => {
    const el = listRef.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_SLACK_PX
  }

  const cancel = (m: DemoMessage) => {
    dispatch({ type: "messages/cancel", id: m.id })
    announce(C.announce.cancelled)
    // The cancel control goes with the step: the conversation keeps the focus.
    listRef.current?.focus({ preventScroll: true })
  }

  const back = (
    <RouteButtonLink to={PATHS.messages} size="sm">
      {C.allMessages}
    </RouteButtonLink>
  )
  const header = <ViewHeader kicker={C.conversationKicker} title={name} end={back} headingRef={titleRef} />

  if (!thread) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Empty kicker={C.notFoundKicker} title={C.notFoundTitle}>
          {C.notFoundBody}
        </Empty>
      </div>
    )
  }

  const gate = composeGate(thread)
  return (
    <div className="flex flex-col gap-6">
      {header}
      <MessagingBanner />
      {advanced ? (
        <div className="flex flex-wrap items-center gap-2 break-all font-mono text-[11px] text-muted-foreground">
          <span>{C.labelLine(thread.label)}</span>
          <CopyButton text={thread.label} ariaLabel={C.copyLabel} />
        </div>
      ) : null}

      {request ? (
        <div className="border border-border">
          <ul>
            <RequestRow
              item={request}
              showPreview={false}
              onDone={(outcome) => {
                if (outcome === "accepted") setAccepted(true)
                // Forgotten: the conversation is gone, the title stays.
                if (outcome === "forgotten") titleRef.current?.focus()
              }}
            />
          </ul>
          {request.ignored ? <p className="border-t border-border px-4 py-2 font-mono text-xs leading-relaxed text-muted-foreground">{C.ignoredHereNote}</p> : null}
        </div>
      ) : null}

      <Panel title="conversation" suffix={name} flush bodyClassName="flex min-h-0 flex-col font-mono">
        <div
          ref={listRef}
          role="log"
          aria-live="off"
          aria-label={C.logLabel(name)}
          tabIndex={0}
          onScroll={onScroll}
          className={cn("flex max-h-[28rem] min-h-48 flex-col gap-4 overflow-y-auto px-4 py-4", FOCUS_RING_INSET)}
        >
          {messages.length === 0 ? (
            <p className="m-auto max-w-prose text-center text-xs leading-relaxed text-muted-foreground">
              {C.emptyThread} {gate.ok ? C.emptyThreadHint : ""}
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {messages.map((m) => (
                <MessageRow key={m.id} m={m} thread={thread} now={now} advanced={advanced} onCancel={cancel} />
              ))}
            </ul>
          )}
        </div>
        <OutboxWaiting count={waitingInOutbox(messages)} onConnect={() => listRef.current?.focus({ preventScroll: true })} />
        {gate.ok ? (
          <Composer peer={peer} focusOnMount={accepted} onSent={() => (pinned.current = true)} />
        ) : (
          <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">{gate.why}</p>
        )}
      </Panel>
    </div>
  )
}
