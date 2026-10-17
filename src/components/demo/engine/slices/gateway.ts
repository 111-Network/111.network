// Internet gateway slice (#/services/gateway, Layer 7; plan §6.4 "Presence + Internet gateway").
// The gateway is an OVERLAY role, earned by reaching the internet (os/README.md Layer 7): the
// internet itself and the gateway service live in core ("[DEMO] connect to the internet" dispatches
// core/internetConnected; core/internetLost makes this node a pure mesh node again), and the node
// chip never changes for it. The messages slice flushes its own queue on the core event and emits
// "queue-flushed". This slice only keeps the page's record of it: one session per time online,
// with when it began, when it ended, and when the waiting messages went out during it.
import { NO_NEEDS, type NeedItem, type SliceCtx } from "../types"
import type { DemoAction } from "./index"

export interface GatewaySession {
  /** 1, 2, 3 … one per time online, never reused. */
  n: number
  /** Virtual ms the internet was reached. */
  from: number
  /** Virtual ms it was lost; null while still online. */
  to: number | null
  /** Virtual ms of the first "queue-flushed" while online, or null. */
  flushedAt: number | null
}

export interface GatewayState {
  seq: number
  /** Oldest first, at most SESSION_LIMIT. */
  sessions: readonly GatewaySession[]
}

/** The gateway page offers no actions of its own: it dispatches the core internet actions. */
export type GatewayAction = never

/** The page keeps the newest this many sessions. */
export const SESSION_LIMIT = 20

export function initialGateway(): GatewayState {
  return { seq: 0, sessions: [] }
}

/** The session that is still open (this node is online), or null. */
export function openSession(state: GatewayState): GatewaySession | null {
  const last = state.sessions[state.sessions.length - 1]
  return last && last.to === null ? last : null
}

function replaceLast(state: GatewayState, session: GatewaySession): GatewayState {
  return { ...state, sessions: [...state.sessions.slice(0, -1), session] }
}

export function reduceGateway(state: GatewayState, action: DemoAction, ctx: SliceCtx): GatewayState {
  const was = ctx.prev.core.internet
  const is = ctx.core.internet
  switch (action.type) {
    case "core/internetConnected": {
      if (was === is || is !== "connected") return state
      const n = state.seq + 1
      const session: GatewaySession = { n, from: ctx.now, to: null, flushedAt: null }
      const kept = state.sessions.length >= SESSION_LIMIT ? state.sessions.slice(state.sessions.length - SESSION_LIMIT + 1) : state.sessions
      return { seq: n, sessions: [...kept, session] }
    }
    case "core/internetLost": {
      const open = openSession(state)
      if (was === is || is !== "offline" || !open) return state
      return replaceLast(state, { ...open, to: ctx.now })
    }
    case "core/emitEvent": {
      const open = openSession(state)
      if (action.cause !== "queue-flushed" || !open || open.flushedAt !== null) return state
      return replaceLast(state, { ...open, flushedAt: ctx.now })
    }
    default:
      return state
  }
}

export function needsGateway(): readonly NeedItem[] {
  return NO_NEEDS
}
