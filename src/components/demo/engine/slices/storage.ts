// Storage slice (#/services/storage, Layer 8; plan §6.4 Storage, W3, §6.8). Owned by the Storage view.
//
// This node's own encrypted store, as a handful of items in four classes (your history, messages
// carried for others, public data you can fetch again, updates). Sizes are internal units for the
// gauge and are NEVER printed: the page speaks in words only.
//
// Rules (os/README.md layer 8, os/50-messaging/README.md §10.4, home L8):
// - Pruning by capacity only. Nothing expires on a timer; nothing happens while idle.
// - When new data pushes the store past the line, room is freed in a fixed order:
//     1 copies already handed over + public data you can fetch again
//     2 superseded updates
//     3 your own history, oldest first, after an export is offered (only when 1 and 2 cannot make room)
//     4 NEVER anything not yet delivered, yours or carried for others
//   Within a rule: old and large first (weight = size × age, age counted in arrivals, never a clock).
// - Public data you can fetch again never pushes out your history: if rules 1 and 2 cannot make
//   room for it, it is not kept ("declined").
//
// The one demo flow: "[DEMO] fetch the regional map" from the home hub over Wi-Fi (never over a
// long-range relay path). asking -> receiving (the gauge fills one piece per step) -> a caused prune
// when the map pushes the store past the line -> checking -> stored ("map-fetched", and the home hub
// blips on Nearby as the home link). Every step goes through the scheduler (one key); with `instant`
// (reduced motion) the whole flow lands in the same dispatch. If the storage service stops mid-way,
// the fetch pauses and picks up where it left off once the store is live again.
import { STORAGE_COPY } from "../../copy/storage"
import type { CoreState } from "../core"
import { NO_NEEDS, type NeedItem, type SliceCtx } from "../types"
import { nodeName, type World } from "../world"
import type { DemoAction } from "."

// ------------------------------------------------------------------------------------- model

/** What one stored item is. */
export type StoreKind =
  /** your own history, delivered */
  | "history"
  /** carried for another node, not yet delivered */
  | "carried"
  /** carried for another node, already handed over */
  | "handed"
  /** public data fetched from a hub earlier */
  | "public"
  /** the regional map (public data you can fetch again) */
  | "map"
  /** the update this node runs */
  | "update"
  /** an update a newer one replaced */
  | "superseded"

/** A rule of the order that may free an item. */
export type FreeRule = 1 | 2 | 3

/** Where an item sits in the free-space order: freeable by rule 1–3, never freed, or kept (the update in use). */
export type StoreRule = FreeRule | "never" | "kept"

export const KIND_RULE: Readonly<Record<StoreKind, StoreRule>> = {
  history: 3,
  carried: "never",
  handed: 1,
  public: 1,
  map: 1,
  update: "kept",
  superseded: 2,
}

/** The four classes the page lists. */
export type StoreClassId = "history" | "carried" | "public" | "updates"

export const KIND_CLASS: Readonly<Record<StoreKind, StoreClassId>> = {
  history: "history",
  carried: "carried",
  handed: "carried",
  public: "public",
  map: "public",
  update: "updates",
  superseded: "updates",
}

export interface StoreItem {
  id: string
  kind: StoreKind
  /** Internal size for the gauge; never printed. */
  units: number
  /** Arrival order (lower = older); the age of an item, never a clock. */
  seq: number
}

export interface FreedItem {
  id: string
  kind: StoreKind
  units: number
  rule: FreeRule
}

/** Internal sizes (never printed): the gauge draws one bar per unit. */
export const STORE_CAPACITY = 32
/** The line past which space runs short (the real high watermark). */
export const STORE_PRESSURE = 24
/** The regional map, and the piece that arrives per step. */
export const MAP_UNITS = 8
export const MAP_PIECE = 2

/** Virtual ms of each fetch step (all through the scheduler). */
export const STORAGE_TIMING = {
  askMs: 900,
  pieceMs: 700,
  /** How long the overshoot past the line shows before the prune frees room. */
  pruneMs: 1200,
  checkMs: 900,
} as const

/** The one scheduler key of the fetch (a new step replaces the pending one). */
export const FETCH_KEY = "storage:fetch"

export type FetchPhase = "idle" | "asking" | "receiving" | "pruning" | "checking" | "done" | "declined" | "paused"

/** The phases that have a step pending. */
export type RunningPhase = "asking" | "receiving" | "pruning" | "checking"

