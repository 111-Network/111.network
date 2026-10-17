// Agent (#/, Layers 3 and 4; real views/agent/index.tsx): a plain chat box to the node's local AI.
// The conversation lives in the agent slice (engine/slices/agent.ts), so a reply keeps streaming
// while another page is open and the transcript is still there on return. The chat fills the shell:
// the panel is `flex min-h-0 flex-1 flex-col` and the log is its one scroll container.
import { useCallback, useEffect, useMemo, useRef } from "react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { AGENT_COPY } from "../../copy/agent"
import { useDemo, useDemoStore, useDispatch, useWorld } from "../../engine/react"
import { selectServices } from "../../engine/selectors"
import { agentStateOf, conversationLabel, stateNoticeFor } from "../../engine/slices/agent"
import { useAnnounce, useHeadingLevel } from "../../shell/context"
import { selectMode } from "../../shell/select"
import { Button } from "../../ui/button"
import { CopyButton } from "../../ui/copy-button"
import { Heading } from "../../ui/heading"
import { Panel } from "../../ui/panel"
import { StatusDot } from "../../ui/status-dot"
import { PreparedBanner, StateNotice } from "./banners"
import { ChatLog } from "./chat-log"
import { Composer, focusEnd } from "./composer"
import type { Decision } from "./proposals"
import { selectConversation, selectHasHistory, selectNotice, selectPrefill, selectPrepared, selectQueuedCount } from "./select"

const C = AGENT_COPY

export default function AgentView() {
  const store = useDemoStore()
  const dispatch = useDispatch()
  const world = useWorld()
  const announce = useAnnounce()
  const reduced = useReducedMotion()
  const level = useHeadingLevel()
  const services = useDemo(selectServices)
  const mode = useDemo(selectMode)
  const prefill = useDemo(selectPrefill)
  const prepared = useDemo(selectPrepared)
  const notice = useDemo(selectNotice)
  const conversation = useDemo(selectConversation)
  const hasHistory = useDemo(selectHasHistory)
  const queuedCount = useDemo(selectQueuedCount)
  const state = useMemo(() => agentStateOf(services), [services])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // A prompt prepared on another page ("Set up with the agent", "Ask the agent about …"): the slice
  // already put it in the message box. Take it and focus the box. It is never sent by itself.
  useEffect(() => {
    if (!prefill) return
    dispatch({ type: "core/prefillTaken" })
    focusEnd(inputRef.current)
  }, [prefill, dispatch])

  // Why a message was queued instead of sent: view-local news for the shell's live region.
  useEffect(() => {
    if (notice) announce(notice)
  }, [notice, announce])

  const send = useCallback((text: string) => dispatch({ type: "agent/send", text, instant: reduced }), [dispatch, reduced])
  const stop = useCallback(() => {
    dispatch({ type: "agent/stop" })
    inputRef.current?.focus()
  }, [dispatch])
  const stage = useCallback((text: string) => dispatch({ type: "agent/stage", text }), [dispatch])
  const why = useCallback((title: string) => dispatch({ type: "agent/stage", text: C.whyPrompt(title) }), [dispatch])
  const decide = useCallback(
    (id: string, decision: Decision) => {
      dispatch(decision === "accepted" ? { type: "core/proposalAccepted", id, instant: reduced } : { type: "core/proposalDismissed", id })
      // Decided: the card is about to go, so focus moves to the conversation. Refused: it stays, focus too.
      if (store.getSnapshot().core.proposals.some((p) => p.id === id && p.decision !== null)) logRef.current?.focus()
    },
    [dispatch, reduced, store],
  )
  const newConversation = () => {
    dispatch({ type: "agent/newConversation" })
    inputRef.current?.focus()
  }

  const label = conversationLabel(world, conversation)
  const chip = (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-2">
        <StatusDot state={state.dot} label={false} name={C.title} />
        <span className="text-foreground">{state.label}</span>
      </span>
      <Button
        size="sm"
        aria-label={C.newConversation.aria}
        {...(hasHistory ? { confirm: C.newConversation.confirm } : {})}
        onClick={newConversation}
        className="@min-[1024px]:min-h-8"
      >
        <span className="@min-[640px]:hidden">{C.newConversation.short}</span>
        <span className="hidden @min-[640px]:inline">{C.newConversation.long}</span>
      </Button>
    </span>
  )

  return (
    <Panel
      title={C.chrome.title}
      suffix={C.chrome.suffix}
      chromeEnd={chip}
      flush
      // Below a 1024 px container the panel is the whole main area (the shell drops its padding and
      // scrolling on this route); from 1024 px it fills main and keeps a floor for short windows.
      className="flex min-h-0 flex-1 flex-col @max-[1024px]:border-x-0 @min-[1024px]:min-h-[26rem]"
      bodyClassName="flex min-h-0 flex-1 flex-col font-mono text-sm leading-relaxed"
    >
      <Heading level={level} className="sr-only">
        {C.title}
      </Heading>
      {mode === "advanced" ? (
        <div className="flex shrink-0 items-center gap-x-3 overflow-hidden whitespace-nowrap border-b border-border px-4 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{C.advanced.model}</span>
          <span className="shrink-0">{C.advanced.serving(state.label)}</span>
          <span className="min-w-0 flex-1 truncate">{C.advanced.conversation(label)}</span>
          <CopyButton text={label} label={C.advanced.copy} ariaLabel={C.advanced.copyAria} className="shrink-0" />
        </div>
      ) : null}

      {prepared ? <PreparedBanner from={prepared.from} onDismiss={() => dispatch({ type: "agent/dismissPrepared" })} /> : null}
      {queuedCount === 0 ? <StateNotice text={stateNoticeFor(state)} /> : null}

      <ChatLog logRef={logRef} onStage={stage} onDecide={decide} onWhy={why} />

      {notice ? <p className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">{notice}</p> : null}

      <Composer inputRef={inputRef} onSend={send} onStop={stop} />
    </Panel>
  )
}
