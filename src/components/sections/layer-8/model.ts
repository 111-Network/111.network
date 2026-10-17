import type { DeviceId } from "@/lib/devices"

// Layer 8 "Store Map": one device's encrypted store as a grid of cells.
//
// Pure TS (no React, no DOM), so vitest runs it in node. The client island
// (store-map.tsx) only renders what this module computes.
//
// Rules (plan §5 L8, W3, os/README.md layer 8):
// - Each click pours one named batch. Nothing expires on a timer and no rule
//   decides what may be kept: when space runs short the store frees room by
//   capacity alone, in a fixed order:
//     1 copies already handed over + public data you can fetch again
//     2 superseded updates
//     3 your own history, oldest first, after an export is offered
//       (only when rules 1 and 2 cannot make room, never at the pressure line)
//     4 NEVER: anything not yet delivered, yours or carried for others
// - Every prune has a visible cause: the batch it made room for. The store
//   first works out whether the batch can fit at all; a batch that cannot
//   fit frees nothing.
//   - It fits after rules 1–2: they free room down to the pressure line.
//   - It fits only by also freeing your history: the export is offered (once),
//     then rule 3 frees your oldest history, just enough to fit. Public data
//     you can fetch again (a regional map) never pushes out your history; it
//     is not kept instead ("declined").
//   - It would not fit even after everything rules 1–3 allow: new data is
//     refused ("Store full: new data refused") and nothing is freed.
// - The newest update (the one the node runs) is kept; it becomes superseded,
//   and so freeable by rule 2, when a newer update is stored.
// - A radio relay keeps nothing: it forwards without keeping.
// All sizes below are internal cell counts: never print them (no sizes,
// thresholds or percentages anywhere on the page).

// ---- batches ---------------------------------------------------------------

/** The four named batches, in the order FILL IT pours them. */
export const BATCH_ORDER = ["map", "carried", "history", "update"] as const

/** One named batch. */
export type BatchId = (typeof BATCH_ORDER)[number]

/** Button labels (plan §5 L8, verbatim). */
export const BATCH_LABEL: Readonly<Record<BatchId, string>> = {
  map: "regional map",
  carried: "messages carried for others",
  history: "your history",
  update: "an update",
}

/** The batch as a sentence object ("Poured a regional map."). */
const BATCH_PHRASE: Readonly<Record<BatchId, string>> = {
  map: "a regional map",
  carried: "messages carried for others",
  history: "your history",
  update: "an update",
}

// ---- cells -----------------------------------------------------------------

/** What one stored cell holds. */
export type CellKind =
  /** public data you can fetch again */
  | "map"
  /** a copy carried for someone else, already handed over */
  | "handed"
  /** carried for someone else, not yet delivered */
  | "carried"
  /** your own history (delivered) */
  | "history"
  /** yours, not yet delivered */
  | "outbox"
  /** the update this node runs */
  | "update"
  /** an update a newer one replaced */
  | "superseded"

/** A rule of the free-space order that may free cells. */
export type FreeRule = 1 | 2 | 3

/** Where a cell sits in the free-space order: freeable by rule 1–3, never freed, or kept (the update in use). */
export type CellClass = FreeRule | "never" | "kept"

/** The free-space class of every cell kind. */
export const CELL_CLASS: Readonly<Record<CellKind, CellClass>> = {
  map: 1,
  handed: 1,
  superseded: 2,
  history: 3,
  carried: "never",
  outbox: "never",
  update: "kept",
}

/** The numbered free-space order (W3), as the page prints it. Rule 3 is followed by the "export offered" chip. */
export const FREE_ORDER: readonly { rule: 1 | 2 | 3 | 4; text: string }[] = [
  { rule: 1, text: "copies already handed over + public data you can fetch again" },
  { rule: 2, text: "superseded updates" },
  { rule: 3, text: "your own history, oldest first, after" },
  { rule: 4, text: "NEVER: anything not yet delivered, yours or carried for others" },
]

