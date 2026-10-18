// The Messages list (real views/messages/list.tsx; os/50-messaging/README.md §16): requests first (they
// need an answer), then conversations, newest activity first. Every row says who, the last line,
// how far the last own message got, and what is unread. Incoming items carry the "demo message"
// note. New messages and requests are announced by the shell from their store events, so this list
// keeps no announcer of its own.
import { useEffect, useId, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { ROUTE_TITLES } from "../../copy/core"
import { MESSAGES_COPY } from "../../copy/messages"
import { DemoLink, useDemo } from "../../engine/react"
import { PATHS } from "../../engine/router"
import { useHeadingLevel } from "../../shell/context"
import { selectMode, selectNow } from "../../shell/select"
import { Badge } from "../../ui/badge"
import { FOCUS_RING, LABEL_CLASS } from "../../ui/classes"
import { DemoNote } from "../../ui/demo-note"
import { Empty } from "../../ui/empty"
import { MessagingBanner } from "./banner"
import { StateGlyph } from "./glyph"
import { conversationSummaries, lastLine, requestItems, unresolved, whenText, type ThreadSummary } from "./model"
import { RequestsSection, type RequestOutcome } from "./requests"
import { selectMessages } from "./select"
import { ViewHeader } from "./view-header"

const C = MESSAGES_COPY

function ThreadRow({ s, now, advanced }: { s: ThreadSummary; now: number; advanced: boolean }) {
  const open = unresolved(s.states)
  const incoming = s.last?.dir === "in"
  return (
    <li className="border-b border-border last:border-b-0">
      <DemoLink
        to={PATHS.conversation(s.thread.peer)}
        className={cn("flex min-h-11 flex-col gap-1 px-4 py-3 font-mono hover:bg-secondary/50 focus-visible:ring-inset", FOCUS_RING)}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("min-w-0 truncate text-sm text-foreground", s.unread > 0 && "font-bold")}>{s.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{s.last ? whenText(s.last.at, now) : ""}</span>
        </span>
        <span className="flex items-center justify-between gap-3">
          <span dir="auto" className="min-w-0 truncate text-xs text-muted-foreground">
            {lastLine(s.last)}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {incoming ? <DemoNote /> : null}
            {s.unread > 0 ? <Badge className="border-foreground text-foreground">{C.unread(s.unread)}</Badge> : null}
            {s.glyph ? <StateGlyph state={s.glyph.state} cancelled={s.glyph.cancelled} /> : null}
          </span>
        </span>
        {advanced ? (
          <span className="break-all text-[11px] text-muted-foreground">
            {s.thread.label}
            {open ? ` · ${C.waiting(open)}` : ""}
          </span>
        ) : null}
      </DemoLink>
    </li>
  )
}

export default function ThreadList({ autoFocus }: { autoFocus: boolean }) {
  const state = useDemo(selectMessages)
  const now = useDemo(selectNow)
  const advanced = useDemo(selectMode) === "advanced"
  const sectionLevel = useHeadingLevel(1)
  const requestsId = useId()
  const conversationsId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const requestsRef = useRef<HTMLHeadingElement>(null)

  const requests = useMemo(() => requestItems(state), [state])
  const conversations = useMemo(() => conversationSummaries(state), [state])

  // Back from a conversation (a move inside this view): focus lands on the title.
  useEffect(() => {
    if (autoFocus) titleRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  // An ignored, restored or forgotten row moves or goes: keep the focus near it.
  const onRequestDone = (outcome: RequestOutcome) => {
    if (outcome === "accepted") return // the conversation opens and takes the focus
    if (outcome === "forgotten" && requests.length === 1) titleRef.current?.focus()
    else requestsRef.current?.focus()
  }

  const Section = `h${sectionLevel}` as const
  return (
    <div className="flex flex-col gap-6">
      <ViewHeader kicker={C.kicker} title={ROUTE_TITLES.messages} headingRef={titleRef} />
      <MessagingBanner />

      <RequestsSection items={requests} level={sectionLevel} headingId={requestsId} headingRef={requestsRef} onDone={onRequestDone} />

      <section aria-labelledby={conversationsId} className="flex flex-col gap-2">
        <Section id={conversationsId} className={LABEL_CLASS}>
          {C.conversationsHeading}
        </Section>
        {conversations.length === 0 ? (
          <Empty title={C.noConversations}>{C.noConversationsBody}</Empty>
        ) : (
          <ul className="border border-border">
            {conversations.map((s) => (
              <ThreadRow key={s.thread.peer} s={s} now={now} advanced={advanced} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