export interface FetchState {
  phase: FetchPhase
  /** Units of the map already received (held as pieces until it is checked). */
  received: number
  /** The phase to go back to after a pause. */
  resume: RunningPhase | null
  /** The prune of this fetch already ran (one per fetch: it frees room for the whole map). */
  pruned: boolean
  /** Reduced motion: every later step lands at once. */
  instant: boolean
}

export interface StoragePrune {
  freed: readonly FreedItem[]
  /** How high the store reached before the prune (the gauge's dashed overshoot). */
  peak: number
}

export interface FreeLogEntry {
  id: string
  at: number
  /** Freed items (empty for a declined map). */
  freed: readonly FreedItem[]
  declined: boolean
}

export interface StorageState {
  /** Slice-local id counter (items and log entries). */
  seq: number
  items: readonly StoreItem[]
  fetch: FetchState
  /** The last prune, or null. Rule 3 (and its export offer) never runs in the map flow: public data never pushes out history. */
  last: StoragePrune | null
  /** Newest last. */
  log: readonly FreeLogEntry[]
}

export type StorageAction =
  | { type: "storage/fetchMap"; instant?: boolean }
  /** One step of the fetch (scheduled under FETCH_KEY; never dispatched by a view). */
  | { type: "storage/step" }

// ----------------------------------------------------------------------------------- helpers

const RUNNING: ReadonlySet<FetchPhase> = new Set<FetchPhase>(["asking", "receiving", "pruning", "checking"])

export const isRunning = (phase: FetchPhase): phase is RunningPhase => RUNNING.has(phase)

/** Units held by stored items (the map's pieces not included). */
export function itemUnits(items: readonly StoreItem[]): number {
  return items.reduce((n, item) => n + item.units, 0)
}

/** Units in use: stored items plus the map's pieces received so far. */
export function usedUnits(state: Pick<StorageState, "items" | "fetch">): number {
  return itemUnits(state.items) + state.fetch.received
}

/** The storage service is running (the store is open). */
export function storageLive(core: Pick<CoreState, "services">): boolean {
  return core.services.some((s) => s.id === "storage" && s.state === "live")
}

/** Weight of an item within its rule: size × age (old and large first). `nextSeq` is the next arrival. */
export function weightOf(item: Pick<StoreItem, "units" | "seq">, nextSeq: number): number {
  return item.units * Math.max(1, nextSeq - item.seq)
}

export interface RoomPlan {
  /** The incoming data fits (with `freed` gone). */
  fits: boolean
  /** What to free, in order. Empty when nothing has to go or when it does not fit. */
  freed: FreedItem[]
}

/**
 * Room for `incoming` units of PUBLIC data you can fetch again (the regional map). If the store
 * would end past the line, rules 1 then 2 free items (heaviest first within a rule) until it does
 * not. Public data never pushes out your history (rule 3) and nothing not yet delivered is ever
 * freed: if it still would not fit within capacity, nothing is freed and it is not kept.
 */
export function planRoom(items: readonly StoreItem[], incoming: number, nextSeq: number): RoomPlan {
  const total = itemUnits(items) + incoming
  const need = total - STORE_PRESSURE
  if (need <= 0) return { fits: total <= STORE_CAPACITY, freed: [] }
  const freed: FreedItem[] = []
  let room = 0
  for (const rule of [1, 2] as const) {
    const candidates = items
      .filter((item) => KIND_RULE[item.kind] === rule)
      .slice()
      .sort((a, b) => weightOf(b, nextSeq) - weightOf(a, nextSeq) || a.seq - b.seq)
    for (const item of candidates) {
      if (room >= need) break
      freed.push({ id: item.id, kind: item.kind, units: item.units, rule })
      room += item.units
    }
  }
  if (total - room > STORE_CAPACITY) return { fits: false, freed: [] }
  return { fits: true, freed }
}

/** Plain words for what a prune freed, grouped by kind in the order freed: "a (rule 1), b (rule 1) and c (rule 2)". */
export function freedWords(freed: readonly Pick<FreedItem, "kind">[]): string {
  const kinds: StoreKind[] = []
  for (const item of freed) if (!kinds.includes(item.kind)) kinds.push(item.kind)
  const words = kinds.map((kind) => {
    const w = STORAGE_COPY.freed
    switch (kind) {
      case "handed":
        return w.handed
      case "public":
        return w.public
      case "map":
        return w.map
      case "superseded":
        return w.superseded
      case "history":
        return w.history
      default:
        // carried (never) and update (kept) are never freed; listed for completeness.
        return STORAGE_COPY.classes.kinds[kind]
    }
  })
  if (words.length <= 1) return words.join("")
  return `${words.slice(0, -1).join(STORAGE_COPY.freed.comma)}${STORAGE_COPY.freed.and}${words[words.length - 1]}`
}