/** The muted note under rule 3: when it applies. */
export const RULE3_NOTE = "only when rules 1 and 2 cannot make room, and never for data you can fetch again"

/** The chip rule 3 waits for. */
export const EXPORT_CHIP = "export offered"

/** The store's red ERROR line. */
export const STORE_FULL = "Store full: new data refused"

/** The radio relay's caption. */
export const RELAY_CAPTION = "forwards without keeping"

// ---- per-device stores -----------------------------------------------------

/** How big a device's store is drawn. */
export type StoreSize = "none" | "small" | "medium" | "large"

/** Store size per device (plan §5 L8). */
export const STORE_SIZE: Readonly<Record<DeviceId, StoreSize>> = {
  "radio-relay": "none",
  "old-phone": "small",
  "radio-box": "small",
  laptop: "medium",
  "home-server": "large",
  "gpu-pc": "large",
}

/**
 * Cells per row of the drawn grid, at every width (store-map.tsx draws
 * `grid-cols-16`; keep the two in step). Capacities are whole rows of it.
 */
export const GRID_COLUMNS = 16

interface Part {
  kind: CellKind
  cells: number
}

/** Internal sizing of one device's store. Never printed. */
export interface StoreProfile {
  size: StoreSize
  /** Cells in the grid. 0 = keeps nothing. */
  capacity: number
  /** The pressure line: above it, rules 1 and 2 free room. */
  pressure: number
  /** What the store holds before the first pour (the update it runs). */
  initial: readonly Part[]
  batches: Readonly<Record<BatchId, readonly Part[]>>
}

const NO_STORE: StoreProfile = {
  size: "none",
  capacity: 0,
  pressure: 0,
  initial: [],
  batches: { map: [], carried: [], history: [], update: [] },
}

/** Cell counts of the smallest store; bigger stores scale every entry. Internal only. */
const BASE = {
  capacity: 48,
  pressure: 37,
  update: 5,
  map: 6,
  handed: 2,
  carried: 10,
  history: 7,
  outbox: 5,
} as const

/**
 * One store scaled by `k` (1 small, 2 medium, 3 large). Tuned so that, in
 * BATCH_ORDER from a fresh store, the first three pours fit, the 4th visibly
 * crosses the pressure line, and FILL IT then shows rules 1, 2 and 3 (the
 * export offered on a pour of your own data, never for a map) before the
 * store refuses new data, within a dozen pours. model.test.ts pins all of it.
 */
function scaledProfile(size: Exclude<StoreSize, "none">, k: number): StoreProfile {
  return {
    size,
    capacity: BASE.capacity * k,
    pressure: BASE.pressure * k,
    initial: [{ kind: "update", cells: BASE.update * k }],
    batches: {
      map: [{ kind: "map", cells: BASE.map * k }],
      carried: [
        { kind: "handed", cells: BASE.handed * k },
        { kind: "carried", cells: BASE.carried * k },
      ],
      history: [
        { kind: "history", cells: BASE.history * k },
        { kind: "outbox", cells: BASE.outbox * k },
      ],
      update: [{ kind: "update", cells: BASE.update * k }],
    },
  }
}

const PROFILES: Readonly<Record<StoreSize, StoreProfile>> = {
  none: NO_STORE,
  small: scaledProfile("small", 1),
  medium: scaledProfile("medium", 2),
  large: scaledProfile("large", 3),
}

/** The store profile of a device. */
export function profileFor(device: DeviceId): StoreProfile {
  return PROFILES[STORE_SIZE[device]]
}

// ---- store state -----------------------------------------------------------

/** One stored item: the cells one pour added of one kind. Freed whole. */
export interface StoreItem {
  /** Arrival order: lower = older. */
  id: number
  kind: CellKind
  /** Grid positions it occupies. */
  cells: readonly number[]
}

/** One device's store. */
export interface Store {
  capacity: number
  pressure: number
  items: readonly StoreItem[]
  nextId: number
  /** True once the export of your history has been offered (rule 3's chip). */
  exportOffered: boolean
}

