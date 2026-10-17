// The storage slice through a memory store and the scheduler: the opening store, the free-space
// order (W3, verbatim as home L8), "[DEMO] fetch the regional map" step by step, the caused prune,
// reduced motion, a store that stops mid-fetch, and no numbers in the copy (§6.8).
import { describe, expect, it } from "vitest"
import { EXPORT_CHIP, FREE_ORDER, RULE3_NOTE } from "@/components/sections/layer-8/model"
import { STORAGE_COPY, STORAGE_EXPORT_CHIP, STORAGE_FREE_ORDER, STORAGE_RULE3_NOTE } from "../../copy/storage"
import { createDemoStore, type DemoStore } from "../store"
import type { SliceCtx } from "../types"
import { DEMO_WORLD } from "../world"
import type { DemoAction, DemoState } from "./index"
import {
  FETCH_KEY,
  KIND_RULE,
  MAP_PIECE,
  MAP_UNITS,
  STORAGE_TIMING,
  STORE_CAPACITY,
  STORE_PRESSURE,
  fetchLine,
  freedWords,
  initialStorage,
  itemUnits,
  planRoom,
  reduceStorage,
  usedUnits,
  type StorageState,
  type StoreItem,
  type StoreKind,
} from "./storage"

const T = STORAGE_TIMING
const HUB = "Workshop hub"

const setup = (): DemoStore => createDemoStore(DEMO_WORLD, { router: "memory", driver: null, initialPath: "/services/storage" })
const snap = (s: DemoStore): DemoState => s.getSnapshot()
const st = (s: DemoStore) => snap(s).storage
const causes = (s: DemoStore): string[] => snap(s).core.events.map((e) => e.cause)
const steps = (s: DemoStore) => s.scheduler.pending().filter((p) => p.key === FETCH_KEY)
const kinds = (items: readonly { kind: StoreKind }[]): StoreKind[] => items.map((item) => item.kind)
const item = (kind: StoreKind, units: number, seq: number): StoreItem => ({ id: `t${seq}`, kind, units, seq })

describe("storage slice: the opening store", () => {
  it("sits below the line with something in every class, nothing pending and nothing logged", () => {
    const s = setup()
    const storage = st(s)
    expect(usedUnits(storage)).toBeLessThanOrEqual(STORE_PRESSURE)
    expect(new Set(kinds(storage.items))).toEqual(new Set<StoreKind>(["history", "carried", "handed", "public", "update", "superseded"]))
    expect(storage.fetch.phase).toBe("idle")
    expect(s.scheduler.pending()).toEqual([])
    expect(snap(s).core.events).toEqual([])
    expect(s.scheduler.runUntilIdle()).toBe(0)
    expect(st(s)).toBe(storage)
  })

  it("the map alone would push it past the line, so the demo fetch always shows a caused prune", () => {
    const storage = initialStorage()
    expect(itemUnits(storage.items) + MAP_UNITS).toBeGreaterThan(STORE_PRESSURE)
    expect(itemUnits(storage.items) + MAP_UNITS).toBeLessThanOrEqual(STORE_CAPACITY)
  })

  it("ids come from the slice counter", () => {
    const storage = initialStorage()
    expect(storage.items.map((i) => i.id)).toEqual(storage.items.map((i) => `s${i.seq}`))
    expect(storage.seq).toBe(storage.items.length)
  })
})

