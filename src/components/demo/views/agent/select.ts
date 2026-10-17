// Module-scope selectors of the Agent view (useDemo memoises on selector identity). React-free.
// Fine-grained on purpose: a streamed word changes only `agent.live`, so only the transcript and
// the composer's send/stop button re-render while a reply streams.
import type { DemoState } from "../../engine/slices"

export const selectRows = (s: DemoState) => s.agent.rows
export const selectLive = (s: DemoState) => s.agent.live
export const selectQueued = (s: DemoState) => s.agent.queued
export const selectNotice = (s: DemoState) => s.agent.notice
export const selectDraft = (s: DemoState) => s.agent.draft
export const selectStaged = (s: DemoState) => s.agent.staged
export const selectPrepared = (s: DemoState) => s.agent.prepared
export const selectConversation = (s: DemoState) => s.agent.conversation
export const selectStreaming = (s: DemoState): boolean => s.agent.live !== null
export const selectQueuedCount = (s: DemoState): number => s.agent.queued.length
/** Something a "new conversation" would drop: it then asks first (real index.tsx). */
export const selectHasHistory = (s: DemoState): boolean => s.agent.rows.length > 0 || s.agent.queued.length > 0
export const selectPrefill = (s: DemoState) => s.core.prefill