/** An item freed by a pour, with the rule that freed it. */
export interface FreedItem {
  /** The freed item's arrival order (lower = older). */
  id: number
  kind: CellKind
  rule: FreeRule
  cells: readonly number[]
}

/**
 * What one pour did:
 * - stored: the batch is in, after the frees listed;
 * - declined: public data you can fetch again that would only fit by freeing your history, so it is not kept;
 * - refused: it would not fit even after everything rules 1–3 allow (store full);
 * - forwarded: a radio relay keeps nothing.
 * Declined, refused and forwarded pours change nothing in the store.
 */
export type PourStatus = "stored" | "declined" | "refused" | "forwarded"

/** What one pour did. */
export interface PourOutcome {
  batch: BatchId
  status: PourStatus
  /** The update this node ran became superseded (an update was stored). */
  superseded: boolean
  /** Items freed, in the order they were freed (empty unless stored). */
  freed: readonly FreedItem[]
  /** The export of your history was offered during this pour (first time only). */
  exportOffered: boolean
  /** Positions the batch now occupies (empty unless stored). */
  added: readonly number[]
  /**
   * Cells the store would hold with the whole batch in and nothing freed:
   * the gauge's high-water mark for this pour (it may exceed capacity).
   */
  peak: number
}

/** Cells in use. */
export function usedCells(store: Store): number {
  let used = 0
  for (const item of store.items) used += item.cells.length
  return used
}

function partCells(parts: readonly Part[]): number {
  let n = 0
  for (const part of parts) n += part.cells
  return n
}

function classCells(items: readonly StoreItem[], rules: readonly FreeRule[]): number {
  let n = 0
  for (const item of items) {
    const cls = CELL_CLASS[item.kind]
    if (cls !== "never" && cls !== "kept" && rules.includes(cls)) n += item.cells.length
  }
  return n
}

/** A fresh store for `device`: empty except the update it runs (a relay keeps nothing). */
export function createStore(device: DeviceId): Store {
  const profile = profileFor(device)
  let position = 0
  let nextId = 0
  const items: StoreItem[] = []
  for (const part of profile.initial) {
    const cells = Array.from({ length: part.cells }, (_, i) => position + i)
    position += part.cells
    items.push({ id: nextId++, kind: part.kind, cells })
  }
  return { capacity: profile.capacity, pressure: profile.pressure, items, nextId, exportOffered: false }
}

/** Free whole items of `rule`, oldest first, while `used + incoming > limit`. Mutates the working arrays. */
function freeRule(items: StoreItem[], freed: FreedItem[], rule: FreeRule, used: number, incoming: number, limit: number): number {
  const candidates = items.filter((item) => CELL_CLASS[item.kind] === rule).sort((a, b) => a.id - b.id)
  for (const item of candidates) {
    if (used + incoming <= limit) break
    items.splice(items.indexOf(item), 1)
    freed.push({ id: item.id, kind: item.kind, rule, cells: item.cells })
    used -= item.cells.length
  }
  return used
}

/**
 * Pour one batch into the store (pure). Works out first whether the batch can
 * fit, then applies the free-space order: past the pressure line, rules 1 then
 * 2 free room; if that is not enough, the export is offered and rule 3 frees
 * your oldest history, just enough to fit. What is not yet delivered is never
 * freed. A batch that cannot fit frees nothing and is refused (or, for data
 * you can fetch again that would need your history's room, declined).
 */