describe("storage slice: the free-space order (W3)", () => {
  it("prints exactly the home L8 order, chip and rule 3 note", () => {
    expect(STORAGE_FREE_ORDER).toEqual(FREE_ORDER)
    expect(STORAGE_EXPORT_CHIP).toBe(EXPORT_CHIP)
    expect(STORAGE_RULE3_NOTE).toBe(RULE3_NOTE)
  })

  it("places every kind: handed over and public first, superseded second, history third, undelivered never, the running update kept", () => {
    expect(KIND_RULE).toEqual({ handed: 1, public: 1, map: 1, superseded: 2, history: 3, carried: "never", update: "kept" })
  })

  it("frees rule 1 before rule 2, heaviest (size × age) first within a rule, and stops once below the line", () => {
    const items = [item("superseded", 3, 1), item("public", 2, 2), item("handed", 2, 3), item("history", 10, 4), item("public", 1, 5)]
    // 18 stored + 8 incoming = 26: two over the line.
    const plan = planRoom(items, 8, 6)
    expect(plan.fits).toBe(true)
    expect(plan.freed.map((f) => [f.id, f.rule])).toEqual([["t2", 1]]) // public seq 2: 2 × 4 = 8, heavier than handed 2 × 3
    const more = planRoom(items, 12, 6) // 30: six over the line
    expect(more.freed.map((f) => [f.kind, f.rule])).toEqual([
      ["public", 1],
      ["handed", 1],
      ["public", 1],
      ["superseded", 2],
    ])
  })

  it("never frees history, undelivered copies or the update this node runs for public data", () => {
    const items = [item("history", 12, 1), item("carried", 6, 2), item("update", 4, 3), item("handed", 1, 4)]
    const plan = planRoom(items, 8, 5) // 31: rule 1 frees one unit, still past the line but within capacity
    expect(plan.fits).toBe(true)
    expect(kinds(plan.freed)).toEqual(["handed"])
    const over = planRoom(items, 12, 5) // 35: only rule 3 could make room, and public data never pushes out history
    expect(over).toEqual({ fits: false, freed: [] })
  })

  it("frees nothing while the store stays below the line", () => {
    expect(planRoom([item("handed", 2, 1)], 4, 2)).toEqual({ fits: true, freed: [] })
  })

  it("names what was freed in plain words with the rule, in the order freed", () => {
    expect(freedWords([{ kind: "handed" }, { kind: "public" }, { kind: "handed" }, { kind: "superseded" }])).toBe(
      "copies already handed over (rule 1), public data you can fetch again (rule 1) and a superseded update (rule 2)",
    )
    expect(freedWords([{ kind: "superseded" }])).toBe("a superseded update (rule 2)")
  })
})

