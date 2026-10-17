// Module-scope selectors of the Bridge page (useDemo keys its cache on the selector's identity).
// Each returns an existing reference or a primitive, so the page re-renders only when that part changes.
import type { RadioBoard, TransportState } from "../../../engine/core"
import { latestEvent } from "../../../engine/selectors"
import type { BridgeState } from "../../../engine/slices/bridge"
import type { DemoState } from "../../../engine/slices"

export const selectRadioBoard = (s: DemoState): RadioBoard | null => s.core.radio
export const selectTransport = (s: DemoState): TransportState => s.core.transport
export const selectBridgeSlice = (s: DemoState): BridgeState => s.bridge
export const selectBridgePaused = (s: DemoState): boolean => s.bridge.paused

/** Virtual ms of the latest "network-joined" event (heartbeats started), or null. */
export const selectJoinedAt = (s: DemoState): number | null => latestEvent(s, "network-joined")?.at ?? null
