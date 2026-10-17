// Internet gateway page, pure (React-free): the role this node holds, and the page's log lines.
import { GATEWAY_COPY } from "../../../copy/gateway"
import { formatClock } from "../../../engine/clock"
import type { GatewaySession } from "../../../engine/slices/gateway"
import type { ServiceState } from "../../../engine/types"

export type GatewayRole = "gateway" | "checking" | "mesh node"

/** The overlay role, from the gateway service alone: LIVE = gateway, STARTING = checking, else a pure mesh node. */
export function roleOf(state: ServiceState): GatewayRole {
  return state === "live" ? "gateway" : state === "starting" ? "checking" : "mesh node"
}

/** "09:12 reached the internet: this node is a gateway", then the flush, then the loss, per session, oldest first. */
export function gatewayLog(sessions: readonly GatewaySession[]): string[] {
  const l = GATEWAY_COPY.log
  const lines: string[] = []
  for (const s of sessions) {
    lines.push(`${formatClock(s.from)} ${l.online}`)
    if (s.flushedAt !== null) lines.push(`${formatClock(s.flushedAt)} ${l.flushed}`)
    if (s.to !== null) lines.push(`${formatClock(s.to)} ${l.offline}`)
  }
  return lines
}
