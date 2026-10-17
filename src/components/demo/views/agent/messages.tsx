// Transcript rows, the live (streaming) bubble, queued messages and the empty-state greeting
// (real views/agent/messages.tsx). Every agent reply carries the "demo reply" note (W14).
import { memo } from "react"
import { cn } from "@/lib/utils"
import { AGENT_COPY, AGENT_STARTERS } from "../../copy/agent"
import { useDemo } from "../../engine/react"
import { selectServices } from "../../engine/selectors"
import { liveText, liveTools, type AgentLive, type AgentQueued, type AgentRow } from "../../engine/slices/agent"
import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"
import { DemoNote } from "../../ui/demo-note"
import { StatusDot } from "../../ui/status-dot"

function Prompt() {
  return (
    <span aria-hidden="true" className="select-none text-muted-foreground">
      {">"}
    </span>
  )
}

/** The tool lines a reply used, before its text (they arrive first while it streams). */
function ToolLines({ tools }: { tools: readonly string[] }) {
  if (tools.length === 0) return null
  return (
    <ul className="mb-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
      {tools.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  )
}

function ReplyNote() {
  return (
    <div className="mb-1 flex">
      <DemoNote kind="reply" />
    </div>
  )
}

/** The four starters as buttons. A button only fills the message box. */
export function StarterButtons({ onStage, className }: { onStage: (text: string) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {AGENT_STARTERS.map((s) => (
        <Button key={s.id} size="sm" onClick={() => onStage(s.text)}>
          {s.label}
        </Button>
      ))}
    </div>
  )
}

/** A decision on a proposal this chat wrote; an accepted one shows its service's state as it moves. */
function NoteRow({ row }: { row: AgentRow }) {
  const services = useDemo(selectServices)
  const target = row.target ? services.find((s) => s.id === row.target) : undefined
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="min-w-0 break-words">{row.text}</span>
      {target ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-foreground">{target.name}</span>
          <StatusDot state={target.state} />
        </span>
      ) : null}
    </div>
  )
}

export const Row = memo(function Row({ row, onStage }: { row: AgentRow; onStage: (text: string) => void }) {
  if (row.role === "user") {
    return (
      <div className="flex gap-2">
        <Prompt />
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-muted-foreground">
          <span className="sr-only">{AGENT_COPY.sr.you}</span>
          {row.text}
        </p>
      </div>
    )
  }
  if (row.role === "note") return <NoteRow row={row} />
  return (
    <div className="border-s border-border ps-3">
      <ReplyNote />
      <ToolLines tools={row.tools} />
      {row.text.trim() !== "" ? (
        <p className="whitespace-pre-wrap break-words text-foreground">
          <span className="sr-only">{AGENT_COPY.sr.agent}</span>
          {row.text.trimEnd()}
        </p>
      ) : null}
      {row.stopped ? <p className="mt-1 text-xs text-muted-foreground">{AGENT_COPY.stopped}</p> : null}
      {row.starters ? <StarterButtons onStage={onStage} className="mt-3" /> : null}
    </div>
  )
})

/** The reply being streamed: tool lines so far, the text so far and a block cursor. */
export function LiveBubble({ live }: { live: AgentLive }) {
  return (
    <div className="border-s border-foreground ps-3">
      <ReplyNote />
      <ToolLines tools={liveTools(live)} />
      <p className="whitespace-pre-wrap break-words text-foreground">
        <span className="sr-only">{AGENT_COPY.sr.replying}</span>
        {liveText(live)}
        <span aria-hidden="true" className="animate-blink">
          {"█"}
        </span>
      </p>
    </div>
  )
}

export function QueuedList({ queued, onRemove }: { queued: readonly AgentQueued[]; onRemove: (id: string) => void }) {
  if (queued.length === 0) return null
  return (
    <ul aria-label={AGENT_COPY.queued.list} className="flex flex-col gap-3">
      {queued.map((q) => (
        <li key={q.id} className="flex flex-wrap items-start gap-2">
          <Prompt />
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-muted-foreground">
            <span className="sr-only">{AGENT_COPY.sr.queued}</span>
            {q.text}
          </p>
          <span className="flex shrink-0 items-center gap-2">
            <Badge>{AGENT_COPY.queued.badge}</Badge>
            <Button size="sm" onClick={() => onRemove(q.id)} aria-label={AGENT_COPY.queued.removeAria}>
              {AGENT_COPY.queued.remove}
            </Button>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** First-message area: not a chat message, just a nudge with prepared starting points. */
export function Greeting({ onStage }: { onStage: (text: string) => void }) {
  return (
    <div className="border border-dashed border-border p-4">
      <p className="max-w-prose text-muted-foreground">{AGENT_COPY.greeting.lead(AGENT_STARTERS.map((s) => s.label))}</p>
      <StarterButtons onStage={onStage} className="mt-3" />
      <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">{AGENT_COPY.greeting.hint}</p>
    </div>
  )
}