export function pour(store: Store, device: DeviceId, batch: BatchId): { store: Store; outcome: PourOutcome } {
  const parts = profileFor(device).batches[batch]
  const incoming = partCells(parts)
  const used = usedCells(store)
  const unchanged = (status: PourStatus, peak: number) => ({
    store,
    outcome: { batch, status, superseded: false, freed: [], exportOffered: false, added: [], peak },
  })
  if (store.capacity === 0) return unchanged("forwarded", 0)
  const peak = used + incoming

  // An arriving update supersedes the one the node runs (making it freeable
  // by rule 2), but only once it is stored: an update that does not fit never
  // costs the node the update it runs.
  const bringsUpdate = parts.some((part) => part.kind === "update")
  let superseded = false
  const items: StoreItem[] = store.items.map((item) => {
    if (bringsUpdate && item.kind === "update") {
      superseded = true
      return { ...item, kind: "superseded" }
    }
    return item
  })

  // Does it fit at all? Decide before freeing anything.
  const fitsAfter = (rules: readonly FreeRule[]) => used - classCells(items, rules) + incoming <= store.capacity
  if (!fitsAfter([1, 2])) {
    if (!fitsAfter([1, 2, 3])) return unchanged("refused", peak)
    // Only your history's room would make it fit. Public data you can fetch
    // again never pushes out your history (rule 1 goes before rule 3).
    if (parts.every((part) => CELL_CLASS[part.kind] === 1)) return unchanged("declined", peak)
  }

  const freed: FreedItem[] = []
  let now = used

  // Space runs short: rules 1 and 2, down to the pressure line.
  if (now + incoming > store.pressure) {
    now = freeRule(items, freed, 1, now, incoming, store.pressure)
    now = freeRule(items, freed, 2, now, incoming, store.pressure)
  }

  // Still no room: offer the export, then rule 3, just enough to fit.
  let exportOffered = store.exportOffered
  let offeredNow = false
  if (now + incoming > store.capacity) {
    if (!exportOffered) {
      exportOffered = true
      offeredNow = true
    }
    now = freeRule(items, freed, 3, now, incoming, store.capacity)
  }

  // Place the batch: never-used or long-free positions first, then the cells
  // freed by this pour, so the freed cells stay visible when there is room.
  const occupied = new Set<number>()
  for (const item of items) for (const cell of item.cells) occupied.add(cell)
  const justFreed = new Set<number>()
  for (const item of freed) for (const cell of item.cells) justFreed.add(cell)
  const slots: number[] = []
  for (let p = 0; p < store.capacity; p++) if (!occupied.has(p) && !justFreed.has(p)) slots.push(p)
  for (let p = 0; p < store.capacity; p++) if (justFreed.has(p)) slots.push(p)

  let nextId = store.nextId
  let cursor = 0
  const added: number[] = []
  for (const part of parts) {
    const cells = slots.slice(cursor, cursor + part.cells)
    cursor += part.cells
    added.push(...cells)
    items.push({ id: nextId++, kind: part.kind, cells })
  }

  return {
    store: { ...store, items, nextId, exportOffered },
    outcome: { batch, status: "stored", superseded, freed, exportOffered: offeredNow, added, peak },
  }
}

// ---- reading the store -----------------------------------------------------

/**
 * How the gauge reads, in words. It follows the last pour when that pour
 * freed room or did not fit, so the word always agrees with the narration.
 */
export type Gauge = "none" | "room" | "short" | "freed" | "cut" | "full" | "unfit"

/** The gauge's state for the store after `last`. */
export function gaugeOf(store: Store, last: PourOutcome | null): Gauge {
  if (store.capacity === 0) return "none"
  if (last?.status === "refused" || last?.status === "declined") return "unfit"
  if (last?.status === "stored" && last.freed.some((item) => item.rule === 3)) return "cut"
  if (last?.status === "stored" && last.freed.length > 0) return "freed"
  const used = usedCells(store)
  if (used >= store.capacity) return "full"
  return used > store.pressure ? "short" : "room"
}

/** Gauge words, in place of the old "/Unlimited" readout. */
export const GAUGE_WORDS: Readonly<Record<Gauge, string>> = {
  none: "keeps nothing",
  room: "room to spare",
  short: "running short",
  freed: "ran short: room freed",
  cut: "no room left: room freed",
  full: "full",
  unfit: "no room for this batch",
}