/** The home hub's display name (the fetch is always from it, over Wi-Fi). */
export const homeHubName = (world: World): string => nodeName(world, world.homeHub)

/**
 * The sentence for where the fetch is now (the view's narration line; the slice emits the same
 * words for the shell's live region). Null while idle: the page then shows where the map comes from.
 */
export function fetchLine(state: Pick<StorageState, "fetch" | "last">, hub: string): string | null {
  switch (state.fetch.phase) {
    case "idle":
      return null
    case "asking":
      return STORAGE_COPY.fetch.started(hub)
    case "receiving":
      return state.fetch.pruned && state.last ? STORAGE_COPY.fetch.pruned(freedWords(state.last.freed)) : STORAGE_COPY.fetch.receiving(hub)
    case "pruning":
      return STORAGE_COPY.fetch.crossing
    case "checking":
      return STORAGE_COPY.fetch.checking
    case "done":
      return STORAGE_COPY.fetch.done
    case "declined":
      return STORAGE_COPY.fetch.declined
    case "paused":
      return STORAGE_COPY.fetch.paused
  }
}

// ------------------------------------------------------------------------------------ initial

/** The store when the demo opens: below the line, with something in every class. Oldest first. */
const OPENING: readonly Omit<StoreItem, "id">[] = [
  { kind: "superseded", units: 3, seq: 1 },
  { kind: "history", units: 4, seq: 2 },
  { kind: "update", units: 3, seq: 3 },
  { kind: "handed", units: 2, seq: 4 },
  { kind: "public", units: 2, seq: 5 },
  { kind: "history", units: 6, seq: 6 },
  { kind: "carried", units: 2, seq: 7 },
]

export function initialStorage(): StorageState {
  return {
    seq: OPENING.length,
    items: OPENING.map((item) => ({ ...item, id: `s${item.seq}` })),
    fetch: { phase: "idle", received: 0, resume: null, pruned: false, instant: false },
    last: null,
    log: [],
  }
}

// ------------------------------------------------------------------------------------ reducer

/** The next step: through the scheduler, or (instant) right away in the same dispatch. */
function next(ctx: SliceCtx, instant: boolean, ms: number): void {
  if (instant) {
    ctx.cancel(FETCH_KEY)
    ctx.dispatch({ type: "storage/step" })
  } else {
    ctx.schedule(ms, { type: "storage/step" }, { key: FETCH_KEY })
  }
}

/** How long the step after `phase` waits. */
function delayAfter(phase: RunningPhase): number {
  switch (phase) {
    case "asking":
      return STORAGE_TIMING.askMs
    case "receiving":
      return STORAGE_TIMING.pieceMs
    case "pruning":
      return STORAGE_TIMING.pruneMs
    case "checking":
      return STORAGE_TIMING.checkMs
  }
}

/** One piece of the map arrives; past the line (first time) the prune is due next. */
function receivePiece(state: StorageState, ctx: SliceCtx): StorageState {
  const fetch = { ...state.fetch, received: Math.min(MAP_UNITS, state.fetch.received + MAP_PIECE) }
  const after = { ...state, fetch }
  if (!fetch.pruned && usedUnits(after) > STORE_PRESSURE) {
    next(ctx, fetch.instant, STORAGE_TIMING.pruneMs)
    return { ...after, fetch: { ...fetch, phase: "pruning" } }
  }
  if (fetch.received >= MAP_UNITS) {
    next(ctx, fetch.instant, STORAGE_TIMING.checkMs)
    return { ...after, fetch: { ...fetch, phase: "checking" } }
  }
  next(ctx, fetch.instant, STORAGE_TIMING.pieceMs)
  return { ...after, fetch: { ...fetch, phase: "receiving" } }
}