describe("storage slice: [DEMO] fetch the regional map", () => {
  it("asks the home hub over Wi-Fi, then fills the gauge one piece per step", () => {
    const s = setup()
    s.dispatch({ type: "storage/fetchMap" })
    expect(st(s).fetch.phase).toBe("asking")
    expect(causes(s)).toEqual(["storage/fetch-started"])
    expect(snap(s).core.events[0].text).toBe(STORAGE_COPY.fetch.started(HUB))
    expect(steps(s)).toHaveLength(1)
    expect(fetchLine(st(s), HUB)).toContain("over Wi-Fi")

    s.scheduler.advance(T.askMs)
    expect(st(s).fetch).toMatchObject({ phase: "receiving", received: MAP_PIECE })
    expect(steps(s)).toHaveLength(1)
  })

  it("crosses the line, pauses on the overshoot, then frees room in the fixed order (rules 1, then 2), narrated", () => {
    const s = setup()
    const before = st(s).items
    s.dispatch({ type: "storage/fetchMap" })
    s.scheduler.advance(T.askMs)
    // Pieces arrive until the store is past the line.
    while (st(s).fetch.phase === "receiving") s.scheduler.advance(T.pieceMs)
    expect(st(s).fetch.phase).toBe("pruning")
    expect(usedUnits(st(s))).toBeGreaterThan(STORE_PRESSURE)
    expect(st(s).items).toBe(before) // nothing freed yet: the overshoot shows first
    expect(fetchLine(st(s), HUB)).toBe(STORAGE_COPY.fetch.crossing)

    s.scheduler.advance(T.pruneMs)
    const after = st(s)
    expect(after.last).not.toBeNull()
    const freed = after.last?.freed ?? []
    expect(freed.map((f) => f.rule)).toEqual([...freed.map((f) => f.rule)].sort())
    expect(new Set(kinds(freed))).toEqual(new Set<StoreKind>(["handed", "public", "superseded"]))
    // Never history, never anything not yet delivered, never the update in use.
    expect(kinds(after.items).filter((k) => k === "history")).toHaveLength(2)
    expect(kinds(after.items)).toContain("carried")
    expect(kinds(after.items)).toContain("update")
    expect(after.last?.peak).toBeGreaterThan(STORE_PRESSURE)
    expect(causes(s)).toContain("storage/pruned")
    const pruned = snap(s).core.events.find((e) => e.cause === "storage/pruned")
    expect(pruned?.text).toBe(STORAGE_COPY.events.pruned(freedWords(freed)))
    expect(after.log).toHaveLength(1)
    expect(fetchLine(after, HUB)).toBe(STORAGE_COPY.fetch.pruned(freedWords(freed)))
  })

  it("checks the map, stores it as public data you can fetch again, and the home hub answers over Wi-Fi", () => {
    const s = setup()
    s.dispatch({ type: "storage/fetchMap" })
    s.scheduler.runUntilIdle()
    const storage = st(s)
    expect(storage.fetch).toMatchObject({ phase: "done", received: 0 })
    const map = storage.items.filter((i) => i.kind === "map")
    expect(map).toHaveLength(1)
    expect(map[0]).toMatchObject({ units: MAP_UNITS, id: `s${storage.seq}` })
    expect(usedUnits(storage)).toBeLessThanOrEqual(STORE_PRESSURE)
    expect(causes(s)).toEqual(["storage/fetch-started", "storage/pruned", "map-fetched"])
    const hub = snap(s).core.heard.find((h) => h.id === DEMO_WORLD.homeHub)
    expect(hub).toMatchObject({ via: "wifi", cause: "map-fetched", count: 1 })
    expect(s.scheduler.pending()).toEqual([])
    expect(fetchLine(storage, HUB)).toBe(STORAGE_COPY.fetch.done)
  })

  it("runs one scheduled step at a time: asking, the pieces, the prune, the rest, checking, done", () => {
    const s = setup()
    s.dispatch({ type: "storage/fetchMap" })
    const phases: string[] = [st(s).fetch.phase]
    const received: number[] = [st(s).fetch.received]
    for (let i = 0; i < 20 && steps(s).length === 1; i++) {
      const [task] = steps(s)
      s.scheduler.advance(task.due - s.scheduler.now())
      phases.push(st(s).fetch.phase)
      received.push(st(s).fetch.received)
    }
    expect(phases).toEqual(["asking", "receiving", "pruning", "receiving", "receiving", "checking", "done"])
    expect(received).toEqual([0, 2, 4, 4, 6, 8, 0]) // the prune frees room before the next piece
    expect(phases.length - 1).toBe(MAP_UNITS / MAP_PIECE + 2)
  })

  it("ignores a second click while running and after the map is stored; nothing moves afterwards", () => {
    const s = setup()
    s.dispatch({ type: "storage/fetchMap" })
    const running = st(s)
    s.dispatch({ type: "storage/fetchMap" })
    expect(st(s)).toBe(running)
    expect(steps(s)).toHaveLength(1)
    s.scheduler.runUntilIdle()
    const done = st(s)
    s.dispatch({ type: "storage/fetchMap" })
    expect(st(s)).toBe(done)
    expect(s.scheduler.pending()).toEqual([])
  })

  it("a stale step does nothing", () => {
    const s = setup()
    const idle = st(s)
    s.dispatch({ type: "storage/step" })
    expect(st(s)).toBe(idle)
  })

  it("reduced motion: the whole fetch lands in the same dispatch, end state only", () => {
    const s = setup()
    s.dispatch({ type: "storage/fetchMap", instant: true })
    expect(st(s).fetch).toMatchObject({ phase: "done", received: 0, instant: true })
    expect(st(s).items.some((i) => i.kind === "map")).toBe(true)
    expect(causes(s)).toEqual(["storage/fetch-started", "storage/pruned", "map-fetched"])
    expect(s.scheduler.pending()).toEqual([])
  })

  it("does not start while the store is not running", () => {
    const s = setup()
    s.dispatch({ type: "core/serviceTransition", id: "storage", to: "error" })
    const before = st(s)
    s.dispatch({ type: "storage/fetchMap" })
    expect(st(s)).toBe(before)
    expect(steps(s)).toEqual([])
  })

  it("pauses when the store stops mid-fetch and picks up where it left off once it is back", () => {
    const s = setup()
    s.dispatch({ type: "storage/fetchMap" })
    s.scheduler.advance(T.askMs)
    const received = st(s).fetch.received
    s.dispatch({ type: "core/serviceTransition", id: "storage", to: "error" })
    expect(st(s).fetch).toMatchObject({ phase: "paused", resume: "receiving", received })
    expect(steps(s)).toEqual([])
    expect(causes(s)).toContain("storage/fetch-paused")
    expect(fetchLine(st(s), HUB)).toBe(STORAGE_COPY.fetch.paused)
    s.scheduler.advance(10 * T.pieceMs)
    expect(st(s).fetch.received).toBe(received) // nothing moves while paused

    s.dispatch({ type: "core/serviceTransition", id: "storage", to: "starting" })
    expect(st(s).fetch.phase).toBe("paused")
    s.scheduler.runUntilIdle()
    expect(causes(s)).toContain("storage/fetch-resumed")
    expect(st(s).fetch.phase).toBe("done")
    expect(st(s).items.filter((i) => i.kind === "map")).toHaveLength(1)
  })
})