/**
 * What the gauge draws dashed past the lit bars for the last pour, up to its
 * peak: the room it freed after crossing the line, or the batch that did not
 * fit. Shown until the next pour.
 */
export type Ghost = "freed" | "unfit" | null

/** The last pour's dashed overshoot on the gauge, if any. */
export function ghostOf(last: PourOutcome | null): Ghost {
  if (!last) return null
  if (last.status === "refused" || last.status === "declined") return "unfit"
  if (last.status === "stored" && last.freed.length > 0) return "freed"
  return null
}

/** Bars to light on the V9 strip: at least one while anything is stored, all only when full. */
export function meterBars(used: number, capacity: number, bars: number): number {
  if (capacity <= 0 || used <= 0) return 0
  if (used >= capacity) return bars
  return Math.min(bars - 1, Math.max(1, Math.round((used / capacity) * bars)))
}

/** The bar after which the strip draws the pressure tick. */
export function pressureBar(store: Store, bars: number): number {
  if (store.capacity === 0) return bars
  return Math.round((store.pressure / store.capacity) * bars)
}

/** What the V9 strip draws for the store after `last`. */
export interface GaugeMarks {
  /** Solid bars: cells in use. */
  lit: number
  /** Dashed bars run from `lit` up to here: the last pour's peak (equal to `lit` when there is none). */
  ghostEnd: number
  /** The last pour's peak passed capacity: a dashed cap is drawn past the end. */
  overflow: boolean
  /** The bar the pressure tick sits before (-1 for a store that keeps nothing). */
  tick: number
}

/** The strip's marks: so a prune or a refusal always shows its overshoot, as dashed bars, the dashed cap, or both. */
export function gaugeMarks(store: Store, last: PourOutcome | null, bars: number): GaugeMarks {
  const lit = meterBars(usedCells(store), store.capacity, bars)
  const ghost = ghostOf(last)
  const ghostEnd = ghost && last ? Math.max(lit, meterBars(last.peak, store.capacity, bars)) : lit
  return {
    lit,
    ghostEnd,
    overflow: ghost !== null && last !== null && last.peak > store.capacity,
    tick: store.capacity === 0 ? -1 : pressureBar(store, bars),
  }
}

/** What one grid position shows. */
export type CellView =
  | { state: "empty" }
  | { state: "freed"; rule: FreeRule }
  | { state: "held"; kind: CellKind; cls: CellClass }

/** Every grid position, in order: held cells, cells the last pour freed (with their rule), empty ones. */
export function cellViews(store: Store, last: PourOutcome | null): CellView[] {
  const views: CellView[] = Array.from({ length: store.capacity }, () => ({ state: "empty" }))
  if (last) {
    for (const item of last.freed) for (const cell of item.cells) views[cell] = { state: "freed", rule: item.rule }
  }
  for (const item of store.items) {
    for (const cell of item.cells) views[cell] = { state: "held", kind: item.kind, cls: CELL_CLASS[item.kind] }
  }
  return views
}

const KIND_WORDS: Readonly<Record<CellKind, string>> = {
  map: "public data you can fetch again",
  handed: "copies already handed over",
  superseded: "a superseded update",
  history: "your history",
  carried: "messages carried for others, not yet delivered",
  outbox: "your messages, not yet delivered",
  update: "the update this node runs",
}

/** A plain-word summary of the store for the grid's aria-label (no counts). */
export function describeStore(store: Store, deviceLabel: string, last: PourOutcome | null): string {
  if (store.capacity === 0) return `Store map of this ${deviceLabel}: empty, it ${RELAY_CAPTION}.`
  const kinds: CellKind[] = ["map", "handed", "superseded", "history", "carried", "outbox", "update"]
  const present = kinds.filter((kind) => store.items.some((item) => item.kind === kind)).map((kind) => KIND_WORDS[kind])
  const holds = present.length > 0 ? `holds ${present.join("; ")}` : "empty"
  return `Store map of this ${deviceLabel}: ${holds}. Capacity: ${GAUGE_WORDS[gaugeOf(store, last)]}.`
}

