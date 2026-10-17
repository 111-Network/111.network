// The conversation log (real index.tsx's role="log" list): greeting, transcript, the live reply,
// queued messages and the open proposals, inline where the agent said them. It is the chat's one
// scroll container and follows the newest message unless the reader scrolled up. It announces the
// reply's start and end through the shell's live region (view-local news; no store event).
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import { cn } from "@/lib/utils"
import { AGENT_COPY } from "../../copy/agent"
import { useDemo, useDispatch } from "../../engine/react"
import { openProposals } from "../../engine/selectors"
import { useAnnounce } from "../../shell/context"
import { FOCUS_RING_INSET } from "../../ui/classes"
import { Greeting, LiveBubble, QueuedList, Row } from "./messages"
import { ProposalCards, type Decision } from "./proposals"
import { selectLive, selectQueued, selectRows } from "./select"

const FOLLOW_SLACK_PX = 24

export interface ChatLogProps {
  logRef: RefObject<HTMLDivElement | null>
  onStage: (text: string) => void
  onDecide: (id: string, decision: Decision) => void
  onWhy: (title: string) => void
}

export function ChatLog({ logRef, onStage, onDecide, onWhy }: ChatLogProps) {
  const dispatch = useDispatch()
  const announce = useAnnounce()
  const rows = useDemo(selectRows)
  const live = useDemo(selectLive)
  const queued = useDemo(selectQueued)
  const open = useDemo(openProposals)

  let lastUser: string | null = null
  let lastReply: { key: string; stopped: boolean } | null = null
  for (const r of rows) {
    if (r.role === "user") lastUser = r.key
    else if (r.role === "assistant") lastReply = { key: r.key, stopped: r.stopped }
  }
  const lastReplyKey = lastReply?.key ?? null
  const lastReplyStopped = lastReply?.stopped ?? false
  const liveKey = live?.key ?? null

  // --- follow the newest message unless the reader scrolled up; a new message of yours re-pins it
  const pinned = useRef(true)
  const seenUser = useRef(lastUser)
  const onScroll = () => {
    const el = logRef.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_SLACK_PX
  }
  useLayoutEffect(() => {
    const el = logRef.current
    if (!el) return
    if (seenUser.current !== lastUser) {
      seenUser.current = lastUser
      pinned.current = true
    }
    if (pinned.current) el.scrollTop = el.scrollHeight
  }, [logRef, rows, live, queued, open.length, lastUser])

  // --- "agent is replying" / "reply complete" (not on mount: only what happens while you look)
  const seen = useRef<{ live: string | null; reply: string | null } | null>(null)
  useEffect(() => {
    const prev = seen.current
    seen.current = { live: liveKey, reply: lastReplyKey }
    if (!prev) return
    if (lastReplyKey !== null && lastReplyKey !== prev.reply) announce(lastReplyStopped ? AGENT_COPY.announce.stopped : AGENT_COPY.announce.complete)
    else if (liveKey !== null && liveKey !== prev.live) announce(AGENT_COPY.announce.replying)
  }, [liveKey, lastReplyKey, lastReplyStopped, announce])

  const empty = rows.length === 0 && live === null && queued.length === 0
  return (
    <div
      ref={logRef}
      role="log"
      aria-live="off"
      aria-label={AGENT_COPY.log}
      tabIndex={0}
      onScroll={onScroll}
      className={cn("relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4", FOCUS_RING_INSET)}
    >
      {empty ? <Greeting onStage={onStage} /> : null}
      {rows.map((r) => (
        <Row key={r.key} row={r} onStage={onStage} />
      ))}
      {live ? <LiveBubble live={live} /> : null}
      <QueuedList queued={queued} onRemove={(id) => dispatch({ type: "agent/removeQueued", id })} />
      <ProposalCards proposals={open} onDecide={onDecide} onWhy={onWhy} />
    </div>
  )
}
