// Module-scope selectors of the Nearby view and the Internet gateway page (React-free). useDemo
// memoises on a selector's identity, so these live here, never as inline arrows. Each returns an
// existing reference or a primitive.
import type { RadioBoard, TransportState } from "../../engine/core"
import { latestEvent, serviceById } from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import type { DemoEvent, ServiceState } from "../../engine/types"
import type { DemoService } from "../../engine/world"
import type { NearbyState } from "../../engine/slices/nearby"
import type { GatewayState } from "../../engine/slices/gateway"

export const selectNearby = (s: DemoState): NearbyState => s.nearby
export const selectGateway = (s: DemoState): GatewayState => s.gateway
export const selectRadio = (s: DemoState): RadioBoard | null => s.core.radio
export const selectTransport = (s: DemoState): TransportState => s.core.transport
export const selectInternet = (s: DemoState): "offline" | "connected" => s.core.internet
export const selectBlipSeq = (s: DemoState): number => s.core.blipSeq
export const selectRadioService = (s: DemoState): DemoService | undefined => serviceById(s, "radio")
export const selectMeshService = (s: DemoState): DemoService | undefined => serviceById(s, "mesh")
export const selectGatewayService = (s: DemoState): DemoService | undefined => serviceById(s, "gateway")
export const selectGatewayState = (s: DemoState): ServiceState => serviceById(s, "gateway")?.state ?? "unset"

/** seq of the newest "internet-connected" event, 0 when there is none. */
export const selectInternetSeq = (s: DemoState): number => latestEvent(s, "internet-connected")?.seq ?? 0

/** The newest "queue-flushed" event (the messages slice's own sentence), or undefined. */
export const selectLastFlush = (s: DemoState): DemoEvent | undefined => latestEvent(s, "queue-flushed")

/** What the radar knew when it mounted: hears and events up to here never replay their pulse. */
export interface RadarBase {
  blip: number
  /** The virtual clock at mount (the scheduler's, not core.now: core.now stands still between changes). */
  now: number
  event: number
}

export function radarBaseOf(s: DemoState, now: number): RadarBase {
  return { blip: s.core.blipSeq, now, event: s.core.eventSeq }
}