/** The store's size in words (the grid shows it; no sizes are printed). */
export const SIZE_WORDS: Readonly<Record<StoreSize, string>> = {
  none: "no store",
  small: "small store",
  medium: "medium store",
  large: "large store",
}

// ---- narration ---------------------------------------------------------------

/** Plain words for what a pour freed, grouped by kind in the order freed, with the rule. */
export function freedWords(freed: readonly FreedItem[]): string {
  const groups: { kind: CellKind; rule: FreeRule; many: boolean }[] = []
  for (const item of freed) {
    const group = groups.find((g) => g.kind === item.kind)
    if (group) group.many = true
    else groups.push({ kind: item.kind, rule: item.rule, many: false })
  }
  const words = groups.map(({ kind, rule, many }) => {
    switch (kind) {
      case "map":
        return `${many ? "older regional maps" : "a regional map"} (rule ${rule}: you can fetch it again)`
      case "handed":
        return `copies already handed over (rule ${rule})`
      case "superseded":
        return `${many ? "superseded updates" : "a superseded update"} (rule ${rule})`
      case "history":
        return `your oldest history (rule ${rule})`
      default:
        return KIND_WORDS[kind]
    }
  })
  if (words.length <= 1) return words.join("")
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`
}

/** What a pour that reached rule 3 freed, in words: rules 1–2 first, the export offer (first time), then your oldest history. */
function hardWords(outcome: PourOutcome): string {
  const short = outcome.freed.filter((item) => item.rule < 3)
  const before = short.length > 0 ? freedWords(short) : ""
  const history = "your oldest history (rule 3)"
  if (outcome.exportOffered) return `${before ? `freed ${before}; ` : ""}export offered, then freed ${history}`
  return before ? `freed ${before}, then ${history}` : `freed ${history}`
}

/** True when nothing freeable is left: only what is not yet delivered, plus the update this node runs. */
function onlyNeverLeft(store: Store): boolean {
  return store.items.every((item) => {
    const cls = CELL_CLASS[item.kind]
    return cls === "never" || cls === "kept"
  })
}

/** The sentence for one pour: what arrived, why space ran short, what was freed and why. */
export function narrate(outcome: PourOutcome, store: Store): string {
  const what = BATCH_PHRASE[outcome.batch]
  // "a copy" reads right for one batch or many ("messages carried for others").
  if (outcome.status === "forwarded") return `Passed on ${what} without keeping a copy: a radio relay's store stays empty.`
  if (outcome.status === "refused") {
    const left = onlyNeverLeft(store) ? " What is left is not yet delivered, plus the update this node runs." : ""
    return `Refused ${what}: even freeing everything the order allows would not make room, so nothing was freed. ${STORE_FULL}.${left}`
  }
  if (outcome.status === "declined") {
    return `Not kept: ${what} is public data you can fetch again, so it never pushes out your history. Ask a nearby hub for it.`
  }
  const head = `Poured ${what}.${outcome.superseded ? " The earlier update is now superseded." : ""}`
  if (outcome.freed.some((item) => item.rule === 3)) return `${head} No room left: ${hardWords(outcome)}.`
  if (outcome.freed.length > 0) return `${head} Space ran short: freed ${freedWords(outcome.freed)}.`
  const gauge = gaugeOf(store, outcome)
  if (gauge === "room") return `${head} Room to spare.`
  if (gauge === "full") return `${head} The store is now full.`
  const history = store.items.some((item) => CELL_CLASS[item.kind] === 3)
  return `${head} Space is running short.${history ? " Your history stays until rules 1 and 2 cannot make room." : ""}`
}