/** The caused prune: room for the whole map in the fixed order, or the map is not kept. */
function prune(state: StorageState, ctx: SliceCtx): StorageState {
  const peak = usedUnits(state)
  const plan = planRoom(state.items, MAP_UNITS, state.seq + 1)
  const id = `f${state.seq + 1}`
  if (!plan.fits) {
    ctx.emit("storage/declined", { text: STORAGE_COPY.events.declined, ref: "storage" })
    return {
      ...state,
      seq: state.seq + 1,
      fetch: { ...state.fetch, phase: "declined", received: 0, pruned: true },
      last: null,
      log: [...state.log, { id, at: ctx.now, freed: [], declined: true }],
    }
  }
  const gone = new Set(plan.freed.map((f) => f.id))
  const pruned: StorageState = {
    ...state,
    seq: state.seq + 1,
    items: state.items.filter((item) => !gone.has(item.id)),
    fetch: { ...state.fetch, pruned: true },
    last: { freed: plan.freed, peak },
    log: plan.freed.length > 0 ? [...state.log, { id, at: ctx.now, freed: plan.freed, declined: false }] : state.log,
  }
  if (plan.freed.length > 0) ctx.emit("storage/pruned", { text: STORAGE_COPY.events.pruned(freedWords(plan.freed)), ref: "storage" })
  if (pruned.fetch.received >= MAP_UNITS) {
    next(ctx, pruned.fetch.instant, STORAGE_TIMING.checkMs)
    return { ...pruned, fetch: { ...pruned.fetch, phase: "checking" } }
  }
  next(ctx, pruned.fetch.instant, STORAGE_TIMING.pieceMs)
  return { ...pruned, fetch: { ...pruned.fetch, phase: "receiving" } }
}

/** The map checked out: it becomes one stored item of public data you can fetch again. */
function store(state: StorageState, ctx: SliceCtx): StorageState {
  const seq = state.seq + 1
  ctx.emit("map-fetched", { ref: ctx.world.homeHub })
  // The hub answered over Wi-Fi: one blip of the home link on Nearby, with this cause (map-fetched says it).
  ctx.dispatch({ type: "core/heardNode", id: ctx.world.homeHub, via: "wifi", cause: "map-fetched", quiet: true })
  return {
    ...state,
    seq,
    items: [...state.items, { id: `s${seq}`, kind: "map", units: MAP_UNITS, seq }],
    fetch: { ...state.fetch, phase: "done", received: 0 },
  }
}

function step(state: StorageState, ctx: SliceCtx): StorageState {
  switch (state.fetch.phase) {
    case "asking":
    case "receiving":
      return receivePiece(state, ctx)
    case "pruning":
      return prune(state, ctx)
    case "checking":
      return store(state, ctx)
    default:
      return state // idle, done, declined, paused: a stale step does nothing
  }
}

export function reduceStorage(state: StorageState, action: DemoAction, ctx: SliceCtx): StorageState {
  const live = storageLive(ctx.core)

  // The store stopped mid-fetch (a fault, a restart): the fetch pauses, nothing is lost.
  if (isRunning(state.fetch.phase) && !live) {
    ctx.cancel(FETCH_KEY)
    ctx.emit("storage/fetch-paused", { text: STORAGE_COPY.events.paused, ref: "storage" })
    return { ...state, fetch: { ...state.fetch, phase: "paused", resume: state.fetch.phase } }
  }
  // It is back: pick up where it left off.
  if (state.fetch.phase === "paused" && live && state.fetch.resume) {
    const resume = state.fetch.resume
    next(ctx, state.fetch.instant, delayAfter(resume))
    ctx.emit("storage/fetch-resumed", { text: STORAGE_COPY.events.resumed, ref: "storage" })
    return { ...state, fetch: { ...state.fetch, phase: resume, resume: null } }
  }

  switch (action.type) {
    case "storage/fetchMap": {
      if (state.fetch.phase !== "idle" || !live) return state
      const instant = action.instant === true
      ctx.emit("storage/fetch-started", { text: STORAGE_COPY.fetch.started(homeHubName(ctx.world)), ref: ctx.world.homeHub })
      next(ctx, instant, STORAGE_TIMING.askMs)
      return { ...state, fetch: { phase: "asking", received: 0, resume: null, pruned: false, instant } }
    }
    case "storage/step":
      return step(state, ctx)
    default:
      return state
  }
}

/** Storage adds no "needs you" rows: a full store is the service's own ERROR, which core already counts. */
export function needsStorage(): readonly NeedItem[] {
  return NO_NEEDS
}
