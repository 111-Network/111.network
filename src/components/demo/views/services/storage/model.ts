// What the Storage page draws, computed from the storage slice (pure: no React, tested in node).
// Real source: os/40-interface/ui/src/views/services/store-gauge.tsx (a bar plus "N% · used of
// watermark"); here the bar is the home L8 strip (one bar per internal unit, a tick at the line,
// a dashed overshoot) and the readout is words only. No size, threshold or percentage is printed.
import { STORAGE_COPY } from "../../../copy/storage"
import { formatClock } from "../../../engine/clock"
import {
  KIND_RULE,
  STORE_CAPACITY,
  STORE_PRESSURE,
  freedWords,
  isRunning,
  usedUnits,
  type FreeRule,
  type StorageState,
  type StoreClassId,
  type StoreKind,
  type StoreRule,
} from "../../../engine/slices/storage"
import type { HeardEntry } from "../../../engine/core"
import { castById, type World } from "../../../engine/world"

/** The face of one gauge bar (and of a legend swatch). */
export type Face = "rule1" | "rule2" | "rule3" | "never" | "kept" | "arriving" | "freed" | "empty"

export const RULE_FACE: Readonly<Record<StoreRule, Face>> = { 1: "rule1", 2: "rule2", 3: "rule3", never: "never", kept: "kept" }

/**
 * Bar classes by face. Each place in the order differs in form, not only shade, and gets more solid
 * the longer it stays (home L8): hollow grey (rule 1), solid grey (rule 2), white with a dark centre
 * (rule 3), solid white (never freed), white outline (the update this node runs). Dashed = in flight
 * (arriving, white) or just freed (grey). No colour: colour lives on status dots only.
 */
export const FACE_CLASS: Readonly<Record<Face, string>> = {
  rule1: "border border-muted-foreground",
  rule2: "bg-muted-foreground",
  rule3: "bg-foreground",
  never: "bg-foreground",
  kept: "border-2 border-foreground",
  arriving: "border border-dashed border-foreground",
  freed: "border border-dashed border-muted-foreground",
  empty: "bg-foreground opacity-5",
}

/** Draw order of the lit part: what stays longest first, what goes first last (next to the line). */
const DRAW_ORDER: readonly StoreRule[] = ["kept", "never", 3, 2, 1]

/**
 * One face per bar, STORE_CAPACITY bars: stored items by their place in the order, then the map's
 * pieces arriving, then (after a prune) dashed bars up to how high the store reached, then free space.
 */
export function gaugeCells(state: Pick<StorageState, "items" | "fetch" | "last">): Face[] {
  const cells: Face[] = []
  for (const rule of DRAW_ORDER) {
    const items = state.items.filter((item) => KIND_RULE[item.kind] === rule).sort((a, b) => a.seq - b.seq)
    for (const item of items) for (let i = 0; i < item.units; i++) cells.push(RULE_FACE[rule])
  }
  for (let i = 0; i < state.fetch.received; i++) cells.push("arriving")
  const used = cells.length
  const peak = state.last && state.last.freed.length > 0 ? state.last.peak : used
  for (let i = used; i < Math.min(STORE_CAPACITY, peak); i++) cells.push("freed")
  while (cells.length < STORE_CAPACITY) cells.push("empty")
  return cells.slice(0, STORE_CAPACITY)
}

/** The bar the "past this line" tick is drawn before. */
export const PRESSURE_BAR = STORE_PRESSURE

export type GaugeWord = keyof typeof STORAGE_COPY.gauge.words

/** How the gauge reads, in words. It follows the last prune, so the word agrees with the narration. */
export function gaugeWord(state: Pick<StorageState, "items" | "fetch" | "last">): GaugeWord {
  const used = usedUnits(state)
  if (used >= STORE_CAPACITY) return "full"
  if (state.fetch.phase === "pruning") return "short"
  if (state.last && state.last.freed.length > 0) return "freed"
  return used > STORE_PRESSURE ? "short" : "room"
}

/** The four classes, each with its parts in the order they are listed. */
export const CLASS_PARTS: Readonly<Record<StoreClassId, readonly StoreKind[]>> = {
  history: ["history"],
  carried: ["handed", "carried"],
  public: ["public", "map"],
  updates: ["update", "superseded"],
}

/** Every kind in the order the gauge's description names them. */
const DESCRIBE_ORDER: readonly StoreKind[] = ["update", "carried", "history", "superseded", "handed", "public", "map"]

/** The gauge's aria-label: the word, what the store holds, and why it just changed. No numbers. */
export function describeGauge(state: Pick<StorageState, "items" | "fetch" | "last">): string {
  const g = STORAGE_COPY.gauge
  const kinds = STORAGE_COPY.classes.kinds
  const present = DESCRIBE_ORDER.filter((kind) => state.items.some((item) => item.kind === kind)).map((kind) => kinds[kind])
  const holds = present.length > 0 ? present.join("; ") : g.holdsNothing
  const why = state.last && state.last.freed.length > 0 ? g.whyFreed : isRunning(state.fetch.phase) || state.fetch.phase === "paused" ? g.whyArriving : ""
  return g.describe(g.words[gaugeWord(state)], holds, why)
}

/** A part's state word key. */
export type PartState = keyof typeof STORAGE_COPY.classes.state

/** Is this kind in the store, arriving, just freed, still on the hub (the map) or simply not here? */
export function partState(state: Pick<StorageState, "items" | "fetch" | "last">, kind: StoreKind): PartState {
  if (state.items.some((item) => item.kind === kind)) return "held"
  if (kind === "map") return isRunning(state.fetch.phase) || state.fetch.phase === "paused" ? "arriving" : "onHub"
  if (state.last?.freed.some((f) => f.kind === kind)) return "freed"
  return "none"
}

/** The chip beside a part: its rule, "never freed" or "kept". */
export function ruleChip(kind: StoreKind): string {
  const rule = KIND_RULE[kind]
  if (rule === "never") return STORAGE_COPY.classes.never
  if (rule === "kept") return STORAGE_COPY.classes.kept
  return STORAGE_COPY.classes.rule(rule)
}

/** The rules the last prune used (their numbers light up in the order list). */
export function activeRules(state: Pick<StorageState, "last">): ReadonlySet<FreeRule> {
  return new Set(state.last?.freed.map((f) => f.rule) ?? [])
}

/** The regional map on the hub row: on the hub, arriving, or a copy stored here. */
export function mapOnHub(state: Pick<StorageState, "items" | "fetch" | "last">): keyof typeof STORAGE_COPY.hubs.mapState {
  const part = partState(state, "map")
  return part === "held" ? "held" : part === "arriving" ? "arriving" : "onHub"
}

/** The free log: one line per prune (or a declined map), oldest first. */
export function logLines(state: Pick<StorageState, "log">): string[] {
  return state.log.map((entry) =>
    entry.declined ? STORAGE_COPY.log.declined(formatClock(entry.at)) : STORAGE_COPY.log.line(formatClock(entry.at), freedWords(entry.freed)),
  )
}

/** Hubs heard over long-range radio: they host the same libraries, but big datasets are not practical there. */
export function radioHubs(heard: readonly HeardEntry[], world: World): HeardEntry[] {
  return heard.filter((h) => h.via === "radio" && castById(world, h.id)?.kind === "hub")
}