/** A short line for the visible free log (prunes, declines and refusals only); null for a plain store or a relay. */
export function logLine(outcome: PourOutcome): string | null {
  const label = BATCH_LABEL[outcome.batch]
  if (outcome.status === "forwarded") return null
  if (outcome.status === "refused") return `${label} → refused: store full, nothing freed`
  if (outcome.status === "declined") return `${label} → not kept: it never pushes out your history`
  if (outcome.freed.length === 0) return null
  if (outcome.freed.some((item) => item.rule === 3)) return `${label} → no room left: ${hardWords(outcome)}`
  return `${label} → ran short: freed ${freedWords(outcome.freed)}`
}

// ---- the widget's reducer --------------------------------------------------

/** Most free-log lines kept on screen. */
export const LOG_LIMIT = 6

/** Upper bound on pours in one FILL IT run (the store always refuses well before). */
export const MAX_FILL_POURS = 40

/** What one FILL IT run has done so far: the source of its one summary line. */
export interface FillRun {
  /** `pours` when the run started (caps the run). */
  from: number
  /** Rules that freed room during the run, ascending. */
  rules: readonly FreeRule[]
  /** The export was offered during the run. */
  offered: boolean
  /** A regional map was not kept during the run, to keep your history. */
  declined: boolean
}

/** The Store Map widget's state for one device. */
export interface StoreMapState {
  device: DeviceId
  store: Store
  /** Pours so far (FILL IT continues BATCH_ORDER from here). */
  pours: number
  last: PourOutcome | null
  /** The aria-live line (visible too): one sentence per click, one summary per FILL IT run. */
  message: string
  /** `message` without its repeat prefix, to tell a repeat from a change. */
  said: string
  /** The last pour's own sentence (a one-pour FILL IT run announces it in place of a summary). */
  narration: string
  /** Free-log lines, oldest first. */
  log: readonly string[]
  /** FILL IT is stepping (one pour per tick). */
  filling: boolean
  /** The current FILL IT run (stepped or whole), or null. */
  run: FillRun | null
}

/** Actions: one pour, FILL IT (stepped, or whole under reduced motion), stop, one step, reset. */
export type StoreMapAction =
  | { type: "pour"; batch: BatchId }
  | { type: "fill"; whole: boolean }
  | { type: "stop" }
  | { type: "tick" }
  | { type: "reset" }

/** The idle narration before the first pour. */
export function idleMessage(device: DeviceId): string {
  return profileFor(device).capacity === 0
    ? `A radio relay ${RELAY_CAPTION}: its store stays empty.`
    : "Nothing poured yet. Each button pours one batch into this store."
}

/** The live line while FILL IT steps: the steps go to the free log, the summary comes at the end. */
export const FILL_START = "Filling: one batch per step, in button order. Each prune goes to the free log; a summary follows at the end."

/** A fresh widget for `device`. */
export function initialStoreMap(device: DeviceId): StoreMapState {
  const message = idleMessage(device)
  return {
    device,
    store: createStore(device),
    pours: 0,
    last: null,
    message,
    said: message,
    narration: "",
    log: [],
    filling: false,
    run: null,
  }
}

/** The last pour was refused: the store shows the red ERROR. */
export function isRefused(state: StoreMapState): boolean {
  return state.last?.status === "refused"
}

/** The next batch FILL IT pours. */
export function nextBatch(state: StoreMapState): BatchId {
  return BATCH_ORDER[state.pours % BATCH_ORDER.length]
}

/**
 * Set the live line. A sentence equal to the one already showing gets an
 * alternating prefix, so a repeated click is still announced and visibly
 * changes the line.
 */
function say(state: StoreMapState, sentence: string): StoreMapState {
  if (sentence !== state.said) return { ...state, message: sentence, said: sentence }
  const prefix = state.message.startsWith("Again: ") ? "Once more: " : "Again: "
  return { ...state, message: `${prefix}${sentence}` }
}