describe("storage slice: the declined map", () => {
  /** A recording context over the opening world (the reducer only records effects). */
  function recorder() {
    const base = snap(setup())
    const effects = { scheduled: [] as DemoAction[], dispatched: [] as DemoAction[], emitted: [] as { cause: string; text?: string }[], cancelled: [] as string[] }
    const ctx: SliceCtx = {
      world: DEMO_WORLD,
      now: 0,
      prev: base,
      core: base.core,
      schedule: (_ms, action) => void effects.scheduled.push(action),
      cancel: (key) => void effects.cancelled.push(key),
      dispatch: (action) => void effects.dispatched.push(action),
      emit: (cause, opts) => void effects.emitted.push({ cause, text: opts?.text }),
      rng: () => () => 0,
    }
    return { ctx, effects }
  }

  it("is not kept when only your history could make room: nothing freed, the map's pieces dropped, the log says so", () => {
    const { ctx, effects } = recorder()
    // Packed with history and undelivered copies: rules 1 and 2 cannot make room for the map.
    const packed: StorageState = {
      ...initialStorage(),
      seq: 4,
      items: [item("history", 14, 1), item("carried", 8, 2), item("update", 3, 3), item("handed", 1, 4)],
      fetch: { phase: "pruning", received: 2 * MAP_PIECE, resume: null, pruned: false, instant: false },
    }
    const next = reduceStorage(packed, { type: "storage/step" }, ctx)
    expect(next.items).toBe(packed.items)
    expect(next.fetch).toMatchObject({ phase: "declined", received: 0, pruned: true })
    expect(next.last).toBeNull()
    expect(next.log).toEqual([{ id: "f5", at: 0, freed: [], declined: true }])
    expect(effects.emitted).toEqual([{ cause: "storage/declined", text: STORAGE_COPY.events.declined }])
    expect(effects.scheduled).toEqual([])
    expect(fetchLine(next, HUB)).toBe(STORAGE_COPY.fetch.declined)
  })

  it("every other action leaves the state itself (identity)", () => {
    const { ctx } = recorder()
    const state = initialStorage()
    expect(reduceStorage(state, { type: "core/toggleRail" }, ctx)).toBe(state)
  })
})

describe("storage copy: words, not numbers (§6.8)", () => {
  /** Every string the copy can print, with sample arguments for its functions. */
  function strings(value: unknown, out: string[] = []): string[] {
    if (typeof value === "string") out.push(value)
    else if (typeof value === "function") out.push(String((value as (...a: string[]) => unknown)("x", "y", "z")))
    else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
    else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out))
    return out
  }

  it("prints no sizes, thresholds or percentages: the only digits name a rule of the order", () => {
    const all = strings(STORAGE_COPY)
    expect(all.length).toBeGreaterThan(40)
    for (const text of all) expect(text.replace(/\brules? [1-4]( and [1-4])?\b/g, ""), text).not.toMatch(/\d|%/)
    expect(STORAGE_COPY.classes.rule(2)).toBe("rule 2")
  })

  it("names the hub fetch over Wi-Fi and big datasets as not practical over long-range radio", () => {
    expect(STORAGE_COPY.fetch.radio).toBe("Big datasets are not practical over long-range radio.")
    expect(STORAGE_COPY.fetch.source(HUB)).toContain("over Wi-Fi")
  })
})
