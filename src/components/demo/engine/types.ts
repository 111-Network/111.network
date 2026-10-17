// Shared engine types (plan §6.5 "Store"). Plain TS: no React, no Next, safe in vitest (node).
//
// The demo state is split into SLICES (engine/slices/*.ts) so parallel view work never edits the
// same file. This module holds the vocabulary every slice shares: ids, causes, the reducer
// context and the "needs you" item shape.
import type { DeviceId } from "@/lib/devices"
import type { LayerNumber } from "@/lib/layers"
import type { Rng } from "@/lib/prng"
import type { CoreState } from "./core"
import type { DemoAction, DemoState, SliceName } from "./slices"
import type { World } from "./world"

export type { DeviceId, LayerNumber }

/** Interface density (real dashboard `lib/mode.tsx`): density only, never a security boundary. */
export type UiMode = "simple" | "advanced"

/**
 * How the shell lays out its sidebar. "auto" = the shell measures its own root (ResizeObserver,
 * never the viewport) and picks docked / rail / drawer; the other three force one layout
 * (the L4 teaser uses "rail").
 */
export type LayoutPref = "auto" | "rail" | "docked" | "drawer"

/** "url" reads and writes location.hash (/demo). "memory" never touches location (the L4 teaser). */
export type RouterKind = "url" | "memory"

/** Service registry ids (real `ServiceId`, renamed to plain words; see world.ts). */
export type ServiceId = "agent" | "model" | "mesh" | "radio" | "kb" | "gateway" | "messaging" | "bridge" | "storage" | "repairs"

/** Real `ServiceState`. A StatusDot renders it ("starting" = grey + blink). */
export type ServiceState = "live" | "unset" | "starting" | "error"

/** Every node of the sample world. "workshop-laptop" is this node. */
export type CastId = "workshop-laptop" | "ada" | "bram" | "workshop-hub" | "ridge-repeater" | "valley-hub"

/** Every node except this one. */
export type PeerId = Exclude<CastId, "workshop-laptop">

/** How something was heard or reached. */
export type Medium = "wifi" | "bluetooth" | "radio" | "internet"

/** The preferred networks of Layer 6, tried in this order. */
export type NetworkId = "network-a" | "network-b" | "network-c"

/** What a preferred network looked like on the last try (the L6 seek ladder). */
export type NetworkTry = "not tried" | "trying" | "no signal" | "found"

/**
 * The attached radio board's life (plan §6.4 Devices): plugged in -> allowed once (identifying) ->
 * identified (no usable firmware) -> flashing -> flashed -> region set ("ready"). No board = null.
 */
export type RadioStage = "plugged" | "identifying" | "identified" | "flashing" | "flashed" | "ready"

/**
 * Named causes. Every incoming demo item and every radar blip cites one (W14: motion only with a
 * cause). Slices that need a cause not listed here use their own namespace, e.g. "storage/pruned",
 * and must then pass `text` when they emit it.
 */
export type KnownCause =
  | "welcome"
  | "radio-plugged"
  | "radio-identified"
  | "radio-flashed"
  | "radio-ready"
  | "network-joined"
  | "message-sent"
  | "custody-ack"
  | "delivered"
  | "reply"
  | "internet-connected"
  | "internet-lost"
  | "queue-flushed"
  | "listen-burst"
  | "fault"
  | "diagnosed"
  | "sandbox-passed"
  | "sandbox-rejected"
  | "fix-applied"
  | "fix-shared"
  | "update-check"
  | "update-healthy"
  | "update-rolled-back"
  | "map-fetched"
  | "proposal-added"
  | "proposal-accepted"
  | "proposal-dismissed"
  | "proposal-blocked"
  | "node-heard"
  | "service-live"
  | "service-error"

export type CauseId = KnownCause | `${SliceName}/${string}`

/** One entry of the core events log (newest last). `at` is virtual ms (see clock.ts). */
export interface DemoEvent {
  /** 1, 2, 3 … in emit order; never reused. */
  seq: number
  cause: CauseId
  at: number
  /** One plain sentence for activity lines. */
  text: string
  /** What it is about: a PeerId, ServiceId, NetworkId, proposal id, message id … or null. */
  ref: string | null
}

/** One row of Overview's "needs you" block (real `views/overview/model.ts` NeedItem, plus "setup"). */
export interface NeedItem {
  /** Stable React key, e.g. "proposal:repairs-fix-1", "service:mesh", "requests". */
  key: string
  /**
   * proposal / service (in error) / device (in error) / request: counted by the header badge.
   * setup: a NOT SET service the agent can set up now; listed, never counted (real attention rule).
   */
  kind: "proposal" | "service" | "device" | "request" | "setup"
  label: string
  detail: string
  /** Route path without the "#", e.g. "/services/radio". */
  href: string
  /** What it adds to the header badge: 1 per item, N for "N message requests", 0 for setup rows. */
  count: number
}

/** The shared empty "needs you" list: return it from needs<Name>() when a slice adds nothing. */
export const NO_NEEDS: readonly NeedItem[] = []

export interface ScheduleOptions {
  /** A second schedule with the same key replaces the pending one; cancel(key) drops it. */
  key?: string
}

export interface EmitOptions {
  /** Defaults to the cause's sentence in copy/core.ts EVENT_TEXT (required for namespaced causes). */
  text?: string
  ref?: string | null
}

/**
 * What every reducer receives besides its state and the action. Reducers stay pure: these
 * helpers only RECORD effects. The store applies them once the whole reduceDemo call has returned:
 * schedule/cancel in call order, then dispatch/emit follow-ups (queued in call order, run in the
 * same tick). If any reducer throws, nothing it recorded is applied.
 */
export interface ReduceCtx {
  readonly world: World
  /** Virtual time of this action (ms since the demo epoch, see clock.ts). */
  readonly now: number
  /** The whole state before this action (read-only). */
  readonly prev: Readonly<DemoState>
  /** Dispatch `action` after `delayMs` of virtual time, through the pausable scheduler. Same key = replaces the pending one. */
  schedule(delayMs: number, action: DemoAction, opts?: ScheduleOptions): void
  /** Drop a pending scheduled action by key. */
  cancel(key: string): void
  /** Dispatch a follow-up action right after this one (same tick, before listeners hear anything). */
  dispatch(action: DemoAction): void
  /** Append a caused event to the core log (a "core/emitEvent" follow-up, so every slice sees it). */
  emit(cause: CauseId, opts?: EmitOptions): void
  /** A seeded generator, deterministic for (seed, virtual time). Never Math.random. */
  rng(seed: string): Rng
}

/** A slice reducer's context: ReduceCtx plus the core state AFTER core reduced this action. */
export interface SliceCtx extends ReduceCtx {
  readonly core: Readonly<CoreState>
}