/** The one line a FILL IT run announces when it ends or is stopped. */
export function fillSummary(run: FillRun, reason: "end" | "stopped"): string {
  const steps: string[] = []
  const short = run.rules.filter((rule) => rule < 3)
  if (short.length > 0) {
    steps.push(`space ran short, so ${short.length > 1 ? "rules 1 and 2" : `rule ${short[0]}`} freed room`)
  }
  if (run.rules.includes(3)) {
    steps.push(
      run.offered
        ? "with no room left, the export was offered and rule 3 freed your oldest history"
        : "with no room left, rule 3 freed your oldest history",
    )
  }
  if (run.declined) steps.push("a regional map was not kept, so your history stayed")
  if (reason === "end") {
    const story = steps.length > 0 ? steps.join("; ") : "nothing the order allows could make room"
    return `Filled until the store refused new data: ${story}. ${STORE_FULL}.`
  }
  const story = steps.length > 0 ? `: ${steps.join("; ")}` : ""
  return `Filling stopped${story}. Pour again, or FILL IT to go on.`
}

/** Pour one batch. In a FILL IT run the step is quiet (log only) and feeds the run's summary. */
function applyPour(state: StoreMapState, batch: BatchId): StoreMapState {
  const { store, outcome } = pour(state.store, state.device, batch)
  const line = logLine(outcome)
  const log = line ? [...state.log, line].slice(-LOG_LIMIT) : state.log
  const narration = narrate(outcome, store)
  const next: StoreMapState = { ...state, store, pours: state.pours + 1, last: outcome, narration, log }
  if (!state.run) return say(next, narration)
  const rules = new Set<FreeRule>(state.run.rules)
  for (const item of outcome.freed) rules.add(item.rule)
  return {
    ...next,
    run: {
      ...state.run,
      rules: [...rules].sort((a, b) => a - b),
      offered: state.run.offered || outcome.exportOffered,
      declined: state.run.declined || outcome.status === "declined",
    },
  }
}

/** End the FILL IT run: one announcement (the summary, or the sentence of a one-pour run). */
function finishRun(state: StoreMapState, reason: "end" | "stopped"): StoreMapState {
  const run = state.run
  const ended: StoreMapState = { ...state, filling: false, run: null }
  if (!run) return ended
  const single = reason === "end" && state.pours - run.from === 1
  return say(ended, single ? state.narration : fillSummary(run, reason))
}

/** A FILL IT step ended the run: the store refused, or the run hit its cap. */
function runEnded(state: StoreMapState): boolean {
  return state.last?.status === "refused" || (state.run !== null && state.pours - state.run.from >= MAX_FILL_POURS)
}

/** A run ends on a refusal ("end"); hitting the cap reads as a stop. */
function endReason(state: StoreMapState): "end" | "stopped" {
  return state.last?.status === "refused" ? "end" : "stopped"
}

/** The Store Map reducer (pure). */
export function storeMapReducer(state: StoreMapState, action: StoreMapAction): StoreMapState {
  switch (action.type) {
    case "pour":
      // A pour during FILL IT stops it; the click's own sentence is announced.
      return applyPour({ ...state, filling: false, run: null }, action.batch)
    case "fill": {
      if (state.store.capacity === 0) {
        return say({ ...state, filling: false, run: null }, `Nothing to fill: a radio relay ${RELAY_CAPTION}.`)
      }
      let next = applyPour(
        { ...state, filling: false, run: { from: state.pours, rules: [], offered: false, declined: false } },
        nextBatch(state),
      )
      if (action.whole) {
        while (!runEnded(next)) next = applyPour(next, nextBatch(next))
        return finishRun(next, endReason(next))
      }
      if (runEnded(next)) return finishRun(next, endReason(next))
      return say({ ...next, filling: true }, FILL_START)
    }
    case "stop":
      return state.filling ? finishRun(state, "stopped") : state
    case "tick": {
      if (!state.filling) return state
      const next = applyPour(state, nextBatch(state))
      return runEnded(next) ? finishRun(next, endReason(next)) : next
    }
    case "reset": {
      const fresh = initialStoreMap(state.device)
      return say({ ...fresh, message: state.message, said: state.said }, "Store reset.")
    }
  }
}
